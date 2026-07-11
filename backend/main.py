"""
main.py — Servidor FastAPI para o Pac-Man Retrô v4.0

Endpoints (prefixo obrigatório /demos/Pacman):
  POST /demos/Pacman/api/login       — login por email (passwordless)
  POST /demos/Pacman/api/register    — registro por nome + email (passwordless)
  POST /demos/Pacman/api/logout      — invalida token
  GET  /demos/Pacman/api/me          — dados do jogador autenticado
  GET  /demos/Pacman/api/scores      — ranking de pontuações
  POST /demos/Pacman/api/scores      — submissão de pontuação (autenticada)
  POST /demos/Pacman/api/reset-score  — reseta ranking e desloga todos (requer token admin)
  GET  /demos/Pacman/api/health      — health check
  GET  /demos/Pacman/...             — arquivos estáticos do frontend
  GET  /                             — redireciona para /demos/Pacman/
"""

import os
import re
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Depends, Header, APIRouter
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.models import get_db, close_db
from backend.schemas import (
    LoginRequest, RegisterRequest, AuthResponse,
    ScoreSubmit, HealthResponse,
    ResetScoreRequest, ResetScoreResponse,
)


# ── Helpers ─────────────────────────────────────────────────

EMAIL_REGEX = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def sanitize(v: str) -> str:
    if not isinstance(v, str):
        return ""
    return v.strip().replace("<", "").replace(">", "").replace("&", "").replace("'", "").replace('"', "")[:255]


def is_valid_email(email: str) -> bool:
    return bool(EMAIL_REGEX.match(email))


def generate_token() -> str:
    return secrets.token_hex(32)


async def get_current_user(authorization: str = Header(None)) -> int:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token ausente")
    token = authorization[7:]
    db = get_db()
    row = db.execute(
        "SELECT player_id FROM sessions WHERE token = ?", (token,)
    ).fetchone()
    if not row:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    return row["player_id"]


# ── App Setup ───────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    get_db()
    yield
    close_db()


app = FastAPI(
    title="Pac-Man Retrô API",
    version="4.0.0",
    description="Backend passwordless para o Pac-Man Retrô da ProntaCorp",
    lifespan=lifespan,
)

# Diretório estático (frontend)
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "public"

# ── CORS (configurável via ALLOWED_ORIGINS) ─────────────────
_allowed_origins_str = os.environ.get("ALLOWED_ORIGINS", "*")
if _allowed_origins_str:
    _allowed_origins = [o.strip() for o in _allowed_origins_str.split(",") if o.strip()]
else:
    _allowed_origins = []

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Router com prefixo /demos/Pacman ──────────────────────
router = APIRouter(prefix="/demos/Pacman")


# ── Rotas de Autenticação ───────────────────────────────────

@router.post("/api/register", response_model=AuthResponse, status_code=201)
def register(req: RegisterRequest):
    """
    Registra um novo jogador usando nome + email (passwordless).
    Valida unicidade de email e nickname com mensagens distintas.
    """
    name = sanitize(req.name)
    email = sanitize(req.email).lower()

    if not name:
        raise HTTPException(status_code=400, detail="Nome/apelido é obrigatório")

    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="E-mail inválido")

    db = get_db()

    # Transação atômica
    db.execute("BEGIN")
    try:
        # Verifica se email já existe
        existing_email = db.execute(
            "SELECT id FROM players WHERE email = ?", (email,)
        ).fetchone()
        if existing_email:
            raise HTTPException(status_code=409, detail="Este e-mail já está cadastrado")

        # Verifica se nickname já existe (case-insensitive)
        existing_name = db.execute(
            "SELECT id FROM players WHERE name = ? COLLATE NOCASE AND name != ''", (name,)
        ).fetchone()
        if existing_name:
            raise HTTPException(status_code=409, detail="Este nome/apelido já está em uso. Escolha outro.")

        # Cria jogador
        cur = db.execute(
            "INSERT INTO players (name, email) VALUES (?, ?)",
            (name, email),
        )
        db.commit()
        player_id = cur.lastrowid
    except Exception:
        db.rollback()
        raise

    # Gera token de sessão
    token = generate_token()
    db.execute(
        "INSERT INTO sessions (player_id, token) VALUES (?, ?)",
        (player_id, token),
    )
    db.commit()

    return AuthResponse(token=token, email=email, name=name)


@router.post("/api/login", response_model=AuthResponse)
def login(req: LoginRequest):
    """
    Login validado apenas por email (passwordless).
    O email precisa estar cadastrado.
    """
    email = sanitize(req.email).lower()

    if not is_valid_email(email):
        raise HTTPException(status_code=400, detail="E-mail inválido")

    db = get_db()

    player = db.execute(
        "SELECT id, name, email FROM players WHERE email = ?",
        (email,),
    ).fetchone()

    if not player:
        raise HTTPException(status_code=401, detail="E-mail não encontrado. Registre-se primeiro.")

    # Gera novo token de sessão
    token = generate_token()
    db.execute(
        "INSERT INTO sessions (player_id, token) VALUES (?, ?)",
        (player["id"], token),
    )
    db.commit()

    return AuthResponse(token=token, email=player["email"], name=player["name"] or "")


@router.post("/api/logout")
def logout(player_id: int = Depends(get_current_user), authorization: str = Header(None)):
    """Invalida o token atual."""
    token = authorization[7:]
    db = get_db()
    db.execute("DELETE FROM sessions WHERE token = ?", (token,))
    db.commit()
    return {"ok": True}


@router.get("/api/me")
def me(player_id: int = Depends(get_current_user)):
    """Retorna dados do jogador autenticado."""
    db = get_db()
    player = db.execute(
        "SELECT id, name, email, created_at FROM players WHERE id = ?",
        (player_id,),
    ).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")
    return {
        "id": player["id"],
        "name": player["name"],
        "email": player["email"],
        "created_at": player["created_at"],
    }


# ── Rotas de Pontuação ──────────────────────────────────────

@router.get("/api/scores")
def list_scores(limit: int = 10):
    """
    Retorna o ranking de pontuações (top N).
    Sem autenticação — qualquer um pode ver o ranking.
    """
    limit = max(1, min(limit, 100))
    db = get_db()
    rows = db.execute(
        """SELECT score, player_email, player_name, created_at
           FROM scores
           ORDER BY score DESC
           LIMIT ?""",
        (limit,),
    ).fetchall()
    return [
        {
            "score": row["score"],
            "player_email": row["player_email"],
            "player_name": row["player_name"] or "",
            "created_at": row["created_at"],
        }
        for row in rows
    ]


@router.post("/api/scores", status_code=201)
def submit_score(
    body: ScoreSubmit,
    player_id: int = Depends(get_current_user),
):
    """
    Submete uma nova pontuação para o jogador autenticado.
    """
    db = get_db()
    player = db.execute(
        "SELECT email, name FROM players WHERE id = ?",
        (player_id,),
    ).fetchone()
    if not player:
        raise HTTPException(status_code=404, detail="Jogador não encontrado")

    db.execute(
        """INSERT INTO scores (player_id, score, player_email, player_name)
           VALUES (?, ?, ?, ?)""",
        (player_id, body.score, player["email"], player["name"] or ""),
    )
    db.commit()
    return {"ok": True}


# ── Reset de Score (Admin) ────────────────────────────────

@router.post("/api/reset-score", response_model=ResetScoreResponse)
def reset_score(body: ResetScoreRequest):
    expected_token = os.environ.get("RESET_SCORE_TOKEN", "")
    if not expected_token:
        return ResetScoreResponse(
            ok=False,
            message="Reset token não configurado. Defina a variável RESET_SCORE_TOKEN no ambiente.",
        )

    if body.token != expected_token:
        raise HTTPException(status_code=403, detail="Token de reset inválido")

    db = get_db()

    db.execute("BEGIN")
    try:
        db.execute("DELETE FROM scores")
        db.execute("DELETE FROM sessions")
        db.commit()
    except Exception:
        db.rollback()
        raise

    return ResetScoreResponse(
        ok=True,
        message="Ranking zerado e todos os jogadores desconectados com sucesso.",
    )


# ── Health ──────────────────────────────────────────────────

@router.get("/api/health", response_model=HealthResponse)
def health():
    return HealthResponse(status="ok", version="4.0.0")


# ── Inclui router ───────────────────────────────────────────

app.include_router(router)


# ── Static Files & SPA Fallback (sob /demos/Pacman/) ────────

@app.get("/demos/Pacman/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve arquivos estáticos e index.html para rotas SPA sob /demos/Pacman/."""
    # 1. Tenta arquivo exato
    file_path = FRONTEND_DIR / full_path
    if file_path.exists() and file_path.is_file():
        return FileResponse(str(file_path))

    # 2. Se o path vazio ou aponta para diretório, serve index.html
    if not full_path or full_path.endswith("/") or (FRONTEND_DIR / full_path).is_dir():
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(str(index_path))

    # 3. Fallback: serve index.html para qualquer rota SP A (deep link)
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))

    return JSONResponse(status_code=404, content={"error": "Not found"})


@app.get("/demos/Pacman/")
async def serve_frontend_root():
    """Redireciona /demos/Pacman/ para index.html."""
    index_path = FRONTEND_DIR / "index.html"
    if index_path.exists():
        return FileResponse(str(index_path))
    return JSONResponse(status_code=404, content={"error": "Not found"})


# ── Redirect da raiz para /demos/Pacman/ ───────────────────

@app.get("/")
async def root_redirect():
    return RedirectResponse(url="/demos/Pacman/")


# ── Entry point ─────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=True)
