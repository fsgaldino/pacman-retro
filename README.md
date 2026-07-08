# 🟡 Pac-Man Retrô v4.0 — Arcade Flow

![Pac-Man Banner](https://img.shields.io/badge/Pac--Man-Retrô-ffcc00?style=for-the-badge)
![Python](https://img.shields.io/badge/Python-3.13-3776AB?style=flat-square&logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-4.0-009688?style=flat-square&logo=fastapi)
![SQLite](https://img.shields.io/badge/SQLite-Seguro-003b57?style=flat-square&logo=sqlite)
![PWA](https://img.shields.io/badge/PWA-Instalável-5A0FC8?style=flat-square&logo=pwa)
![Docker](https://img.shields.io/badge/Docker-3.13--slim-2496ED?style=flat-square&logo=docker)

> Uma aplicação web completa do clássico jogo Pac-Man, com backend em **Python 3.13 + FastAPI**, frontend em **HTML5 Canvas puro**, sons **sintetizados via Web Audio API**, **4 fantasmas com IA clássica progressiva por tiers**, **sistema de combos**, **joystick virtual suave (Touch Delta)**, **PWA instalável**, **fluxo arcade sem login**, e **Dockerizado** para deploy rápido.

---

## 🎮 Fluxo Arcade (v4.0)

A versão 4.0 removeu completamente a tela de autenticação. Agora a experiência é 100% arcade:

1. **Abriu, jogou** — o jogo carrega direto na intro animada
2. **Jogou, morreu** — após o primeiro Game Over, pede Nickname + Email
3. **Registrou, continuou** — pontuação salva, ranking atualizado
4. **Voltou, escolheu** — Continuar (acumula) ou Novo Jogo (reinicia)

| Estado | Ação |
|--------|------|
| Tela inicial | Espaço/Touch para começar |
| Durante o jogo | Setas para mover, P pausar |
| Game Over (1ª vez) | Modal pede Nickname + Email |
| Game Over (já registrado) | Score salvo automaticamente |
| Tela inicial (com save) | Continuar (C) ou Novo Jogo (N) |
| Logout | Limpa identidade e recomeça |

---

## 📋 Índice

- [Arquitetura](#arquitetura)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação e Execução](#instalação-e-execução)
- [API REST](#api-rest)
- [Testes](#testes)
- [Controles](#controles)

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                     Navegador                           │
│  ┌───────────┐   ┌────────────┐   ┌──────────────────┐  │
│  │ index.html│   │  game.js   │   │ Web Audio API    │  │
│  │ (Arcade)  │   │  (Motor)   │   │ (14+ efeitos)    │  │
│  │ (Joystick)│   │  (~3000L)  │   │                  │  │
│  │ (Settings)│   │  Entity    │   │                  │  │
│  └───────────┘   │  Game      │   └──────────────────┘  │
│                  │  Ghost IA  │                         │
│                  │  Joystick  │                         │
│                  └────────────┘                         │
│                         │                               │
│                 fetch() + Bearer Token                  │
└─────────────────────────┼───────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│              Python 3.13 + FastAPI (uvicorn)             │
│  ┌────────────┐   ┌──────────────┐   ┌────────────────┐  │
│  │  main.py   │   │  models.py   │   │   schemas.py   │  │
│  │  (REST)    │   │  (SQLite)    │   │  (Pydantic)    │  │
│  └────────────┘   └──────┬───────┘   └────────────────┘  │
│                           │                              │
│                           ▼                              │
│                  ┌────────────────┐                      │
│                  │   SQLite DB    │                      │
│                  │  data/pacman.db│                      │
│                  │ players        │                      │
│                  │ sessions       │                      │
│                  │ scores         │                      │
│                  └────────────────┘                      │
└─────────────────────────────────────────────────────────┘
```

---

## Funcionalidades

### 🎮 Jogo

- **Pac-Man clássico** com input buffering preciso e early snap
- **4 fantasmas** com IA progressiva por tiers
- **Sistema de frutas** com power-ups (Speed, Shield)
- **Sistema de combos** com multiplicador progressivo
- **Progressão de nível** com velocidade e IA crescente
- **Save/Resume** automático com Continue/Restart

### 🎮 Fluxo Arcade

- **Zero atrito** — abre direto no jogo, sem telas de login
- **Registro pós-game** — nickname + email após game over
- **Identidade persistente** — Continuar acumula, Novo Jogo reinicia
- **Logout** limpa tudo e recomeça

### 📱 Virtual Joystick

- Joystick dinâmico Touch Delta
- Long-press e tap para pausar
- Botão ❚❚ no header (mobile)

### 👻 IA Progressiva (Tier System)

| Tier | Nível | Comportamento |
|------|-------|---------------|
| 1 | 1 | IA básica, fantasmas previsíveis |
| 2 | 2-3 | Brilho sutil, perseguição mais precisa |
| 3 | 4-6 | Sombra pulsante, olhos glow, scatter reduzido |
| 4 | 7+ | Olhos vermelhos, afterimage, coordenação de grupo |

---

## Pré-requisitos

- **Python 3.11+** (recomendado 3.13)
- **Docker** + **Docker Compose** (para execução conteinerizada)
- Navegador moderno (Chrome, Firefox, Edge)

---

## Instalação e Execução

### Com Docker (recomendado)

```bash
docker compose up -d --build
# Acesse: http://localhost:8000
```

### Local (sem Docker)

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
# Acesse: http://localhost:8000
```

---

## API REST

### Autenticação (Passwordless)

| Método | Rota | Corpo | Resposta |
|--------|------|-------|----------|
| POST | `/api/register` | `{ name, email }` | `{ token, email, name }` |
| POST | `/api/login` | `{ email }` | `{ token, email, name }` |
| POST | `/api/logout` | Bearer token | `{ ok }` |
| GET | `/api/me` | Bearer token | `{ id, name, email }` |

### Pontuação

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| GET | `/api/scores?limit=N` | ❌ | Ranking decrescente |
| POST | `/api/scores` | ✅ Bearer | Submeter pontuação |

### Códigos de Erro

| Status | Significado |
|--------|-------------|
| 400 | Dados inválidos |
| 401 | Token ausente/inválido |
| 409 | Email ou nickname já existe |
| 422 | Erro de validação |

---

## Testes

```bash
# Backend (17 testes)
docker compose exec -T pacman python -m pytest tests/test_backend.py -v

# Movimento (15 testes)
cd pacman-app && npm install && node tests/test_movement.js
```

---

## Controles

| Tecla/Ação | Função |
|------------|--------|
| ← → ↑ ↓ | Mover Pac-Man |
| Espaço | Iniciar / Continuar |
| P | Pausar |
| N | Novo Jogo |
| C | Continuar |
| R | Ranking |
| M | Som on/off |
| 🚪 | Logout (limpa identidade) |

---

## Licença

MIT License. Projeto educacional/fan-made sem fins comerciais.

*ProntaCorp S.A. — tecnologia com propósito humano*
