"""
test_backend.py — Testes do backend FastAPI

Valida:
  - Registro e login por email (sem senha)
  - Impedimento de duplicidade de email
  - Submissão de scores com autenticação
  - Ranking de scores
  - Reset de ranking (admin)
"""

import os
import sys
import tempfile

# Garante que o módulo backend é importável
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest
from fastapi.testclient import TestClient

from backend.main import app
from backend.models import get_db, close_db


@pytest.fixture(autouse=True)
def override_db():
    """Usa um banco temporário para cada teste."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    os.environ["DB_PATH"] = tmp.name
    # Força recriação da conexão
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
        # Register
        resp = client.post("/api/register", json={
            "name": "Testador",
            "email": "teste@example.com",
        })
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert "token" in data
        assert data["email"] == "teste@example.com"
        assert data["name"] == "Testador"
        token1 = data["token"]

        # Login com mesmo email — deve gerar novo token
        resp = client.post("/api/login", json={
            "email": "teste@example.com",
        })
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert "token" in data
        assert data["token"] != token1  # token diferente

    def test_register_duplicate_email(self):
        """Email duplicado deve retornar 409."""
        client.post("/api/register", json={
            "name": "User1",
            "email": "dup@example.com",
        })
        resp = client.post("/api/register", json={
            "name": "User2",
            "email": "dup@example.com",
        })
        assert resp.status_code == 409
        assert "já cadastrado" in resp.json()["detail"].lower()

    def test_login_nonexistent_email(self):
        """Login com email não cadastrado deve falhar."""
        resp = client.post("/api/login", json={
            "email": "naoexiste@example.com",
        })
        assert resp.status_code == 401

    def test_invalid_email(self):
        """Email inválido deve retornar 400."""
        resp = client.post("/api/register", json={
            "name": "Test",
            "email": "invalido",
        })
        assert resp.status_code == 400

    def test_me_endpoint(self):
        """GET /api/me retorna dados do jogador."""
        resp = client.post("/api/register", json={
            "name": "MeTest",
            "email": "me@example.com",
        })
        token = resp.json()["token"]

        resp = client.get("/api/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert data["email"] == "me@example.com"
        assert data["name"] == "MeTest"


class TestScores:
    """Testes de pontuação."""
    _counter = 0

    @pytest.fixture
    def authed_client(self):
        """Retorna headers de autenticação para testes (email único)."""
        TestScores._counter += 1
        email = f"score{TestScores._counter}@example.com"
        resp = client.post("/api/register", json={
            "name": "ScorePlayer",
            "email": email,
        })
        assert resp.status_code == 201, resp.text
        token = resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}

    def test_submit_score(self, authed_client):
        """Submissão de score funciona."""
        resp = client.post("/api/scores", json={
            "score": 10000,
        }, headers=authed_client)
        assert resp.status_code == 201, resp.text

    def test_submit_score_unauthenticated(self):
        """Submissão sem token deve falhar."""
        resp = client.post("/api/scores", json={
            "score": 10000,
        })
        assert resp.status_code == 401

    def test_submit_invalid_score(self, authed_client):
        """Score negativo ou muito grande deve falhar."""
        resp = client.post("/api/scores", json={
            "score": -1,
        }, headers=authed_client)
        assert resp.status_code == 422  # validation error

        resp = client.post("/api/scores", json={
            "score": 1000000,  # > 999999
        }, headers=authed_client)
        assert resp.status_code == 422

    def test_ranking(self, authed_client):
        """GET /api/scores retorna ranking ordenado."""
        # Submete alguns scores
        for s in [500, 1000, 750]:
            client.post("/api/scores", json={"score": s}, headers=authed_client)

        resp = client.get("/api/scores?limit=10")
        assert resp.status_code == 200
        scores = resp.json()
        assert len(scores) >= 3
        # Ordenação decrescente
        for i in range(len(scores) - 1):
            assert scores[i]["score"] >= scores[i + 1]["score"]

    def test_score_email_prevents_duplicate_accounts(self):
        """
        Verifica que dois jogadores NÃO podem usar o mesmo email.
        O email é o identificador único.
        """
        # Registra com email1
        resp1 = client.post("/api/register", json={
            "name": "Player1",
            "email": "shared@example.com",
        })
        assert resp1.status_code == 201

        # Tenta registrar com o mesmo email
        resp2 = client.post("/api/register", json={
            "name": "Player2",
            "email": "shared@example.com",
        })
        assert resp2.status_code == 409  # Conflito — email já existe


class TestAdmin:
    """Testes do endpoint administrativo /api/reset-score."""
    _counter = 0

    @pytest.fixture
    def authed_client(self):
        """Retorna headers de autenticação + token para testes."""
        TestAdmin._counter += 1
        email = f"admin{TestAdmin._counter}@example.com"
        resp = client.post("/api/register", json={
            "name": "AdminPlayer",
            "email": email,
        })
        assert resp.status_code == 201, resp.text
        token = resp.json()["token"]
        return {"Authorization": f"Bearer {token}"}, token

    def test_reset_score_token_nao_configurado(self, monkeypatch):
        """Sem RESET_SCORE_TOKEN no ambiente, retorna ok=false."""
        monkeypatch.delenv("RESET_SCORE_TOKEN", raising=False)
        resp = client.post("/api/reset-score", json={"token": "qualquer"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is False
        assert "não configurado" in data["message"].lower()

    def test_reset_score_token_invalido(self, monkeypatch):
        """Token inválido deve retornar 403."""
        monkeypatch.setenv("RESET_SCORE_TOKEN", "token-correto")
        resp = client.post("/api/reset-score", json={"token": "token-errado"})
        assert resp.status_code == 403
        assert "inválido" in resp.json()["detail"].lower()

    def test_reset_score_token_vazio(self, monkeypatch):
        """Token vazio deve retornar 422 (min_length)."""
        monkeypatch.setenv("RESET_SCORE_TOKEN", "token-correto")
        resp = client.post("/api/reset-score", json={"token": ""})
        assert resp.status_code == 422

    def test_reset_score_sucesso(self, monkeypatch, authed_client):
        """Reset bem-sucedido: limpa scores e invalida sessões."""
        monkeypatch.setenv("RESET_SCORE_TOKEN", "meu-token-admin")
        headers, token = authed_client

        # Submete um score antes do reset
        resp = client.post("/api/scores", json={"score": 5000}, headers=headers)
        assert resp.status_code == 201

        # Verifica que o ranking tem scores
        resp = client.get("/api/scores?limit=5")
        assert len(resp.json()) >= 1

        # Verifica que a sessão está ativa
        resp = client.get("/api/me", headers=headers)
        assert resp.status_code == 200

        # Executa o reset
        resp = client.post("/api/reset-score", json={"token": "meu-token-admin"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["ok"] is True
        assert "zerado" in data["message"].lower()

        # Ranking deve estar vazio
        resp = client.get("/api/scores?limit=5")
        assert resp.json() == []

        # Sessão anterior deve estar invalidada
        resp = client.get("/api/me", headers=headers)
        assert resp.status_code == 401


class TestHealth:
    """Testes do endpoint de health check."""

    def test_health(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "ok"
        assert data["version"] == "3.0.0"
