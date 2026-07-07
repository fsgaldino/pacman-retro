"""
models.py — Gestão do banco SQLite

Regra de Ouro (Privacy by Design):
  - NÃO armazenamos senhas.
  - O email é o único identificador do jogador.
  - O login valida apenas a existência do email no banco (sem autenticação
    por credencial secreta). Isso mantém o ecossistema ágil, impede
    colisões de pontuação entre contas e segue o princípio de
    Privacy by Design (dados mínimos, sem credenciais armazenadas).
"""

import sqlite3
import os
import time

DB_PATH = os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "..", "data", "pacman.db"))


def _get_conn() -> sqlite3.Connection:
    """Retorna uma conexão SQLite (uma por thread/event-loop)."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# Pool de conexões simples (thread-safe para uvicorn single-process)
_conn: sqlite3.Connection | None = None


def get_db() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        # Garante que o diretório do banco exista
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        _conn = _get_conn()
        _init_db(_conn)
    return _conn


def _init_db(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS players ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  name TEXT NOT NULL DEFAULT '',"
        "  email TEXT UNIQUE NOT NULL,"
        "  created_at TEXT DEFAULT (datetime('now'))"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS sessions ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  player_id INTEGER NOT NULL,"
        "  token TEXT UNIQUE NOT NULL,"
        "  created_at TEXT DEFAULT (datetime('now')),"
        "  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE"
        ")"
    )
    conn.execute(
        "CREATE TABLE IF NOT EXISTS scores ("
        "  id INTEGER PRIMARY KEY AUTOINCREMENT,"
        "  player_id INTEGER NOT NULL,"
        "  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 999999),"
        "  player_email TEXT NOT NULL,"
        "  player_name TEXT NOT NULL DEFAULT '',"
        "  created_at TEXT DEFAULT (datetime('now')),"
        "  FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE"
        ")"
    )
    conn.commit()


def close_db() -> None:
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None
