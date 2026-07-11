# Changelog

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [4.0.4] - 2026-07-11

### Changed

#### 🌐 Rotas migradas para subpath corporativo /demos/Pacman/
- **backend/main.py**: Todas as rotas FastAPI migradas para `APIRouter(prefix="/demos/Pacman")`
- **public/game.js**: Chamadas `fetch()` atualizadas de `/api/...` para `/demos/Pacman/api/...`
- **public/sw.js**: Cache ASSETS com prefixo `/demos/Pacman/...`, filtro de API atualizado
- **public/manifest.json**: `start_url` alterado para `"/demos/Pacman/"`
- **server.js**: Servidor Express com redirect `/` → `/demos/Pacman/`, router da API em `/demos/Pacman/api`
- **backend/main.py**: Redirect 301 de `/` para `/demos/Pacman/`
- **tests/test_backend.py**: Todas as requisições de teste atualizadas para `/demos/Pacman/api/...`
- **Backend**: 16/16 testes passando validando o novo prefixo

---

## [4.0.3] - 2026-07-09

### Fixed

#### ⌨️ Atalhos do teclado não interferem mais no modal de registro
- **Bug 1**: Atalhos do jogo (Space, C, N, R, setas) eram ativados enquanto o jogador digitava nickname/email no modal — agora o `keydown` global ignora teclas quando o foco está em `INPUT` ou quando o modal `score-reg-modal` está visível
- **Bug 2**: O jogo continuava respondendo a toques por trás do modal — os handlers `touchstart` e `mousedown` do joystick virtual agora verificam se o modal está aberto antes de processar inputs

---

## [4.0.2] - 2026-07-09

### Fixed

#### 🐛 Railway Deploy — UNIQUE constraint no players.name
- **backend/models.py**: Adicionada deduplicação de nomes antes de criar índice único `idx_players_name`
- Nomes duplicados são renomeados para `nome_id` (ex: `Player1_2`), preservando o primeiro registro
- Nomes vazios são convertidos para `_player_id` automaticamente
- Captura `IntegrityError` no índice como rede de segurança extra

---

## [4.0.1] - 2026-07-08

### Fixed

#### 🎮 Fluxo Arcade Simplificado
- **`startArcade()` simplificada**: Agora sempre inicia com animação de intro (`game.init(1)`), sem verificações complexas de save/player no carregamento
- **Auto-ranking removido**: Ranking não aparece mais automaticamente ao final da intro
- **Hints atualizados**: Overlay mostra "C continuar • N novo jogo" (com save) / "Espaço/Touch para começar" (sem save)
- **Skip button corrigido**: Agora também limpa `playerReg`, garantindo que jogadores anônimos sejam solicitados a registrar na próxima partida
- **Bug fix `LONG_PRESS_MS`**: Variável estava `undefined` no joystick virtual — agora definida como 600ms, evitando pause instantâneo ao tocar na tela

#### 🔐 Backend Node.js Passwordless
- **server.js atualizado**: Autenticação sem senha, compatível com o frontend
- `POST /api/register` aceita `{ name, email }` e retorna `{ token, email, name }`
- `POST /api/login` aceita apenas `{ email }` (passwordless)
- Scores agora armazenam `player_name`
- Mensagens de erro em português, formato `{ detail: "..." }` compatível com o frontend

---

## [4.0.0] - 2026-07-07

### Added

#### 🎮 Fluxo Arcade (Login-free)
- **Jogo abre direto na tela inicial** — sem tela de login/registro
- Ao carregar, o jogo já exibe a intro animada e aguarda comando para começar
- Após o primeiro Game Over, exibe modal solicitando **Nickname + Email** (sem senha!)
- Se o email já existe, faz login automático (passwordless)
- Se o nickname está em uso, exibe mensagem específica para trocar

#### 💾 Continue / Novo Jogo Inteligente
- Ao detectar identidade salva, pergunta se quer **Continuar** ou **Novo Jogo**
- **Continuar**: acumula pontuações no mesmo jogador, montando o ranking
- **Novo Jogo**: limpa identidade e aguarda novo registro no próximo Game Over
- Logout (🚪) limpa identidade + save e recarrega o jogo do zero

#### 🔐 Backend Passwordless Otimizado
- Removida dependência bcrypt do backend
- Endpoints `/api/register` e `/api/login` aceitam apenas `{ name, email }` — sem senha
- Validação de nickname único com mensagens em português
- Transação atômica para evitar race conditions no registro

### Changed
- **Versão atualizada para 4.0.0**
- README.md e CHANGELOG.md atualizados com a nova versão
- Tela de autenticação removida do HTML
- Nova estrutura de localStorage: `pacman_player` para identidade do jogador

### Removed
- Campo de senha removido do frontend e backend
- bcrypt removido das dependências
- Tela de auth removida completamente

---

## [3.0.0] - 2026-07-06

### Added

#### 🐍 Backend em Python/FastAPI
- Servidor backend completo migrado de Node.js/Express para Python 3.13+ com FastAPI
- SQLite com WAL mode, schema com `players`, `sessions`, `scores`
- Rotas: `/api/register`, `/api/login`, `/api/logout`, `/api/me`, `/api/scores`, `/api/health`
- Dockerfile atualizado para Python 3.13-slim
- docker-compose.yml atualizado para porta 8000

#### 🔐 Auth Passwordless (Privacy by Design)
- Login e registro sem senha — apenas email como identificador único
- Tokens de sessão via `secrets.token_hex(32)`
- Conformidade com Privacy by Design: nenhum dado sensível armazenado
- Impede colisões de conta: email é o identificador exclusivo

#### 🎮 Input Buffering Preciso (FIX Crítico)
- `Entity.setBufferedDir()` reescrita com detecção de alinhamento (`TILE_CENTER_THRESHOLD=2px`)
- Novo método `checkAndApplyBuffer()` consumido em `step()` ao atingir o centro do tile
- **Early snap** restaurado: aplica direção antecipadamente quando dentro de `TURN_TOLERANCE=10px`
- Meias-voltas continuam instantâneas
- Consumo do buffer no alinhamento exato com centro do tile, garantindo curvas precisas em alta velocidade

#### 🕹️ Virtual Joystick Suave (Touch Delta Controls)
- Joystick dinâmico baseado na Web Touch API — primeiro toque define o centro
- Arrasto calcula delta X/Y, normalizado para direções discretas da grade (Cima/Baixo/Esquerda/Direita)
- Deadzone de 8px para evitar inputs fantasmas
- **Long-press (500ms)** para pausar | **Tap curto (<200ms)** pausa durante PLAYING
- Botão flutuante ❚❚ para pause no mobile (agora no header, não sobre o mapa)
- Botão ▶ para Continue no Game Over
- Controles antigos de D-pad removidos

#### 📱 Progressive Web App (PWA)
- `manifest.json` com display standalone, ícones 192×192 e 512×512
- `sw.js` com estratégia Network First + cache de assets estáticos
- Ícones profissionais com Pac-Man, glow, 4 fantasmas decorativos e texto \"PAC-MAN\" / \"RETRÔ EDITION\"
- Registro automático do Service Worker no `DOMContentLoaded`

#### ✅ Testes Automatizados
- **11 testes pytest** para backend (auth passwordless, scores, email uniqueness, health)
- **15 testes de movimento** (Node.js + jsdom) validando buffer de input, early snap, meia-volta, direção bloqueada
- Cobertura completa dos cenários de input buffering

### Fixed

#### 🐛 Botão de pause sobrepondo o mapa
- **Problema:** Botão ❚❚ estava posicionado no overlay `#mobile-actions` com `bottom:4px;right:4px`, sobre o canto inferior do mapa
- **Solução:** Movido para o `#game-header` como `.header-btn`, ao lado dos botões 🔊🚪🏆⚙️
- Visível apenas em mobile (`@media pointer: coarse`), oculto em desktop (`@media pointer: fine`)

#### 🐛 Sync de volume entre toggle de configurações e botão mute
- **Problema:** Alterar som pelo toggle de configurações (`#set-sound`) não atualizava o botão 🔊/🔇 do header nem o estado `Audio._muted`
- **Solução:** `soundToggle.onchange` agora chama `Audio._muted = !this.settings.soundEnabled` e `this._updateMuteBtn()`

#### 🐛 `handlePause()` não definida (ReferenceError no mobile)
- **Problema:** Função `handlePause()` era chamada em 4 lugares (long-press, tap, clique no pause) mas nunca definida
- **Solução:** Adicionada `function handlePause() { Audio.init(); game.togglePause(); }` no IIFE do joystick virtual

#### 🐛 Ranking com scores de teste no deploy
- **Problema:** O banco SQLite continha scores de teste que apareciam no ranking após deploy
- **Solução:** Remoção explícita do banco `data/pacman.db` para deploy limpo

### Changed
- **Stack migrada:** Node.js → Python 3.13 + FastAPI + uvicorn
- **Porta padrão:** 3000 → 8000
- **Autenticação:** Senhas removidas completamente (login apenas por email)
- **Controles mobile:** D-pad substituído por joystick virtual suave baseado em touch delta
- **Estrutura de diretórios:** Adicionado `backend/` com `main.py`, `models.py`, `schemas.py`
- **package.json:** Atualizado com devDependencies (jsdom, puppeteer) para testes
- **Banco SQLite:** Esquema recriado com `player_id` na tabela de sessões

---

*(changelog de versões anteriores mantido para referência)*
