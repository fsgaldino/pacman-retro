"""
test_backend.py — Testes do backend FastAPI

Valida:
  - Registro e login por email (passwordless)
  - Impedimento de duplicidade de email e nickname
  - Submissão de scores com autenticação
  - Ranking de scores
  - Reset de ranking (admin)
"""

import os
import sys
import tempfile
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import get_db, close_db


def _uid() -> str:
    return uuid.uuid4().hex[:8]


@pytest.fixture(autouse=True)
def override_db():
    """Usa um banco temporário para cada teste."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DB_PATH"] = tmp.name
    close_db()
    get_db()
    yield
    close_db()
    os.unlink(tmp.name)


client = TestClient(app)


class TestAuth:
    """Testes de autenticação passwordless."""

    def test_register_and_login(self):
        """Registra e faz login com o mesmo email."""
        uid = _uid()
        resp = client.post("/demos/Pacman/api/register", json={
            "name": "Testador",
            "email": f"teste{uid}@example.com",
        })
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert "token" in data
        token1 = data["token"]

        # Login com mesmo email
        resp = client.post("/demos/Pacman/api/login", json={
            "email": f"teste{uid}@example.com",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "token" in data
        assert data["token"] != token1

    def test_register_duplicate_email(self):
        """Email duplicado deve retornar 409 com mensagem específica."""
        uid = _uid()
        client.post("/demos/Pacman/api/register", json={
            "name": "User1",
            "email": f"dup{uid}@example.com",
        })
        resp = client.post("/demos/Pacman/api/register", json={
            "name": "User2",
            "email": f"dup{uid}@example.com",
        })
        assert resp.status_code == 409
        assert "e-mail" in resp.json()["detail"].lower()
        assert "cadastrado" in resp.json()["detail"].lower()

    def test_register_duplicate_nickname(self):
        """Nickname duplicado deve retornar 409 com mensagem específica."""
        uid = _uid()
        client.post("/demos/Pacman/api/register", json={
            "name": "NickUnico",
            "email": f"um{uid}@example.com",
        })
        resp = client.post("/demos/Pacman/api/register", json={
            "name": "NickUnico",
            "email": f"outro{uid}@example.com",
        })
        assert resp.status_code == 409
        assert "nome/apelido" in resp.json()["detail"].lower()
        assert "em uso" in resp.json()["detail"].lower()

    def test_login_nonexistent_email(self):
        """Login com email não cadastrado deve falhar."""
        resp = client.post("/demos/Pacman/api/login", json={
            "email": "naoexiste@example.com",
        })
        assert resp.status_code == 401

    def test_invalid_email(self):
        """Email inválido deve retornar 400."""
        resp = client.post("/demos/Pacman/api/register", json={
            "name": "Test",
            "email": "invalido",
        })
        assert resp.status_code == 400

    def test_me_endpoint(self):
        """GET /api/me retorna dados do jogador."""
        uid = _uid()
        resp = client.post("/demos/Pacman/api/register", json={
            "name": "MeTest",
            "email": f"me{uid}@example.com",
        })
        token = resp.json()["token"]

        resp = client.get("/demos/Pacman/api/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "MeTest"


class TestScores:
    """Testes de pontuação."""

    @pytest.fixture
    def authed_client(self):
        uid = _uid()
        resp = client.post("/demos/Pacman/api/register", json={
            "name": f"ScorePlayer{uid}",
            "email": f"score{uid}@example.com",
        })
        assert resp.status_code == 201, resp.text
        token = resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_submit_score(self, authed_client):
        resp = client.post("/demos/Pacman/api/scores", json={"score": 10000}, headers=authed_client)
        assert resp.status_code == 201, resp.text

    def test_submit_score_unauthenticated(self):
        resp = client.post("/demos/Pacman/api/scores", json={"score": 10000})
        assert resp.status_code == 401

    def test_submit_invalid_score(self, authed_client):
        resp = client.post("/demos/Pacman/api/scores", json={"score": -1}, headers=authed_client)
        assert resp.status_code == 422
        resp = client.post("/demos/Pacman/api/scores", json={"score": 1000000}, headers=authed_client)
        assert resp.status_code == 422

    def test_ranking(self, authed_client):
        for s in [500, 1000, 750]:
            client.post("/demos/Pacman/api/scores", json={"score": s}, headers=authed_client)
        resp = client.get("/demos/Pacman/api/scores?limit=10")
        assert resp.status_code == 200
        scores = resp.json()
        assert len(scores) >= 3
        for i in range(len(scores) - 1):
            assert scores[i]["score"] >= scores[i + 1]["score"]

    def test_score_email_prevents_duplicate_accounts(self):
        uid = _uid()
        resp1 = client.post("/demos/Pacman/api/register", json={
            "name": "Player1",
            "email": f"shared{uid}@example.com",
        })
        assert resp1.status_code == 201
        resp2 = client.post("/demos/Pacman/api/register", json={
            "name": "Player2",
            "email": f"shared{uid}@example.com",
        })
        assert resp2.status_code == 409


class TestAdmin:
    """Testes do endpoint administrativo /api/reset-score."""

    @pytest.fixture
    def authed_client(self):
        uid = _uid()
        resp = client.post("/demos/Pacman/api/register", json={
            "name": f"AdminPlayer{uid}",
            "email": f"admin{uid}@example.com",
        })
        assert resp.status_code == 201, resp.text
        token = resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}, token

    def test_reset_score_token_nao_configurado(self, monkeypatch):
        monkeypatch.delenv("RESET_SCORE_TOKEN", raising=False)
        resp = client.post("/demos/Pacman/api/reset-score", json={"token": "qualquer"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "não configurado" in data["message"].lower()

    def test_reset_score_token_invalido(self, monkeypatch):
        monkeypatch.setenv("RESET_SCORE_TOKEN", "token-correto")
        resp = client.post("/demos/Pacman/api/reset-score", json={"token": "token-errado"})
        assert resp.status_code == 403
        assert "inválido" in resp.json()["detail"].lower()

    def test_reset_score_token_vazio(self, monkeypatch):
        monkeypatch.setenv("RESET_SCORE_TOKEN", "token-correto")
        resp = client.post("/demos/Pacman/api/reset-score", json={"token": ""})
        assert resp.status_code == 422

    def test_reset_score_sucesso(self, monkeypatch, authed_client):
        monkeypatch.setenv("RESET_SCORE_TOKEN", "meu-token-admin")
        headers, token = authed_client
        resp = client.post("/demos/Pacman/api/scores", json={"score": 5000}, headers=headers)
        assert resp.status_code == 201
        resp = client.get("/demos/Pacman/api/scores?limit=5")
        assert len(resp.json()) >= 1
        resp = client.get("/demos/Pacman/api/me", headers=headers)
        assert resp.status_code == 200
        resp = client.post("/demos/Pacman/api/reset-score", json={"token": "meu-token-admin"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "zerado" in data["message"].lower()
        resp = client.get("/demos/Pacman/api/scores?limit=5")
        assert resp.json() == []
        resp = client.get("/demos/Pacman/api/me", headers=headers)
        assert resp.status_code == 401


class TestHealth:
    def test_health(self):
        resp = client.get("/demos/Pacman/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "4.0.0"
