# 🤝 Contribuindo para o Pac-Man Retrô

Obrigado por querer contribuir! Este guia explica como configurar o ambiente de desenvolvimento, as convenções do projeto e o processo de contribuição.

---

## 📋 Índice

- [Primeiros Passos](#primeiros-passos)
- [Instalação do Ambiente de Desenvolvimento](#instalação-do-ambiente-de-desenvolvimento)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Convenções de Código](#convenções-de-código)
- [Guia de Estilo por Camada](#guia-de-estilo-por-camada)
- [Adicionando Funcionalidades](#adicionando-funcionalidades)
- [Testando Localmente](#testando-localmente)
- [Commits](#commits)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)

---

## Primeiros Passos

1. **Faça fork** do repositório no GitHub
2. **Clone** o seu fork:
   ```bash
   git clone https://github.com/SEU-USUARIO/pacman-app.git
   cd pacman-app
   ```
3. **Crie uma branch** para sua feature/fix:
   ```bash
   git checkout -b feature/nome-da-feature
   ```

---

## Instalação do Ambiente de Desenvolvimento

### Pré-requisitos

- **Node.js** 20+ (recomendado: [nvm](https://github.com/nvm-sh/nvm) para gerenciar versões)
- **Git** 2.30+
- **Docker** + **Docker Compose** (opcional, para testar a containerização)
- Navegador moderno (Chrome, Firefox, Edge)

### Setup Local

```bash
# 1. Instale as dependências
npm install

# 2. Inicie o servidor em modo desenvolvimento
npm start

# 3. Acesse no navegador
#    → http://localhost:3000
```

O banco SQLite será criado automaticamente em `./data/pacman.db`.

### Variáveis de Ambiente para Desenvolvimento

```bash
# Porta alternativa (evita conflito com outros serviços)
export PORT=3001

# Banco de dados separado para testes
export DB_PATH=./data/test.db
```

### Com Docker (desenvolvimento)

```bash
# Build e execute
docker compose up -d --build

# Acesse em http://localhost:3001

# Logs em tempo real
docker compose logs -f

# Pare o container
docker compose down
```

### Estrutura de Arquivos

```
pacman-app/
├── package.json          # Dependências e scripts npm
├── server.js             # Backend Express + SQLite (~180 linhas)
├── public/
│   ├── index.html        # Frontend HTML + CSS inline (~400 linhas)
│   └── game.js           # Motor do jogo Canvas (~2400 linhas)
├── Dockerfile            # Build da imagem Docker
├── docker-compose.yml    # Orquestração do container
├── CONTRIBUTING.md       # Este arquivo
├── README.md             # Documentação principal
└── .gitignore            # Arquivos ignorados pelo Git
```

---

## Convenções de Código

### Geral

| Regra | Descrição |
|-------|-----------|
| **Idioma** | Comentários, nomes de variáveis públicas e documentação em **português (BR)** |
| **Indentação** | 2 espaços (sem tabs) |
| **Aspas** | Strings simples `'...'` no backend, crases `` `...` `` para template literals |
| **Comparação** | Sempre `===` e `!==` (nunca `==` ou `!=`) |
| **Declaração** | `const` por padrão; `let` quando o valor muda; **nunca `var`** |
| **Ponto e vírgula** | Sim, sempre usar `;` ao final de statements |
| **Trailing commas** | Sim, em arrays e objetos multi-linha |

### Nomenclatura

| Tipo | Convênio | Exemplos |
|------|----------|----------|
| Variáveis/parâmetros | `camelCase` | `ghostSpeed`, `tileCol`, `comboTimer` |
| Funções/métodos | `camelCase` | `getSpeeds()`, `drawGhost()`, `_saveGame()` |
| Métodos privados | Prefixo `_` | `_loadSettings()`, `_renderIntro()`, `_applyBuffer()` |
| Classes | `PascalCase` | `Game`, `Entity` |
| Constantes globais | `UPPER_CASE` | `COLS`, `ROWS`, `TS`, `TILE`, `DIR` |
| Constantes de config | `UPPER_CASE` | `SCATTERCHASE_BY_LEVEL`, `FRUITS`, `POWERUP_SPEED_MULT` |
| IDs HTML | `kebab-case` | `game-canvas`, `overlay-text`, `mobile-start` |
| CSS classes | `kebab-case` | `dpad-btn`, `diff-btn`, `game-header` |

### Comentários

Use divisores de seção para organizar blocos de código:

```javascript
// ── Nome da Seção ────────────────────────────────────────
```

Para explicações em bloco:

```javascript
/**
 * Descrição do método/função.
 * Parâmetros e comportamento importantes.
 */
```

Evite comentários óbvios:

```javascript
// ❌ NUNCA
this.score = 0; // zera o score

// ✅ SEMPRE
this.score = 0;
```

---

## Guia de Estilo por Camada

### Backend (`server.js`)

```javascript
// ── Middleware ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));

// ── Helpers ─────────────────────────────────────────────────
function sanitize(v) { ... }

// ── Rotas de Autenticação ───────────────────────────────────
app.post('/api/register', (req, res) => { ... });
```

**Regras específicas do backend:**
- Todas as queries SQL usam **prepared statements** (nunca concatenação)
- Inputs são sanitizados com `sanitize()` antes do uso
- Erros são tratados com `try/catch` e retornam `{ error: '...' }`
- Senhas usam bcrypt com `cost factor 12`

### Frontend — HTML (`public/index.html`)

```html
<!-- IDs para elementos interativos -->
<div id="game-screen">
  <div id="game-header">
    <span id="score-display">0</span>
  </div>
</div>

<!-- Classes para estilização -->
<button class="dpad-btn" data-dir="up">▲</button>
<button class="diff-btn active" data-diff="normal">Normal</button>
```

**Regras específicas do HTML:**
- CSS é inline no `<style>` (não arquivos externos)
- JavaScript é inline no `<script>` no final do `<body>`
- Elementos interativos usam `id`, estilos usam `class`

### Frontend — JavaScript (`public/game.js`)

```javascript
// ─── CONSTANTES ─────────────────────────────────────────────
const COLS = 21;
const ROWS = 21;
const TS   = 20;

// ─── CLASSE ENTIDADE ────────────────────────────────────────
class Entity {
  constructor(col, row, speed) { ... }

  /** Descrição do método */
  step(dt, map, isGhost) { ... }

  /** Métodos privados com prefixo _ */
  _applyBuffer(map, isGhost) { ... }
}

// ─── CLASSE PRINCIPAL DO JOGO ──────────────────────────────
class Game {
  constructor(canvas) { ... }
  init(level) { ... }
  update(dt) { ... }
  render() { ... }
}

// ── BOOTSTRAP ────────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);
```

**Regras específicas do game.js:**
- **Um arquivo único** para todo o motor do jogo
- Classes usam propriedades públicas (sem getters/setters)
- `update(dt)` recebe delta-time em segundos
- `render()` usa Canvas 2D API diretamente
- Áudio é sintetizado via Web Audio API (sem arquivos externos)
- Persistência client-side usa `localStorage`
- Não usar bibliotecas externas (vanilla JS only)

### Padrões de Loop Principal

```javascript
// Loop com requestAnimationFrame
loop = (time) => {
  const dt = Math.min((time - this.lastTime) / 1000, 0.05);
  this.lastTime = time;
  this.update(dt);
  this.render();
  this.animFrame = requestAnimationFrame(this.loop);
}
```

### Padrão de Input (Queue)

```javascript
// Input é enfileirado e consumido uma vez por frame
for (const dir of this.inputQueue) {
  this.pacman.setBufferedDir(dir, this.map, false);
}
this.inputQueue = [];
```

### Padrão de Áudio

```javascript
// Usar Audio._tone() para sons sintetizados
_tone(freq, dur, type, vol = 0.08) {
  if (!this.ctx || this._muted) return;
  // ... Web Audio API
}
```

---

## Adicionando Funcionalidades

### Novo Som Sintetizado

1. Adicione o método no objeto `Audio` (início de `game.js`):
   ```javascript
   meuSom() {
     this._tone(440, 0.1, 'square', 0.08);
     setTimeout(() => this._tone(660, 0.1, 'sine', 0.06), 80);
   },
   ```
2. Chame via `Audio.meuSom()` no jogo
3. Respeite o toggle `Audio._muted` (o `_tone` já verifica)

### Novo Fantasma

1. Adicione na array `this.ghosts` no `init()` e `respawnEntities()`
2. Adicione IA correspondente em `getGhostTarget(gi)`
3. Defina `baseSpeed` na inicialização
4. Adicione cor na array `ghostColors` onde necessário

### Nova Fruta

1. Adicione no array `FRUITS`:
   ```javascript
   { emoji: '🍋', points: 400, afterDots: 120 },
   ```

### Novo Power-up

1. Adicione tipo no objeto `FRUITS` (campo `powerUp`)
2. Crie timer correspondente no constructor do `Game`
3. Implemente `_activatePowerUp(type)` com o efeito desejado
4. Adicione lógica de expiração no `update()`

### Novo Tile no Mapa

1. Adicione constante em `TILE`:
   ```javascript
   const TILE = { EMPTY: 0, WALL: 1, DOT: 2, POWER: 3, GHOUSE: 4, DOOR: 5, NEW: 6 };
   ```
2. Adicione lógica de renderização no `render()`
3. Adicione lógica de colisão em `canMoveTo()`

---

## Testando Localmente

### Teste Manual no Navegador

1. Inicie o servidor: `npm start`
2. Acesse `http://localhost:3000`
3. Registre uma conta e faça login
4. Teste todas as funcionalidades:
   - Movimentação (setas ou D-pad)
   - Comer pastilhas e power pellets
   - Comer fantasmas no modo fright
   - Comer frutas
   - Power-ups (speed e shield)
   - Sistema de combo
   - Pausar (P) e configurações (⚙️)
   - Progressão de níveis
   - Game over e high score

### Teste de Mobile

1. Abra Chrome DevTools (F12)
2. Ative o modo Device Toolbar (ícone de celular)
3. Selecione um dispositivo (iPhone, Pixel, etc.)
4. Teste D-pad e botões de ação

### Teste de API

```bash
# Registrar
curl -X POST http://localhost:3000/api/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# Login
curl -X POST http://localhost:3000/api/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"123456"}'

# Ver high scores
curl http://localhost:3000/api/scores?limit=5

# Submeter score (use o token do login)
curl -X POST http://localhost:3000/api/scores \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer SEU_TOKEN" \
  -d '{"score": 10000}'
```

### Teste de Docker

```bash
# Build
docker compose build

# Executar
docker compose up -d

# Verificar logs
docker compose logs -f

# Testar API
curl http://localhost:3001/api/scores

# Parar
docker compose down
```

### Checklist Antes de Submeter

- [ ] O código segue as convenções de estilo
- [ ] Não há erros no console do navegador
- [ ] Funciona em Chrome, Firefox e Edge
- [ ] Funciona em mobile (D-pad responsivo)
- [ ] Áudio funciona e respeita o toggle de som
- [ ] Configurações persistem no localStorage
- [ ] Save/Resume funciona corretamente
- [ ] Não quebra funcionalidades existentes

---

## Commits

### Formato

```
<tipo>(escopo): <descrição curta>

<descrição opcional mais detalhada>

<referência opcional a issue>
```

### Tipos

| Tipo | Quando usar | Exemplo |
|------|-------------|---------|
| `feat` | Nova funcionalidade | `feat(combo): sistema de combo para ghosts e frutas` |
| `fix` | Correção de bug | `fix(movimento): alinhamento de tile no target-based` |
| `docs` | Documentação | `docs(readme): adiciona seção de combo` |
| `style` | Formatação (sem mudar lógica) | `style(game): indentação e espaçamento` |
| `refactor` | Refatoração (sem mudar comportamento) | `refactor(audio): extrai _tone para método genérico` |
| `perf` | Melhoria de performance | `perf(render): reduz chamadas de shadowBlur` |
| `test` | Testes | `test(api): adiciona testes de autenticação` |
| `chore` | Tarefas de manutenção | `chore(deps): atualiza express para 4.21` |

### Exemplos

```bash
git commit -m "feat(combo): adiciona sistema de multiplicador para ações em sequência"

git commit -m "fix(ghost-house): corrige geometria do corredor de saída (FIX 3)"

git commit -m "docs(readme): atualiza changelog com v2.0 features"
```

---

## Pull Requests

### Template

```markdown
## Descrição
Breve descrição do que foi feito.

## Tipo de Mudança
- [ ] Bug fix
- [ ] Nova funcionalidade
- [ ] Refatoração
- [ ] Documentação
- [ ] Outro: ___

## Como Testar
1. Passo 1
2. Passo 2
3. Passo 3

## Screenshots (se aplicável)
[Anexar screenshots do resultado]

## Checklist
- [ ] Código segue as convenções do projeto
- [ ] Testado em Chrome e Firefox
- [ ] Testado em mobile
- [ ] Não quebra funcionalidades existentes
- [ ] Documentação atualizada (se aplicável)
```

### Regras

1. **Uma feature por PR** — mantenha PRs focados e revisionáveis
2. **Descrição clara** — explique o que e por quê (não apenas "como")
3. **Screenshots** — para mudanças visuais, sempre incluir antes/depois
4. **Teste manual** — verifique todos os cenários antes de submeter
5. **Commits limpos** — use rebase para limpar commits antes de mergear

---

## Reporting Bugs

### Template

```markdown
## Descrição do Bug
O que aconteceu.

## Comportamento Esperado
O que deveria acontecer.

## Passos para Reproduzir
1. ...
2. ...
3. ...

## Ambiente
- SO:
- Navegador:
- Versão:
- Resolução (se mobile):

## Screenshots
[Anexar screenshot ou vídeo]
```

### Onde Reportar

- **Bugs críticos** (jogo travando, perda de dados): Issue imediata
- **Melhorias** (features novas, UX): Discussion antes de implementar
- **Dúvidas** (setup, arquitetura): Discussion

---

## Arquitetura Rápida

Para entender o fluxo do código:

```
┌─ index.html ─────────────────────────────┐
│  HTML + CSS inline                        │
│  Login/Register + Game Canvas + D-pad     │
│  Settings Modal + High Scores             │
└───────────────┬───────────────────────────┘
                │ carrega
                ▼
┌─ game.js ────────────────────────────────┐
│  Entity (Pac-Man / Fantasma)              │
│    → target-based movement                │
│    → buffered direction input             │
│                                          │
│  Game (motor principal)                   │
│    → update(dt)  — lógica do jogo        │
│    → render()    — Canvas 2D             │
│    → AI system   — scatter/chase/tier    │
│    → combo/score/fruits/power-ups        │
│    → save/resume — localStorage          │
│                                          │
│  Audio (Web Audio API)                    │
│    → 14+ sons sintetizados               │
│    → toggle de mute                      │
│                                          │
│  Mobile Controls (IIFE)                   │
│    → D-pad com hold-to-repeat            │
│    → debounce para touch/mouse/click     │
└───────────────┬───────────────────────────┘
                │ fetch()
                ▼
┌─ server.js ──────────────────────────────┐
│  Express REST API                         │
│    → /api/register, /api/login            │
│    → /api/logout, /api/me                 │
│    → /api/scores (GET + POST)             │
│                                          │
│  SQLite (better-sqlite3)                  │
│    → users, sessions, scores              │
│    → prepared statements (SQL injection)  │
│    → bcrypt cost 12                       │
└───────────────────────────────────────────┘
```

---

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob a mesma MIT License do projeto.

---

## Dúvidas?

- **Issues** — para bugs e sugestões
- **Discussions** — para dúvidas e brainstorm
- **README.md** — documentação completa do projeto

Obrigado por contribuir! 🎮
