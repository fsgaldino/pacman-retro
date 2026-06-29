# Changelog

Todas as mudanças notáveis neste projeto são documentadas neste arquivo.

O formato é baseado no [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/),
e este projeto adere ao [Semantic Versioning](https://semver.org/lang/pt-BR/).

---

## [2.0.0] - 2025-06-28

### Added

#### 🏆 Sistema de Combo
- Contador unificado para ações em sequência (ghosts + frutas)
- Janela de 3 segundos entre ações para manter o combo
- Multiplicador progressivo: `1 + (count - 1) × 0.5` → x1.0, x1.5, x2.0, x2.5, ...
- Stacking com a escalação clássica de fantasmas (200 × 2^n × comboMultiplier)
- Display visual: "COMBO xN.N" no canto superior + barra de tempo amarela
- Fade-out do indicador no último segundo da janela
- Som de combo com pitch crescente por nível

#### ⚙️ Menu de Configurações
- Modal overlay com toggles para intro e som
- Seletor de dificuldade: Fácil (0.7×), Normal (1.0×), Difícil (1.3×), Extremo (1.6×)
- Persistência em `localStorage` entre sessões
- Pausa automática ao abrir, resume ao fechar
- Botão ⚙️ no game header para acesso rápido

#### 📱 Controles Mobile (D-Pad)
- Overlay de D-pad com 4 botões de direção + START + Pause
- Hold-to-repeat com `setInterval` (120ms) e cleanup adequado
- Debounce (300ms) para prevenir triple-fire (touchstart + mousedown + click)
- Detecção automática via `@media (pointer: coarse)` e `max-width: 500px`
- Canvas responsivo com `max-width: 100%; height: auto`
- Compatível com touch, mouse e click (para testes automatizados)

#### 👻 Efeitos Visuais por Tier
- `_getGhostVisualTier()` reutiliza `_getGhostAIConfig().tier`
- Tier 2+ (nível 2-3): Brilho sutil no corpo dos fantasmas (glow aura)
- Tier 3+ (nível 4-6): Sombra pulsante, olhos com glow azul
- Tier 4 (nível 7+): Olhos vermelhos pulsantes, afterimage/trail, glow intenso
- Trail: 4 snapshots com fade, throttle de 50ms, limpeza em fright/house

#### 🎵 Sons Adicionais
- `Audio.combo(level)` — jingle com pitch crescente por nível do combo
- `Audio.celebrate()` — fanfarra festiva prolongada para high scores
- `Audio.ready()` — jingle curto entre níveis
- `Audio.modeSwitch()` — tom sutil para alternância scatter/chase
- Total: 14+ efeitos sonoros sintetizados via Web Audio API

#### 📋 Tela de Pausa Aprimorada
- Canvas-renderizado (não HTML overlay)
- Stats ao vivo: Score, Nível, Vidas, Combo, Dots comidos/total
- Mini leaderboard: top 5 scores da API com medalhas (🥇🥈🥉)
- Destaque do score atual em dourado
- Fetch assíncrono ao pausar (`_fetchPauseScores()`)

#### 📝 Documentação
- README.md revisado com roadmap de versões (v0.9 → v1.0 → v2.0)
- Changelog detalhado com todas as funcionalidades
- CONTRIBUTING.md com guia de desenvolvimento e convenções
- LICENSE (MIT) como arquivo separado

### Changed
- `drawGhost()` reescrito com suporte a 4 tiers de efeitos visuais
- `drawGhostEyes()` reescrito com glow e pupilas pulsantes
- `togglePause()` agora renderiza no canvas e busca leaderboard
- `init()` e `startLevel()` verificam `settings.introEnabled` antes de intro
- `Audio._muted` sincronizado a cada frame com `settings.soundEnabled`

### Fixed
- `_getGhostVisualTier()` agora reutiliza `_getGhostAIConfig().tier` em vez de duplicar lógica
- Trail de fantasmas usa throttle baseado em tempo (50ms) em vez de `now % 3`

---

## [1.0.0] - 2025-06-28

### Fixed

#### 🐛 FIX 1 — Movimento Target-Based
- **Problema:** Movimento baseado em tileSize causava flutuantes residuais e movimento irregular
- **Solução:** Reescrito como sistema target-based — cada entidade calcula o centro do próximo tile e interpola a posição ao longo do tempo
- **Impacto:** Movimento suave e preciso para Pac-Man e fantasmas

#### 🐛 FIX 2 — Buffer de Direção
- **Problema:** Input direto por keydown perdia inputs em cruzamentos rápidos
- **Solução:** Implementado buffer de direção — cada keydown enfileira uma direção (`inputQueue`), consumida uma por frame quando a entidade está alinhada ao tile
- **Impacto:** Controles responsivos e precisos, mesmo em alta velocidade

#### 🐛 FIX 3 — Geometria da Ghost House
- **Problema:** Ghost house tinha geometria incorreta — fantasmas não conseguiam sair
- **Solução:** Corredor de saída em coluna 10 (linhas 8-12 → EMPTY) e corredor horizontal interno na linha 10
- **Impacto:** Fantasmas saem da casa corretamente um de cada vez

### Added

#### 👻 4 Fantasmas com IA Completa
- **Blinky** (vermelho): Persegue tile do Pac-Man com antecipação crescente
- **Pinky** (rosa): Mira N tiles à frente do Pac-Man (flanco em tier 4)
- **Inky** (ciano): Usa Blinky como referência com pivot (IA complexa)
- **Clyde** (laranja): Persegue quando longe, scatter quando perto
- Ciclo Scatter/Chase com timings progressivos por nível
- Tier system (4 tiers) com comportamento de IA crescente

#### 🍎 Sistema de Frutas
- 6 frutas: 🍒 Cherry (100pts), 🍓 Morango (300pts), 🍊 Laranja (500pts), 🍎 Maçã (700pts), 🍈 Melão (1000pts + Speed), 🍫 Foguete (2000pts + Shield)
- Spawn condicional ao número de dots comidos
- Timer de visibilidade (10 segundos)
- Efeito de pulso quando prestes a desaparecer

#### ⚡ Power-ups
- **Speed Up** (🍈): Velocidade do Pac-Man ×1.5 por 5 segundos
- **Shield** (🚀): Invencível (ignora colisão com fantasmas) por 4 segundos
- Efeito visual de glow durante power-ups ativos

#### 💾 Save/Resume
- Auto-save em: pause, nível completo, game over
- Restauração completa: mapa, score, vidas, dots, fruit index, modo scatter/chase
- `resumeGame()` recria entidades e retoma de onde parou
- Detecção de save existente na tela IDLE (opção continuar ou novo jogo)

#### 📈 Progressão de Nível
- Tabela de velocidades por nível (Pac-Man + 4 fantasmas)
- IA escala por tiers (1-4) baseado no nível
- Scatter phases mais curtos em tiers altos
- Intro animada com configuração por tier

#### 🎵 10+ Sons Sintetizados
- Chomp, Power pellet, Eat ghost, Eat fruit, Death, Game start
- Level complete, Ready, Mode switch, Intro, Celebrate, Power-up
- Sistema de áudio com Web Audio API (sem arquivos externos)

#### 🏅 High Score
- Submissão autenticada via API
- Tela de celebração com confete para top 10
- Animação de troféu e ranking

#### 🔄 Túneis
- Wrap-around horizontal funcional nas bordas do mapa
- Velocidade reduzida no túnel (comportamento clássico)

### Changed
- `Entity` reescrita com target-based movement + buffered direction
- `Game` reescrita com máquina de estados completa (IDLE/INTRO/READY/PLAYING/DYING/GAMEOVER/WIN/PAUSED/INTERMISSION/NEWHIGHSCORE)
- Mapa corrigido com ghost house funcional
- Velocidades por nível com tabela progressiva

---

## [0.9.0] - 2025-06-28

### Added (Estado Inicial)

#### 🎮 Jogo Básico
- Mapa 21×21 com paredes, pastilhas e power pellets
- Pac-Man controlado por setas do teclado
- 2 fantasmas (Blinky + Pinky) com IA básica
- Power pellets que ativam modo fright
- Sistema de vidas (3 iniciais)
- Pontuação: 10 (dot), 50 (power), 200-1600 (fantasmas)

#### 🔐 Autenticação
- Login e registro por e-mail + senha
- bcrypt com cost factor 12
- Tokens de sessão (32 bytes hex)
- SQL Injection protegido (prepared statements)

#### 🏅 High Scores
- GET /api/scores — top 10
- POST /api/scores — submissão autenticada
- Ordenação decrescente por pontuação

#### 🐳 Docker
- Dockerfile com Node.js Alpine
- Docker Compose para orquestração
- SQLite persistido via volume bind

### Known Issues (resolvidos na v1.0)
- Movimento baseado em tileSize causava flutuantes residuais
- Input direto perdia inputs em cruzamentos rápidos
- Ghost house tinha geometria incorreta
- Apenas 2 fantasmas (Inky e Clyde ausentes)
- Sem scatter/chase cycle
- Sem frutas
- Sem save/resume
- Sem configurações
- Sem controles mobile
- 2-3 sons básicos

---

## Referências

- [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/)
- [Semantic Versioning](https://semver.org/lang/pt-BR/)
