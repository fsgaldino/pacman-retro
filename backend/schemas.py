"""
schemas.py — Schemas Pydantic para validação de dados
"""

from pydantic import BaseModel, Field, field_validator


# ── Auth ────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Login apenas por email — passwordless."""
    email: str = Field(..., max_length=255, description="Email do jogador")


class RegisterRequest(BaseModel):
    """Registro com nome/apelido e email — sem senha."""
    name: str = Field(..., min_length=1, max_length=100, description="Nome ou apelido único do jogador")
    email: str = Field(..., max_length=255, description="Email do jogador")


class AuthResponse(BaseModel):
    token: str
    email: str
    name: str = ""


class ErrorResponse(BaseModel):
    error: str


# ── Scores ──────────────────────────────────────────────────

class ScoreSubmit(BaseModel):
    score: int = Field(..., ge=0, le=999999)

    @field_validator("score", mode="before")
    @classmethod
    def validate_score_type(cls, v):
        if not isinstance(v, int) or isinstance(v, bool):
            raise ValueError("Score deve ser um número inteiro")
        return v


class ScoreEntry(BaseModel):
    score: int
    player_email: str
    player_name: str = ""
    created_at: str


class ScoreResponse(BaseModel):
    scores: list[ScoreEntry]


# ── Health ──────────────────────────────────────────────────

class ResetScoreRequest(BaseModel):
    """Requisição de reset do ranking — requer token de admin."""
    token: str = Field(..., min_length=1, description="Token de autorização para reset")


class ResetScoreResponse(BaseModel):
    ok: bool
    message: str


class HealthResponse(BaseModel):
    status: str
    version: str = "3.0.0"
