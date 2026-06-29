/* ===========================================================
   PAC-MAN RETRÔ — Motor Completo
   Inclui: Web Audio API (sons sintetizados),
   mapa 21×21, 2 fantasmas com IA, pontuação, autenticação.
   =========================================================== */

// ─── CONSTANTES ─────────────────────────────────────────────
const COLS = 21;
const ROWS = 21;
const TS   = 20; // tile size (px)
const W    = COLS * TS; // 420
const H    = ROWS * TS; // 420

const TILE = {
  EMPTY: 0, WALL: 1, DOT: 2, POWER: 3, GHOUSE: 4, DOOR: 5
};

const DIR = {
  up:    { dx:  0, dy: -1, name: 'up'    },
  down:  { dx:  0, dy:  1, name: 'down'  },
  left:  { dx: -1, dy:  0, name: 'left'  },
  right: { dx:  1, dy:  0, name: 'right' }
};
const DIR_LIST = [DIR.up, DIR.down, DIR.left, DIR.right];
const DIR_REV  = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ─── CICLO SCATTER/CHASE (timings por nível em segundos) ───
// Cada entrada: [scatter, chase, scatter, chase, scatter, chase, scatter, chase_infinito]
const SCATTERCHASE_BY_LEVEL = [
  [7, 20, 7, 20, 5, 20, 5, Infinity],  // Nível 1
  [7, 20, 7, 20, 5, 20, 5, Infinity],  // Nível 2
  [7, 20, 7, 20, 5, 20, 5, Infinity],  // Nível 3
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 4-6
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 7-9
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 10-12
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 13-15
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 16-18
  [5, 20, 5, 20, 5, 17, 5, Infinity],  // Nível 19+
];


// ─── FRUTAS (aparecem após X dots comidos) ────────────────
const FRUITS = [
  { emoji: '🍒', points: 100,  afterDots: 70  },
  { emoji: '🍓', points: 300,  afterDots: 170 },
  { emoji: '🍊', points: 500,  afterDots: 70  },
  { emoji: '🍎', points: 700,  afterDots: 170 },
  { emoji: '🍈', points: 1000, afterDots: 70,  powerUp: 'speed' },
  { emoji: '🚀', points: 2000, afterDots: 170, powerUp: 'shield' },
];
const POWERUP_SPEED_MULT = 1.5;  // Multiplicador de velocidade no speed boost
const POWERUP_SPEED_DURATION = 5; // Duração do speed boost (segundos)
const POWERUP_SHIELD_DURATION = 4; // Duração do escudo invencível (segundos)
const FRUIT_COL = 10;
const FRUIT_ROW = 9;

// ─── TABELA DE VELOCIDADES POR NÍVEL ──────────────────────
// Blinky fica mais rápido em níveis altos (comportamento clássico)
// Valores em tiles/segundo. Pac-Man sempre levemente mais rápido.
const SPEED_TABLE = [
  { pacman: 5.5, blinky: 5.0, pinky: 5.0, inky: 5.0, clyde: 5.0 },   // Nível 1
  { pacman: 5.7, blinky: 5.4, pinky: 5.2, inky: 5.1, clyde: 5.1 },   // Nível 2
  { pacman: 5.9, blinky: 5.7, pinky: 5.4, inky: 5.3, clyde: 5.2 },   // Nível 3
  { pacman: 6.1, blinky: 6.0, pinky: 5.6, inky: 5.5, clyde: 5.3 },   // Nível 4
  { pacman: 6.3, blinky: 6.3, pinky: 5.8, inky: 5.7, clyde: 5.4 },   // Nível 5
  { pacman: 6.5, blinky: 6.5, pinky: 6.0, inky: 5.9, clyde: 5.5 },   // Nível 6-7
  { pacman: 6.8, blinky: 6.8, pinky: 6.2, inky: 6.1, clyde: 5.7 },   // Nível 8-9
  { pacman: 7.0, blinky: 7.0, pinky: 6.5, inky: 6.3, clyde: 5.9 },   // Nível 10-11
  { pacman: 7.2, blinky: 7.2, pinky: 6.7, inky: 6.5, clyde: 6.1 },   // Nível 12-13
  { pacman: 7.5, blinky: 7.5, pinky: 7.0, inky: 6.7, clyde: 6.3 },   // Nível 14+
];
const GHOST_FRIGHT_SPEED = 3.0;   // Velocidade dos fantasmas com medo
const GHOST_TUNNEL_SPEED = 2.5;   // Velocidade reduzida no túnel
const GHOST_EYES_SPEED_MULT = 2.5; // Multiplicador dos olhos voltando à casa

/** Retorna velocidades do nível atual (com cap na última entrada da tabela) */
function getSpeeds(level) {
  const i = Math.min(level - 1, SPEED_TABLE.length - 1);
  const s = SPEED_TABLE[i];
  return { pacman: s.pacman, blinky: s.blinky, pinky: s.pinky, inky: s.inky, clyde: s.clyde };
}

/** Fantasmas estão no túnel — única row com bordas EMPTY (row 7) */
function isInTunnel(col, row) {
  return (col <= 5 || col >= 15) && row === 7;
}

// ─── MAPA 21×21 ─────────────────────────────────────────────
// FIX 3 — Geometria da Casa dos Fantasmas:
// Corredor de saída em coluna 10 (linhas 8-12 → EMPTY).
// Corredor horizontal interno na linha 10 (cols 10-12 → EMPTY).
const RAW_MAP = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,1,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,1,1,2,1,2,1,1,1,2,1,1,1,2,1],
  [1,3,2,2,2,2,2,2,2,2,0,2,2,2,2,2,2,2,2,3,1],
  [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,1,2,2,2,0,2,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,1,1,0,1,0,1,1,1,2,1,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,1,2,1,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,1,0,1,1,0,1,2,1,1,1,1,1],
  [0,0,0,0,0,2,0,0,1,4,4,4,4,1,0,0,2,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,0,0,4,1,0,1,2,1,1,1,1],
  [0,0,0,0,0,2,0,0,1,4,0,0,4,1,0,0,2,0,0,0,0],
  [1,1,1,1,1,2,1,0,1,4,4,4,4,1,0,1,2,1,1,1,1],
  [0,0,0,0,1,2,1,0,0,0,0,0,0,0,0,1,2,1,0,0,0],
  [1,1,1,1,1,2,1,0,1,1,1,1,1,1,0,1,2,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,0,2,2,2,2,2,2,2,2,2,1],
  [1,2,1,1,1,2,1,2,1,1,1,1,1,2,1,2,1,1,1,2,1],
  [1,2,2,2,2,2,1,2,2,2,0,2,2,2,1,2,2,2,2,2,1],
  [1,1,1,1,1,2,1,2,1,2,1,2,1,2,1,2,1,1,1,1,1],
  [1,2,2,2,2,2,2,2,2,2,0,2,2,2,2,2,2,2,2,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

// ─── SISTEMA DE ÁUDIO (Web Audio API) ──────────────────────
const Audio = {
  ctx: null,

  init() {
    try {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
    } catch (_) { /* fallback silencioso */ }
  },

  _muted: false,

  _tone(freq, dur, type, vol = 0.08) {
    if (!this.ctx || this._muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t);
    o.stop(t + dur);
  },

  chomp() {
    this._tone(320, 0.06, 'square', 0.07);
    setTimeout(() => this._tone(480, 0.06, 'square', 0.07), 50);
  },

  powerPellet() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(680, t + 0.35);
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 0.35);
  },

  eatGhost() {
    this._tone(700, 0.08, 'square', 0.10);
    setTimeout(() => this._tone(1100, 0.12, 'square', 0.10), 80);
  },

  death() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 1.0);
    g.gain.setValueAtTime(0.10, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + 1.0);
  },

  gameStart() {
    [260, 330, 390, 520].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.18, 'square', 0.07), i * 180);
    });
  },

  eatFruit() {
    // Arpejo ascendente alegre — distinto de eatGhost
    [520, 660, 780, 1040].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.10, 'sine', 0.08), i * 60);
    });
  },

  powerUp() {
    // Jingle de power-up — mais impressionante
    [440, 660, 880, 1100, 1320].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.12, 'square', 0.08), i * 70);
    });
  },

  levelComplete() {
    // Fanfarra mais longa e celebratória
    [520, 660, 780, 1040, 1320, 1560].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.15, 'square', 0.07), i * 110);
    });
  },

  ready() {
    // Jingle curto para tela READY entre níveis
    [440, 550, 660].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.12, 'triangle', 0.08), i * 100);
    });
  },

  modeSwitch() {
    // Tom sutil para alternância scatter/chase
    this._tone(330, 0.08, 'sine', 0.06);
    setTimeout(() => this._tone(440, 0.08, 'sine', 0.06), 60);
  },

  intro() {
    // Fanfarra de intro: ascende e depois um "waka waka"
    [260, 330, 390, 520, 390, 330].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.15, 'square', 0.07), i * 150);
    });
  },

  celebrate() {
    // Fanfarra de comemoração — mais festiva e prolongada
    [520, 660, 780, 1040, 780, 1040, 1320, 1560].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.15, 'square', 0.09), i * 90);
    });
    // Notas extras brilhantes
    setTimeout(() => {
      [1560, 1760, 2080].forEach((f, i) => {
        setTimeout(() => this._tone(f, 0.2, 'sine', 0.07), i * 120);
      });
    }, 750);
  },

  combo(level) {
    // Jingle de combo — pitch sobe com o nível do combo
    const base = 400 + level * 80;
    [base, base * 1.25, base * 1.5].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.1, 'square', 0.08), i * 50);
    });
  }
};

// ─── CLASSE ENTIDADE (Pac-Man / Fantasma) ──────────────────
// FIX 1 & 2 — Movimento target-based + buffer de direção
class Entity {
  constructor(col, row, speed) {
    this.col = col;
    this.row = row;
    this.px = col * TS + TS / 2;
    this.py = row * TS + TS / 2;
    this.dir    = 'right';
    this.speed  = speed;       // tiles / segundo
    this.moving = false;
    this.targetX = this.px;    // alvo em pixels (centro do próximo tile)
    this.targetY = this.py;
    this.bufferedDir = null;   // FIX 2 — direção enfileirada
  }

  /** Centro do tile atual */
  center() {
    return { x: this.col * TS + TS / 2, y: this.row * TS + TS / 2 };
  }

  /** Distância Manhattan até um tile */
  distTo(tc, tr) {
    return Math.abs(this.col - tc) + Math.abs(this.row - tr);
  }

  /** Alinhado ao centro do tile (tolerância 1 px) */
  atCenter() {
    return Math.abs(this.px - this.targetX) < 1.5 &&
           Math.abs(this.py - this.targetY) < 1.5;
  }

  /** Verifica se um tile é transitável */
  canMoveTo(col, row, map, isGhost) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const t = map[row][col];
    if (t === TILE.WALL) return false;
    if (!isGhost && (t === TILE.GHOUSE || t === TILE.DOOR)) return false;
    return true;
  }

  /** Calcula tiles vizinhos passáveis (exclui reverso) */
  getValidMoves(map, isGhost) {
    const rev = DIR_REV[this.dir];
    return DIR_LIST.filter(d => {
      if (d.name === rev) return false;
      return this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost);
    });
  }

  /** Verifica se a row é um túnel (bordas EMPTY) */
  _isTunnelRow(row, map) {
    return row >= 0 && row < ROWS &&
           map[row][0] !== TILE.WALL &&
           map[row][COLS - 1] !== TILE.WALL;
  }

  /**
   * FIX 1 — Movimento target-based clássico:
   * Acumula deslocamento em direção ao target (centro do próximo tile).
   * Ao alcançar o target, atualiza col/row e escolhe a próxima rota.
   */
  step(dt, map, isGhost) {
    const d = DIR[this.dir];
    if (!d) { this.moving = false; return true; }

    // Túneis: teletransporta para o lado oposto se estiver na entrada
    if (this.dir === 'left' && this.col === 0 && this._isTunnelRow(this.row, map)) {
      this.col = COLS - 1;
      this.px = this.col * TS + TS / 2;
      this.targetX = this.px;
    } else if (this.dir === 'right' && this.col === COLS - 1 && this._isTunnelRow(this.row, map)) {
      this.col = 0;
      this.px = this.col * TS + TS / 2;
      this.targetX = this.px;
    }

    const nc = this.col + d.dx;
    const nr = this.row + d.dy;

    if (!this.canMoveTo(nc, nr, map, isGhost)) {
      this.moving = false;
      // Snap ao centro do tile atual — elimina flutuantes residuais
      const c = this.center();
      this.px = c.x;
      this.py = c.y;
      this.targetX = c.x;
      this.targetY = c.y;
      // Aplica buffer se disponível
      this._applyBuffer(map, isGhost);
      return false;
    }

    // Define target ao centro do tile adjacente
    this.targetX = nc * TS + TS / 2;
    this.targetY = nr * TS + TS / 2;
    this.moving = true;

    // Move suavemente em direção ao target
    const pixelsPerSec = this.speed * TS;
    const stepPx = pixelsPerSec * dt;

    const diffX = this.targetX - this.px;
    const diffY = this.targetY - this.py;
    const dist  = Math.sqrt(diffX * diffX + diffY * diffY);

    if (dist <= stepPx) {
      // Chegou ao target — snap exato, sem resíduo flutuante
      this.px = this.targetX;
      this.py = this.targetY;
      this.col = nc;
      this.row = nr;
    } else {
      this.px += (diffX / dist) * stepPx;
      this.py += (diffY / dist) * stepPx;
    }

    // Túneis (wrap horizontal nas bordas)
    if (this.px < -TS / 2) {
      this.px += W + TS;
      this.targetX = this.col * TS + TS / 2;
    } else if (this.px > W + TS / 2) {
      this.px -= W + TS;
      this.targetX = this.col * TS + TS / 2;
    }

    return true;
  }

  /** FIX 2 — Tenta aplicar direção enfileirada no próximo cruzamento */
  _applyBuffer(map, isGhost) {
    if (!this.bufferedDir) return;
    const d = DIR[this.bufferedDir];
    if (!d) { this.bufferedDir = null; return; }
    if (this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost)) {
      this.dir = this.bufferedDir;
      this.bufferedDir = null;
      this.moving = true;
      // Recalcula target imediatamente
      this.targetX = (this.col + d.dx) * TS + TS / 2;
      this.targetY = (this.row + d.dy) * TS + TS / 2;
    } else {
      this.bufferedDir = null;
    }
  }

  /** FIX 2 — Enfileira direção para aplicação futura */
  setBufferedDir(newDir, map, isGhost) {
    this.bufferedDir = newDir;
    // Se já parado no centro, aplica imediatamente
    if (this.atCenter()) {
      this._applyBuffer(map, isGhost);
    }
  }
}

// ─── CLASSE PRINCIPAL DO JOGO ──────────────────────────────
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = [];
    this.pacman = null;
    this.ghosts = [];
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.state = 'IDLE';     // IDLE | INTRO | PLAYING | DYING | GAMEOVER | WIN | PAUSED | INTERMISSION | NEWHIGHSCORE
    this.dotsTotal = 0;
    this.dotsEaten = 0;
    this.frightTimer = 0;
    this.frightDuration = 6;
    this.ghostEatCombo = 0;
    this.spawnTimer = 0;
    this.overlayEl = document.getElementById('game-overlay');
    this.overlayText = document.getElementById('overlay-text');
    this.overlayHint = document.getElementById('overlay-hint');
    this.inputQueue = [];    // FIX 2 — fila de inputs por frame
    this.scorePopups = [];   // Pontos flutuantes ao comer fantasmas
    this.modeTimer = 0;      // Timer do ciclo scatter/CHASE
    this.modeIndex = 0;      // Índice atual no SCATTERCHASE_TIMINGS
    this._savedModeIndex = 0;
    this._savedModeTimer = 0;
    this.fruit = null;        // Fruta ativa no mapa
    this.fruitTimer = 0;     // Tempo restante da fruta
    this.fruitIndex = 0;     // Próxima fruta a aparecer
    this.fruitScoreTimer = 0;
    this._readySoundPlayed = false;
    this.powerUpSpeedTimer = 0;    // Timer do speed boost
    this.powerUpShieldTimer = 0;   // Timer do escudo invencível
    this.powerUpSpeedActive = false;
    this.powerUpShieldActive = false;
    this.lastTime = 0;
    this.animFrame = null;
    this.dyingTimer = 0;
    this.winTimer = 0;
    this.readyTimer = 0;
    this.intermissionTimer = 0;
    this.introTimer = 0;
    this.introPhase = 0;     // Fase da animação de intro
    this.introParticles = [];
    this.highScoreTimer = 0;
    this.highScoreRank = 0;  // Posição no ranking (1-10)
    this.highScoreParticles = []; // Partículas de confete
    this.comboTimer = 0;      // Timer do combo (janela para próxima comida)
    this.comboCount = 0;      // Contagem de comidas consecutivas
    this.comboMultiplier = 1; // Multiplicador atual
    this._pauseScores = [];   // Top scores para tela de pausa
    this.settings = this._loadSettings();
  }

  /** Reinicia o mapa e entidades para um novo jogo */
  init(level = 1) {
    this.level = level;
    this.map = RAW_MAP.map(r => [...r]);
    this.score = 0;
    this.lives = 3;
    this.dotsEaten = 0;
    this.frightTimer = 0;
    this.ghostEatCombo = 0;
    this.spawnTimer = 0;
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.fruit = null;
    this.fruitTimer = 0;
    this.fruitIndex = 0;
    this.fruitScoreTimer = 0;
    this.powerUpSpeedTimer = 0;
    this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false;
    this.powerUpShieldActive = false;
    this.comboTimer = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;

    this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER)
          this.dotsTotal++;

    // Velocidades por nível
    const spd = getSpeeds(level);

    // Pac-Man (posição inicial: linha 15, coluna 10)
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';

    // Fantasmas — Blinky & Clyde fora, Pinky & Inky dentro da casa
    this.ghosts = [
      { e: new Entity(10, 9,  spd.blinky), color: '#ff0000', name: 'blinky', scatter: { x: 20, y: 0  }, mode: 'house', baseSpeed: spd.blinky },
      { e: new Entity(10, 11, spd.pinky),  color: '#ffb8ff', name: 'pinky',  scatter: { x: 0,  y: 0  }, mode: 'house', baseSpeed: spd.pinky },
      { e: new Entity(11, 11, spd.inky),   color: '#00ffff', name: 'inky',   scatter: { x: 20, y: 20 }, mode: 'house', baseSpeed: spd.inky },
      { e: new Entity(9,  11, spd.clyde),  color: '#ffb851', name: 'clyde',  scatter: { x: 0,  y: 20 }, mode: 'house', baseSpeed: spd.clyde }
    ];

    this.state = 'INTRO';
    this.introTimer = this._getIntroConfig().duration;
    this.introPhase = 0;
    this.introParticles = [];
    this.hideOverlay(false);
    if (this.settings.introEnabled) Audio.intro();

    this.lastTime = 0;
    this.inputQueue = [];
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._initSettingsUI();
    this.loop(0);
  }

  /** Inicia uma nova partida sem resetar score / vidas */
  startLevel() {
    this.map = RAW_MAP.map(r => [...r]);
    this.dotsEaten = 0;
    this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER)
          this.dotsTotal++;
    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';
    const ghostSpeeds = [spd.blinky, spd.pinky, spd.inky, spd.clyde];
    this.ghosts.forEach((g, i) => {
      const pos = [
        { col: 10, row: 9 },
        { col: 10, row: 11 },
        { col: 11, row: 11 },
        { col: 9,  row: 11 }
      ][i];
      g.e = new Entity(pos.col, pos.row, ghostSpeeds[i]);
      g.baseSpeed = ghostSpeeds[i];
      g.mode = 'house';
    });
    this.frightTimer = 0;
    this.spawnTimer = 0;
    this.scorePopups = [];
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.fruit = null;
    this.fruitTimer = 0;
    this.fruitIndex = 0;
    this.fruitScoreTimer = 0;
    this.powerUpSpeedTimer = 0;
    this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false;
    this.powerUpShieldActive = false;
    this.comboTimer = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
    // READY screen entre níveis
    // Intro para níveis > 1 (tier-based)
    this.settings = this._loadSettings();
    if (this.level > 1 && this.settings.introEnabled) {
      this.state = 'INTRO';
      this.introTimer = this._getIntroConfig().duration;
      this.introPhase = 0;
      this.introParticles = [];
      this.hideOverlay(false);
      Audio.intro();
    } else {
      this.state = 'READY';
      this.readyTimer = 2.0;
      this._readySoundPlayed = false;
    }
    this.intermissionTimer = 0;
  }

  /** Mostra overlay */
  showOverlay(text, hint = '') {
    this.overlayText.textContent = text;
    this.overlayHint.textContent = hint;
    if (this.overlayEl) this.overlayEl.classList.add('show');
  }

  hideOverlay(immediate) {
    if (immediate) {
      this.overlayEl.classList.remove('show');
    }
  }

  // ── Loop principal ────────────────────────────────────────
  loop = (time) => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time;

    this.update(dt);
    this.render();

    this.animFrame = requestAnimationFrame(this.loop);
  }

  // ── Update ────────────────────────────────────────────────
  togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED';
      this._saveGame(); // auto-save ao pausar
      this.hideOverlay(true);
      this._fetchPauseScores(); // busca leaderboard para a tela de pausa
    } else if (this.state === 'PAUSED') {
      this.hideOverlay(true);
      this.state = 'PLAYING';
      this.inputQueue = [];
    }
  }

  /** Busca top 5 scores para a tela de pausa */
  async _fetchPauseScores() {
    try {
      const res = await fetch('/api/scores?limit=5');
      this._pauseScores = await res.json();
    } catch (_) { this._pauseScores = []; }
  }

  /** Renderiza a tela de pausa no canvas */
  _renderPause(ctx) {
    const cx = W / 2;

    // Fundo escuro semi-transparente
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);

    // Título
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSADO', cx, 40);

    // Linha separadora
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(30, 60); ctx.lineTo(W - 30, 60);
    ctx.stroke();

    // ── STATS ATUAIS ──
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.fillText('ESTATÍSTICAS', cx, 78);

    const stats = [
      { label: '🏆 Score', value: String(this.score), color: '#ffcc00' },
      { label: '🎯 Nível', value: String(this.level), color: '#44aaff' },
      { label: '❤️ Vidas', value: String(this.lives), color: '#ff4444' },
      { label: '🔥 Combo', value: this.comboCount > 1 ? `x${this.comboMultiplier.toFixed(1)} (${this.comboCount})` : '—', color: '#ff6644' },
      { label: '👻 Dots', value: `${this.dotsEaten}/${this.dotsTotal}`, color: '#ffb8ae' },
    ];

    let sy = 98;
    stats.forEach(s => {
      ctx.fillStyle = '#777';
      ctx.font = '12px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(s.label, 40, sy);
      ctx.fillStyle = s.color;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(s.value, W - 40, sy);
      sy += 22;
    });

    // Linha separadora
    sy += 4;
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(30, sy); ctx.lineTo(W - 30, sy);
    ctx.stroke();
    sy += 16;

    // ── LEADERBOARD ──
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('🏅 TOP SCORES', cx, sy);
    sy += 18;

    const scores = this._pauseScores || [];
    if (!scores.length) {
      ctx.fillStyle = '#555';
      ctx.font = '11px monospace';
      ctx.fillText('Nenhuma pontuação', cx, sy + 10);
    } else {
      const medals = ['🥇', '🥈', '🥉'];
      scores.forEach((s, i) => {
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        const isCurrent = s.score === this.score;
        ctx.fillStyle = isCurrent ? '#ffcc00' : '#888';
        ctx.font = `${isCurrent ? 'bold ' : ''}12px monospace`;
        ctx.textAlign = 'left';
        ctx.fillText(`${medal} ${String(s.score).padStart(6, ' ')}`, 50, sy);
        ctx.fillStyle = isCurrent ? '#ffcc00' : '#555';
        ctx.font = '10px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(s.player_email || '', W - 50, sy);
        sy += 18;
      });
    }

    // Dica na base
    ctx.fillStyle = '#666';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('P para continuar  •  ⚙️ Configurações', cx, H - 20);
  }

  update(dt) {
    if (this.state === 'PAUSED') return;

    // Cache config de IA (evita recriar objeto a cada frame)
    this._aiConfig = this._getGhostAIConfig();

    // ── INTRO: animação de abertura ──
    if (this.state === 'INTRO') {
      const cfg = this._getIntroConfig();
      this.introTimer -= dt;
      this._updateIntroParticles(dt);
      // Fases da animação (timing baseado na config)
      if (this.introTimer <= cfg.phase1At && this.introPhase === 0) this.introPhase = 1;
      if (this.introTimer <= cfg.phase2At && this.introPhase === 1) this.introPhase = 2;
      if (this.introTimer <= 0) {
        this._finishIntro();
      }
      return;
    }

    if (this.state === 'READY') {
      this.readyTimer -= dt;
      // Toca jingle quando entra em READY (primeiro frame)
      if (!this._readySoundPlayed) { Audio.ready(); this._readySoundPlayed = true; }
      if (this.readyTimer <= 0) {
        this.state = 'PLAYING';
        this.spawnTimer = 0;
      }
      return;
    }

    if (this.state === 'DYING') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this._clearSave(); // limpa save no game over
          this.showOverlay('GAME OVER', 'Pressione ESPAÇO');
          this.submitScore();
          const binder = (e) => {
            if (e.code === 'Space') {
              document.removeEventListener('keydown', binder);
              this.init(1);
            }
          };
          document.addEventListener('keydown', binder);
        } else {
          this.state = 'READY';
          this.readyTimer = 1.0;
          this._readySoundPlayed = false;
          this.respawnEntities();
        }
      }
      return;
    }

    if (this.state === 'WIN') {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.level++;
        this._saveGame(); // auto-save após incrementar nível
        this.state = 'INTERMISSION';
        this.intermissionTimer = 3.0;
        this.hideOverlay(true);
      }
      return;
    }

    if (this.state === 'INTERMISSION') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) {
        this.startLevel();
      }
      return;
    }

    // ── NEWHIGHSCORE: tela de celebração ──
    if (this.state === 'NEWHIGHSCORE') {
      this.highScoreTimer -= dt;
      // Atualiza partículas de confete
      this._updateHighScoreParticles(dt);
      if (this.highScoreTimer <= 0) {
        this.state = 'GAMEOVER';
        this._clearSave(); // limpa save no game over
        this.showOverlay('GAME OVER', 'Pressione ESPAÇO');
        const binder = (e) => {
          if (e.code === 'Space') {
            document.removeEventListener('keydown', binder);
            this.init(1);
          }
        };
        document.addEventListener('keydown', binder);
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    // ── FIX 2 — Input: consome a fila enfileirada ──
    for (const dir of this.inputQueue) {
      this.pacman.setBufferedDir(dir, this.map, false);
    }
    this.inputQueue = [];

    // ── Combo timer ──
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) {
        this.comboCount = 0;
        this.comboMultiplier = 1;
      }
    }

    // ── Power-up timers ──
    if (this.powerUpSpeedTimer > 0) {
      this.powerUpSpeedTimer -= dt;
      if (this.powerUpSpeedTimer <= 0) {
        this.powerUpSpeedActive = false;
        this.pacman.speed = getSpeeds(this.level).pacman;
      }
    }
    if (this.powerUpShieldTimer > 0) {
      this.powerUpShieldTimer -= dt;
      if (this.powerUpShieldTimer <= 0) {
        this.powerUpShieldActive = false;
      }
    }

    // ── Move Pac-Man ──
    this.pacman.step(dt, this.map, false);

    // ── Check dot eating ──
    const tileCol = Math.round((this.pacman.px - TS / 2) / TS);
    const tileRow = Math.round((this.pacman.py - TS / 2) / TS);
    if (tileCol >= 0 && tileCol < COLS && tileRow >= 0 && tileRow < ROWS) {
      const t = this.map[tileRow][tileCol];
      if (t === TILE.DOT) {
        this.map[tileRow][tileCol] = TILE.EMPTY;
        this.score += 10;
        this.dotsEaten++;
        Audio.chomp();
        this.updateUI();
      } else if (t === TILE.POWER) {
        this.map[tileRow][tileCol] = TILE.EMPTY;
        this.score += 50;
        this.dotsEaten++;
        this.activateFrightMode();
        Audio.powerPellet();
        this.updateUI();
      }
    }

    // ── Fruta: spawna após X dots ──
    if (this.fruitIndex < FRUITS.length && !this.fruit) {
      const next = FRUITS[this.fruitIndex];
      if (this.dotsEaten >= next.afterDots) {
        this.fruit = next;
        this.fruitTimer = 10; // 10 segundos visível
        this.fruitIndex++;
      }
    }
    if (this.fruit) {
      this.fruitTimer -= dt;
      if (this.fruitTimer <= 0) {
        this.fruit = null;
      } else {
        // Colisão com Pac-Man (tolerância baseada em pixels)
        const fx = FRUIT_COL * TS + TS / 2;
        const fy = FRUIT_ROW * TS + TS / 2;
        const dx = Math.abs(this.pacman.px - fx);
        const dy = Math.abs(this.pacman.py - fy);
        if (dx < TS * 0.7 && dy < TS * 0.7) {
          this.comboCount++;
          this.comboTimer = 3.0;
          this.comboMultiplier = 1 + (this.comboCount - 1) * 0.5;
          const fruitPts = Math.round(this.fruit.points * this.comboMultiplier);
          this.score += fruitPts;
          const label = this.comboCount > 1 ? `${fruitPts} x${this.comboMultiplier.toFixed(1)}!` : String(fruitPts);
          this._addScorePopup(fx, fy - 10, label);
          // Ativa power-up se a fruta tiver
          if (this.fruit.powerUp) this._activatePowerUp(this.fruit.powerUp);
          else Audio.eatFruit();
          if (this.comboCount > 1) Audio.combo(this.comboCount);
          this.updateUI();
          this.fruit = null;
          this.fruitTimer = 0;
        }
      }
    }

    // ── Win check ──
    if (this.dotsEaten >= this.dotsTotal) {
      this.state = 'WIN';
      this.winTimer = 2.0;
      this._saveGame(); // auto-save ao completar nível
      Audio.levelComplete();
      this.showOverlay('NÍVEL COMPLETO!', 'Preparando próximo nível...');
      return;
    }

    // ── Ciclo scatter/CHASE ──
    if (this.frightTimer <= 0) {
      this.modeTimer += dt;
      const timings = SCATTERCHASE_BY_LEVEL[Math.min(this.level - 1, SCATTERCHASE_BY_LEVEL.length - 1)];
      // Tier 3+: scatter phases são mais curtos (fantasmas perseguem mais)
      let limit = timings[this.modeIndex];
      if (this._aiConfig && this._aiConfig.tier >= 3 && this.modeIndex % 2 === 0 && limit !== Infinity) {
        limit = Math.max(limit * 0.5, 2); // scatter dura metade do tempo
      }
      if (this.modeTimer >= limit) {
        this.modeTimer = 0;
        this.modeIndex = Math.min(this.modeIndex + 1, SCATTERCHASE_BY_LEVEL[0].length - 1);
        const isScatter = this.modeIndex % 2 === 0;
        Audio.modeSwitch();
        this.ghosts.forEach(g => {
          if (g.mode === 'chase' || g.mode === 'scatter') {
            g.mode = isScatter ? 'scatter' : 'chase';
            // Inverte direção ao trocar de modo (comportamento clássico)
            g.e.dir = DIR_REV[g.e.dir];
          }
        });
      }
    }

    // ── Fright timer ──
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      if (this.frightTimer <= 0) this.endFrightMode();
    }

    // ── Sincroniza mute com settings (uma vez por frame, barato) ──
    if (Audio._muted === undefined) Audio._muted = false;
    Audio._muted = !this.settings.soundEnabled;

    // ── Move fantasmas ──
    this.spawnTimer -= dt;
    this.ghosts.forEach((g, gi) => {
      if (g.mode === 'house') {
        const SPAWN_DELAYS = [0, 3, 6, 9];
        if (this.spawnTimer <= -SPAWN_DELAYS[gi]) g.mode = 'leaving';
        return;
      }

      // Olhos voltando para a casa
      if (g.mode === 'eaten') {
        this._moveEyesToHouse(g, dt);
        return;
      }

      // FIX 3 — Saída da casa: move reto para cima até sair do corredor
      if (g.mode === 'leaving') {
        if (g.e.row > 8) {
          g.e.dir = 'up';
          g.e.step(dt, this.map, true);
        } else {
          g.mode = 'chase';
        }
        return;
      }

      // IA: escolhe direção ao atingir o centro do tile
      if (g.e.atCenter()) {
        const target = this.getGhostTarget(gi);
        g.e.dir = this.chooseGhostDir(g.e, target);
        // Ajuste dinâmico de velocidade
        if (g.mode === 'fright') {
          g.e.speed = GHOST_FRIGHT_SPEED;
        } else if (isInTunnel(g.e.col, g.e.row)) {
          g.e.speed = GHOST_TUNNEL_SPEED;
        } else {
          g.e.speed = g.baseSpeed * this._getDifficultyMultiplier();
        }
      }

      g.e.step(dt, this.map, true);

      // Verifica colisão com Pac-Man (ignora durante escudo)
      if (this.checkCollision(this.pacman, g.e) && !this.powerUpShieldActive) {
        if (this.frightTimer > 0) {
          this.ghostEatCombo++;
          this.comboCount++;
          this.comboTimer = 3.0; // 3s janela de combo
          this.comboMultiplier = 1 + (this.comboCount - 1) * 0.5;
          const basePts = 200 * Math.pow(2, this.ghostEatCombo - 1);
          const pts = Math.round(basePts * this.comboMultiplier);
          this.score += pts;
          Audio.eatGhost();
          if (this.comboCount > 1) Audio.combo(this.comboCount);
          const label = this.comboCount > 1 ? `${pts} x${this.comboMultiplier.toFixed(1)}!` : String(pts);
          this._addScorePopup(g.e.px, g.e.py, label);
          this.updateUI();
          g.mode = 'eaten';
          // Olhos voltam para a entrada da casa
          g.e.dir = 'up';
        } else {
          this.pacmanDie();
          return;
        }
      }
    });
  }

  /** Retorna configuração de IA dos fantasmas baseada no nível */
  _getGhostAIConfig() {
    const lvl = this.level;
    if (lvl <= 1) {
      return {
        tier: 1,
        blinkyAhead: 0,
        pinkyAhead: 4,
        inkyPivot: 2,
        clydeThreshold: 8,
        clydeAlwaysChase: false,
        lookAheadTiles: 0,
        flankEnabled: false,
        coordinationEnabled: false,
        retreatThreshold: 10,
      };
    } else if (lvl <= 3) {
      return {
        tier: 2,
        blinkyAhead: 1,
        pinkyAhead: 5,
        inkyPivot: 3,
        clydeThreshold: 6,
        clydeAlwaysChase: false,
        lookAheadTiles: 1,
        flankEnabled: false,
        coordinationEnabled: false,
        retreatThreshold: 8,
      };
    } else if (lvl <= 6) {
      return {
        tier: 3,
        blinkyAhead: 2,
        pinkyAhead: 6,
        inkyPivot: 3,
        clydeThreshold: 4,
        clydeAlwaysChase: false,
        lookAheadTiles: 2,
        flankEnabled: true,
        coordinationEnabled: false,
        retreatThreshold: 6,
      };
    } else {
      return {
        tier: 4,
        blinkyAhead: 3,
        pinkyAhead: 7,
        inkyPivot: 4,
        clydeThreshold: 0,
        clydeAlwaysChase: true,
        lookAheadTiles: 3,
        flankEnabled: true,
        coordinationEnabled: true,
        retreatThreshold: 4,
      };
    }
  }

  getGhostTarget(gi) {
    const g = this.ghosts[gi];
    const ai = this._aiConfig || this._getGhostAIConfig();

    // Fright: foge para um canto
    if (this.frightTimer > 0) {
      const corners = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
      return corners[gi % corners.length];
    }

    // Scatter: vai para o canto designado
    if (g.mode === 'scatter') {
      // Tier 4:coordenação — se todos estão em scatter, Blinky persegue mesmo assim
      if (ai.coordinationEnabled && gi === 0) {
        return { x: this.pacman.col, y: this.pacman.row };
      }
      return g.scatter;
    }

    // Chase: IA específica de cada fantasma (tier-based)
    const p = this.pacman;
    const d = DIR[p.dir];

    switch (gi) {
      case 0: { // Blinky — persegue com antecipação crescente
        const ahead = ai.blinkyAhead;
        const dx = d ? d.dx : 0;
        const dy = d ? d.dy : 0;
        return { x: p.col + dx * ahead, y: p.row + dy * ahead };
      }

      case 1: { // Pinky — mira N tiles à frente (mais agressivo em tiers altos)
        const dx = d ? d.dx : 0;
        const dy = d ? d.dy : 0;
        // Tier 4: Pinky também calcula flanco quando Pac-Man está perto
        if (ai.flankEnabled) {
          const distToPac = g.e.distTo(p.col, p.row);
          if (distToPac < ai.retreatThreshold) {
            // Flanco: mira 2 tiles ATRÁS do Pac-Man para interceptar
            return { x: p.col - dx * 2, y: p.row - dy * 2 };
          }
        }
        return { x: p.col + dx * ai.pinkyAhead, y: p.row + dy * ai.pinkyAhead };
      }

      case 2: { // Inky — usa Blinky como referência com pivot maior
        const blinky = this.ghosts[0].e;
        const dx = d ? d.dx : 0;
        const dy = d ? d.dy : 0;
        const pivotX = p.col + dx * ai.inkyPivot;
        const pivotY = p.row + dy * ai.inkyPivot;
        // Tier 3+: Inky usa posição antecipada do Blinky
        const blinkyAhead = ai.lookAheadTiles;
        const bd = DIR[blinky.dir];
        const bTargetX = blinky.col + (bd ? bd.dx * blinkyAhead : 0);
        const bTargetY = blinky.row + (bd ? bd.dy * blinkyAhead : 0);
        return { x: pivotX * 2 - bTargetX, y: pivotY * 2 - bTargetY };
      }

      case 3: { // Clyde — persegue mais agressivamente em tiers altos
        const dist = g.e.distTo(p.col, p.row);
        if (ai.clydeAlwaysChase || dist > ai.clydeThreshold) {
          // Tier 4: Clyde mira posição futura do Pac-Man
          if (ai.coordinationEnabled) {
            const dx = d ? d.dx : 0;
            const dy = d ? d.dy : 0;
            return { x: p.col + dx * 2, y: p.row + dy * 2 };
          }
          return { x: p.col, y: p.row };
        }
        return g.scatter;
      }

      default:
        return { x: p.col, y: p.row };
    }
  }

  /** Olhos voltam para a entrada da casa (col 10, row 8) e depois respawnam */
  _moveEyesToHouse(g, dt) {
    const HOUSE_X = 10, HOUSE_Y = 8; // tile de entrada da casa
    const tx = HOUSE_X * TS + TS / 2;
    const ty = HOUSE_Y * TS + TS / 2;
    const dx = tx - g.e.px;
    const dy = ty - g.e.py;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Velocidade mais rápida para olhos
    const speed = g.baseSpeed * GHOST_EYES_SPEED_MULT * TS * dt;

    if (dist <= speed + 1) {
      // Chegou à entrada — respawn dentro da casa
      g.e.col = HOUSE_X;
      g.e.row = 11;
      g.e.px = HOUSE_X * TS + TS / 2;
      g.e.py = 11 * TS + TS / 2;
      g.e.targetX = g.e.px;
      g.e.targetY = g.e.py;
      g.mode = 'leaving';
    } else {
      g.e.px += (dx / dist) * speed;
      g.e.py += (dy / dist) * speed;
      // Atualiza direção visual dos olhos
      if (Math.abs(dx) > Math.abs(dy)) {
        g.e.dir = dx > 0 ? 'right' : 'left';
      } else {
        g.e.dir = dy > 0 ? 'down' : 'up';
      }
    }
  }

  chooseGhostDir(ghost, target) {
    const dirs = DIR_LIST.filter(d => d.name !== DIR_REV[ghost.dir]);
    let best = ghost.dir;
    let bestDist = Infinity;

    for (const d of dirs) {
      const nc = ghost.col + d.dx;
      const nr = ghost.row + d.dy;
      if (!ghost.canMoveTo(nc, nr, this.map, true)) continue;
      const dist = Math.abs(nc - target.x) + Math.abs(nr - target.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = d.name;
      }
    }
    return best;
  }

  _activatePowerUp(type) {
    if (type === 'speed') {
      this.powerUpSpeedActive = true;
      this.powerUpSpeedTimer = POWERUP_SPEED_DURATION;
      this.pacman.speed = getSpeeds(this.level).pacman * POWERUP_SPEED_MULT;
      Audio.powerUp();
      this._addScorePopup(this.pacman.px, this.pacman.py - 20, '⚡ SPEED!');
    } else if (type === 'shield') {
      this.powerUpShieldActive = true;
      this.powerUpShieldTimer = POWERUP_SHIELD_DURATION;
      Audio.powerUp();
      this._addScorePopup(this.pacman.px, this.pacman.py - 20, '🛡️ SHIELD!');
    }
  }

  activateFrightMode() {
    this.frightTimer = this.frightDuration + this.level * 0.5;
    this.ghostEatCombo = 0;
    // Pausa o ciclo scatter/CHASE
    this._savedModeIndex = this.modeIndex;
    this._savedModeTimer = this.modeTimer;
    this.ghosts.forEach(g => {
      if (g.mode === 'chase' || g.mode === 'scatter') {
        g.e.dir = DIR_REV[g.e.dir];
        g.mode = 'fright';
      }
    });
  }

  endFrightMode() {
    this.frightTimer = 0;
    // Retoma o ciclo scatter/CHASE de onde parou
    this.modeIndex = this._savedModeIndex != null ? this._savedModeIndex : this.modeIndex;
    this.modeTimer = this._savedModeTimer != null ? this._savedModeTimer : this.modeTimer;
    const isScatter = this.modeIndex % 2 === 0;
    this.ghosts.forEach(g => {
      if (g.mode === 'fright') {
        g.mode = isScatter ? 'scatter' : 'chase';
        g.e.dir = DIR_REV[g.e.dir];
      }
    });
  }

  pacmanDie() {
    this.lives--;
    this.state = 'DYING';
    this.dyingTimer = 1.5;
    Audio.death();
    this.updateUI();
  }

  respawnEntities() {
    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';
    const ghostSpeeds = [spd.blinky, spd.pinky, spd.inky, spd.clyde];
    this.ghosts.forEach((g, i) => {
      const pos = [
        { col: 10, row: 9 },
        { col: 10, row: 11 },
        { col: 11, row: 11 },
        { col: 9,  row: 11 }
      ][i];
      g.e = new Entity(pos.col, pos.row, ghostSpeeds[i]);
      g.baseSpeed = ghostSpeeds[i];
      g.mode = 'house';
    });
    this.frightTimer = 0;
    this.spawnTimer = 0;
    this.scorePopups = [];
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.fruit = null;
    this.fruitTimer = 0;
    this.fruitIndex = 0;
    this.fruitScoreTimer = 0;
    this.powerUpSpeedTimer = 0;
    this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false;
    this.powerUpShieldActive = false;
    this.comboTimer = 0;
    this.comboCount = 0;
    this.comboMultiplier = 1;
  }

  checkCollision(a, b) {
    const dx = Math.abs(a.px - b.px);
    const dy = Math.abs(a.py - b.py);
    return dx < TS * 0.7 && dy < TS * 0.7;
  }

  // ── Submit score via API ──────────────────────────────────
  async submitScore() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ score: this.score })
      });
      // Busca leaderboard e verifica se é high score
      const res = await fetch('/api/scores?limit=10');
      const scores = await res.json();
      fetchScores();
      // Verifica se o score está no top 10
      const rank = scores.findIndex(s => s.score <= this.score && s.player_email);
      if (rank >= 0 && this.score > 0) {
        // É um high score! Mostra tela de celebração
        this.highScoreRank = rank + 1;
        this.highScoreTimer = 4.0;
        this.highScoreParticles = [];
        this.state = 'NEWHIGHSCORE';
        this.hideOverlay(true);
        Audio.celebrate();
        return;
      }
    } catch (_) { /* offline */ }
  }

  // ── Render ────────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);

    // Mapa
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.map[r][c];
        const x = c * TS, y = r * TS;
        if (t === TILE.WALL) {
          ctx.fillStyle = '#2121de';
          ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
          ctx.fillStyle = '#000';
          if (r > 0 && this.map[r-1][c] === TILE.WALL) { ctx.fillRect(x+1, y, TS-2, 2); }
          if (r < ROWS-1 && this.map[r+1][c] === TILE.WALL) { ctx.fillRect(x+1, y+TS-2, TS-2, 2); }
          if (c > 0 && this.map[r][c-1] === TILE.WALL) { ctx.fillRect(x, y+1, 2, TS-2); }
          if (c < COLS-1 && this.map[r][c+1] === TILE.WALL) { ctx.fillRect(x+TS-2, y+1, 2, TS-2); }
        } else if (t === TILE.GHOUSE) {
          ctx.fillStyle = '#222';
          ctx.fillRect(x, y, TS, TS);
        } else if (t === TILE.DOOR) {
          ctx.fillStyle = '#ffb8ff';
          ctx.fillRect(x, y + TS/2 - 2, TS, 4);
        } else if (t === TILE.DOT) {
          ctx.fillStyle = '#ffb8ae';
          ctx.beginPath();
          ctx.arc(x + TS/2, y + TS/2, 2.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (t === TILE.POWER) {
          ctx.fillStyle = '#ffb8ae';
          ctx.beginPath();
          ctx.arc(x + TS/2, y + TS/2, 5 + Math.sin(Date.now() / 200) * 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // Efeito de tela durante fright mode (antes das entidades)
    if (this.frightTimer > 0) {
      const alpha = 0.06 + Math.sin(Date.now() / 150) * 0.04;
      ctx.fillStyle = `rgba(33,33,222,${alpha})`;
      ctx.fillRect(0, 0, W, H);
    }

    // Fantasmas
    this.ghosts.forEach(g => {
      if (g.mode === 'eaten') {
        this.drawGhostEyes(ctx, g);
      } else {
        if (g.mode === 'house' || g.mode === 'leaving') {
          ctx.globalAlpha = 0.5;
        }
        this.drawGhost(ctx, g);
      }
      ctx.globalAlpha = 1;
    });

    // Fruta
    if (this.fruit) {
      const fx = FRUIT_COL * TS + TS / 2;
      const fy = FRUIT_ROW * TS + TS / 2;
      // Efeito de pulso quando está prestes a desaparecer
      const pulse = this.fruitTimer < 3 ? 0.7 + Math.sin(Date.now() / 100) * 0.3 : 1;
      ctx.globalAlpha = pulse;
      ctx.font = `${TS}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(this.fruit.emoji, fx, fy);
      ctx.globalAlpha = 1;
    }

    // Pac-Man
    this.drawPacman(ctx);

    // Score popups
    this._drawScorePopups(ctx);

    // Combo indicator
    if (this.state === 'PLAYING' && this.comboCount > 1 && this.comboTimer > 0) {
      const comboAlpha = Math.min(this.comboTimer / 1.0, 1);
      ctx.globalAlpha = comboAlpha;
      ctx.fillStyle = '#ff4444';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`COMBO x${this.comboMultiplier.toFixed(1)}`, W - 8, 4);
      // Barra de tempo
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(8, 4, (W - 16) * (this.comboTimer / 3.0), 3);
      ctx.globalAlpha = 1;
    }

    // INTRO — animação de abertura
    if (this.state === 'INTRO') {
      this._renderIntro(ctx);
    }

    // INTERMISSION — tela entre níveis
    if (this.state === 'INTERMISSION') {
      this._renderIntermission(ctx);
    }

    // NEWHIGHSCORE — tela de celebração
    if (this.state === 'NEWHIGHSCORE') {
      this._renderHighScore(ctx);
    }

    // READY screen — texto no canvas (mostra durante countdown)
    if (this.state === 'READY' && this.readyTimer > 0) {
      const phase = this.readyTimer > 1.0 ? 'LEVEL' : 'READY!';
      const label = this.readyTimer > 1.0 ? `NÍVEL ${this.level}` : '';
      ctx.fillStyle = '#ffcc00';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(phase, W / 2, H / 2 - 8);
      if (label) {
        ctx.font = 'bold 14px monospace';
        ctx.fillStyle = '#fff';
        ctx.fillText(label, W / 2, H / 2 + 15);
      }
    }

    // Efeito de morte
    if (this.state === 'DYING') {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(Date.now() / 80) * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }

    // PAUSED — tela de pausa no canvas
    if (this.state === 'PAUSED') {
      this._renderPause(ctx);
    }
  }

  drawPacman(ctx) {
    const p = this.pacman;
    const x = p.px, y = p.py;
    const r = TS * 0.42;
    const mouth = this.state === 'DYING' ? 0 : Math.abs(Math.sin(Date.now() / 100)) * 0.35 + 0.05;
    const angle = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 }[p.dir] || 0;

    // Efeito de glow durante power-ups
    if (this.powerUpSpeedActive || this.powerUpShieldActive) {
      ctx.save();
      ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 80) * 0.15;
      ctx.fillStyle = this.powerUpSpeedActive ? '#00ff88' : '#4488ff';
      ctx.beginPath();
      ctx.arc(x, y, r * 2.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Cor muda durante shield
    ctx.fillStyle = this.powerUpShieldActive ? '#88ccff' : '#ffcc00';
    ctx.beginPath();
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /** Retorna tier visual atual (reutiliza AI config) */
  _getGhostVisualTier() {
    return (this._aiConfig || this._getGhostAIConfig()).tier;
  }

  drawGhost(ctx, g) {
    const e = g.e;
    const x = e.px, y = e.py;
    const r = TS * 0.4;
    const isFright = this.frightTimer > 0 && g.mode !== 'house' && g.mode !== 'leaving' && g.mode !== 'eaten';
    const tier = this._getGhostVisualTier();
    const now = Date.now();

    // Flash mais rápido quando o fright está acabando
    let flash = false;
    if (isFright) {
      if (this.frightTimer < 1)       flash = Math.floor(now / 80) % 2 === 0;
      else if (this.frightTimer < 2)  flash = Math.floor(now / 140) % 2 === 0;
      else                            flash = Math.floor(now / 250) % 2 === 0;
    }

    let color;
    if (isFright) {
      color = flash ? '#fff' : '#2121de';
    } else {
      color = g.color;
    }

    // Wobble sutil durante fright
    const wobble = isFright ? Math.sin(now / 60) * 1.5 : 0;

    // ── TIER 3+: Shadow/sombra pulsante atrás do fantasma ──
    if (tier >= 3 && !isFright) {
      ctx.save();
      ctx.globalAlpha = 0.15 + Math.sin(now / 300 + g.e.col) * 0.08;
      ctx.fillStyle = '#000';
      ctx.beginPath();
      ctx.arc(x + 2, y - r * 0.2 + 3, r * 1.1, Math.PI, 0);
      ctx.lineTo(x + r + 2, y + r * 0.6 + 3);
      ctx.lineTo(x - r - 2, y + r * 0.6 + 3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // ── TIER 4: Trailing afterimage ──
    if (tier >= 4 && !isFright && g.mode !== 'house' && g.mode !== 'leaving') {
      if (!g._trail) g._trail = [];
      // Registra posição a cada ~50ms (baseado em tempo, não frame)
      if (!g._lastTrailTime || now - g._lastTrailTime > 50) {
        g._lastTrailTime = now;
        g._trail.push({ x, y, t: now });
      }
      // Mantém últimos 4 snapshots, desenha com fade
      while (g._trail.length > 4) g._trail.shift();
      g._trail.forEach((snap, i) => {
        const age = (now - snap.t) / 80; // normaliza
        const alpha = 0.12 * (1 - age);
        if (alpha <= 0) return;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(snap.x, snap.y - r * 0.2, r * (0.9 + i * 0.02), Math.PI, 0);
        ctx.lineTo(snap.x + r, snap.y + r * 0.6);
        ctx.lineTo(snap.x - r, snap.y + r * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      });
    } else if (g._trail) {
      g._trail = []; // limpa trail ao entrar em fright/house
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2 + wobble, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r * 0.6 + wobble);
    const wave = 4;
    for (let i = 0; i < 4; i++) {
      const bx = x + r - (i / 4) * r * 2;
      ctx.quadraticCurveTo(bx - r/4, y + r * 0.6 + wobble + (i % 2 === 0 ? -wave : wave), bx - r/2, y + r * 0.6 + wobble);
    }
    ctx.closePath();
    ctx.fill();

    // ── TIER 2+: Body glow aura ──
    if (tier >= 2 && !isFright) {
      ctx.save();
      const glowAlpha = tier >= 4 ? 0.20 + Math.sin(now / 250) * 0.08 : 0.10 + Math.sin(now / 400) * 0.05;
      const glowR = tier >= 4 ? r * 1.8 : r * 1.4;
      ctx.globalAlpha = glowAlpha;
      ctx.shadowColor = color;
      ctx.shadowBlur = tier >= 4 ? 14 : 8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y - r * 0.2 + wobble, glowR, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    if (!isFright) {
      const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0;
      const dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0;

      // ── TIER 4: Glowing eyes with colored iris ──
      if (tier >= 4) {
        // Eye glow
        ctx.save();
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur = 6 + Math.sin(now / 200) * 3;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2.2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        // Red iris (tier 4 menacing look)
        const irisPulse = 1.0 + Math.sin(now / 180) * 0.2;
        ctx.fillStyle = '#ff2222';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx*1.8, y - r * 0.2 + dy*1.8, 1.1 * irisPulse, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx*1.8, y - r * 0.2 + dy*1.8, 1.1 * irisPulse, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else if (tier >= 3) {
        // Tier 3: slightly glowing white eyes
        ctx.save();
        ctx.shadowColor = '#aaaaff';
        ctx.shadowBlur = 4;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.shadowBlur = 0;
        ctx.fillStyle = '#00f';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
        ctx.restore();
      } else {
        // Tier 1-2: classic eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00f';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
      }
    } else {
      // Olhos assustados durante fright
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(x - 2.5, y - r * 0.2 + wobble, 2, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 2.5, y - r * 0.2 + wobble, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f00';
      ctx.beginPath(); ctx.arc(x - 2.5, y - r * 0.2 + wobble, 1, 0, Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 2.5, y - r * 0.2 + wobble, 1, 0, Math.PI*2); ctx.fill();
    }
  }

  // ── Score Popups (pontos flutuantes ao comer fantasma) ─────
  _drawScorePopups(ctx) {
    const now = Date.now();
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i];
      const elapsed = now - sp.time;
      if (elapsed > 800) { this.scorePopups.splice(i, 1); continue; }
      const progress = elapsed / 800;
      ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(sp.text, sp.x, sp.y - progress * 25);
      ctx.globalAlpha = 1;
    }
  }

  _addScorePopup(x, y, text) {
    this.scorePopups.push({ x, y, text, time: Date.now() });
  }

  /** Desenha apenas os olhos do fantasma (modo eaten) */
  drawGhostEyes(ctx, g) {
    const e = g.e;
    const x = e.px, y = e.py;
    const r = TS * 0.3;
    const tier = this._getGhostVisualTier();
    const now = Date.now();

    // Direção dos olhos
    const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0;
    const dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0;

    // Branco do olho (com glow nos tiers altos)
    ctx.save();
    if (tier >= 3) {
      ctx.shadowColor = tier >= 4 ? '#ff6666' : '#aaaaff';
      ctx.shadowBlur = tier >= 4 ? 6 : 3;
    }
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - 3, y - 1, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + 3, y - 1, r * 0.7, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // Pupila (tier 4: vermelha pulsante; tier 3: azul com glow; tier 1-2: azul simples)
    if (tier >= 4) {
      const pulse = 1.0 + Math.sin(now / 180) * 0.15;
      ctx.fillStyle = '#ff2222';
      ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35 * pulse, 0, Math.PI * 2); ctx.fill();
    } else if (tier >= 3) {
      ctx.fillStyle = '#4444ff';
      ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#00f';
      ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }

  /** Finaliza a intro e vai para o próximo estado */
  _finishIntro() {
    this.introTimer = 0;
    if (this.level > 1) {
      this.state = 'READY';
      this.readyTimer = 2.0;
      this._readySoundPlayed = false;
    } else {
      this.state = 'IDLE';
      this._showIdleOverlay();
    }
  }

  // ── Sistema de configurações (localStorage) ─────────────
  _settingsKey() { return 'pacman_settings'; }

  _loadSettings() {
    const defaults = { introEnabled: true, soundEnabled: true, difficulty: 'normal' };
    try {
      const raw = localStorage.getItem(this._settingsKey());
      if (raw) return { ...defaults, ...JSON.parse(raw) };
    } catch (_) {}
    return defaults;
  }

  _saveSettings() {
    try {
      localStorage.setItem(this._settingsKey(), JSON.stringify(this.settings));
    } catch (_) {}
  }

  /** Retorna multiplicador de IA baseado na dificuldade */
  _getDifficultyMultiplier() {
    switch (this.settings.difficulty) {
      case 'easy':    return 0.7;
      case 'hard':    return 1.3;
      case 'extreme': return 1.6;
      default:        return 1.0;
    }
  }

  /** Inicializa listener do modal de configurações */
  _initSettingsUI() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('settings-close');
    const introToggle = document.getElementById('set-intro');
    const soundToggle = document.getElementById('set-sound');
    const diffBtns = document.querySelectorAll('.diff-btn');

    if (!modal || !btn) return;

    // Aplica settings salvas aos controles
    introToggle.checked = this.settings.introEnabled;
    soundToggle.checked = this.settings.soundEnabled;
    diffBtns.forEach(b => {
      b.classList.toggle('active', b.dataset.diff === this.settings.difficulty);
    });

    // Abre/fecha modal
    btn.onclick = () => {
      const wasPlaying = this.state === 'PLAYING';
      if (wasPlaying) this.togglePause();
      modal.classList.add('show');
      this._settingsWasPaused = wasPlaying;
    };
    const closeModal = () => {
      modal.classList.remove('show');
      if (this._settingsWasPaused && this.state === 'PAUSED') this.togglePause();
    };
    closeBtn.onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    // Toggle intro
    introToggle.onchange = () => {
      this.settings.introEnabled = introToggle.checked;
      this._saveSettings();
    };

    // Toggle sound
    soundToggle.onchange = () => {
      this.settings.soundEnabled = soundToggle.checked;
      this._saveSettings();
    };

    // Dificuldade
    diffBtns.forEach(b => {
      b.onclick = () => {
        diffBtns.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        this.settings.difficulty = b.dataset.diff;
        this._saveSettings();
      };
    });
  }

  // ── Sistema de save/resume (localStorage) ──────────────
  _saveKey() { return 'pacman_save'; }

  _saveGame() {
    const data = {
      level: this.level,
      score: this.score,
      lives: this.lives,
      map: this.map,
      dotsEaten: this.dotsEaten,
      fruitIndex: this.fruitIndex,
      modeIndex: this.modeIndex,
      modeTimer: this.modeTimer,
      timestamp: Date.now()
    };
    try {
      localStorage.setItem(this._saveKey(), JSON.stringify(data));
    } catch (_) { /* quota exceeded or offline */ }
  }

  _hasSave() {
    try {
      const raw = localStorage.getItem(this._saveKey());
      if (!raw) return false;
      const data = JSON.parse(raw);
      return data && data.level > 1;
    } catch (_) { return false; }
  }

  _loadGame() {
    try {
      const raw = localStorage.getItem(this._saveKey());
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (_) { return null; }
  }

  _clearSave() {
    try { localStorage.removeItem(this._saveKey()); } catch (_) {}
  }

  /** Restaura o jogo a partir de um save */
  resumeGame(saveData) {
    this.level = saveData.level;
    this.map = saveData.map;
    this.score = saveData.score;
    this.lives = saveData.lives;
    this.dotsEaten = saveData.dotsEaten;
    this.fruitIndex = saveData.fruitIndex;
    this.modeIndex = saveData.modeIndex || 0;
    this.modeTimer = saveData.modeTimer || 0;
    this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER)
          this.dotsTotal++;

    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';
    this.ghosts = [
      { e: new Entity(10, 9,  spd.blinky), color: '#ff0000', name: 'blinky', scatter: { x: 20, y: 0  }, mode: 'house', baseSpeed: spd.blinky },
      { e: new Entity(10, 11, spd.pinky),  color: '#ffb8ff', name: 'pinky',  scatter: { x: 0,  y: 0  }, mode: 'house', baseSpeed: spd.pinky },
      { e: new Entity(11, 11, spd.inky),   color: '#00ffff', name: 'inky',   scatter: { x: 20, y: 20 }, mode: 'house', baseSpeed: spd.inky },
      { e: new Entity(9,  11, spd.clyde),  color: '#ffb851', name: 'clyde',  scatter: { x: 0,  y: 20 }, mode: 'house', baseSpeed: spd.clyde }
    ];
    this.frightTimer = 0;
    this.ghostEatCombo = 0;
    this.spawnTimer = 0;
    this.modeTimer = 0;
    this.modeIndex = 0;
    this.fruit = null;
    this.fruitTimer = 0;
    this.fruitScoreTimer = 0;
    this.scorePopups = [];
    this.powerUpSpeedTimer = 0;
    this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false;
    this.powerUpShieldActive = false;

    this.settings = this._loadSettings();
    this.state = 'READY';
    this.readyTimer = 2.0;
    this._readySoundPlayed = false;
    this.hideOverlay(true);
    this.updateUI();
  }

  /** Mostra overlay do IDLE (verifica save) */
  _showIdleOverlay() {
    if (this._hasSave()) {
      this.showOverlay('PRESSIONE ESPAÇO', 'continuar  •  N novo jogo');
    } else {
      this.showOverlay('PRESSIONE ESPAÇO', 'para começar');
    }
  }

  /** Retorna configuração da intro baseada no nível */
  _getIntroConfig() {
    const lvl = this.level;
    if (lvl <= 1) {
      return {
        tier: 1,
        duration: 3.5,
        phase1At: 2.5,
        phase2At: 1.0,
        title: 'PAC-MAN',
        titleColor: '#ffcc00',
        bgColor: 'rgba(0,0,0,0.85)',
        pacSpeed: 200,
        ghostSpeed: 3,
        subtitle: 'RETRO EDITION',
        subtitleColor: '#2121de',
        showParticles: false,
        screenShake: false,
      };
    } else if (lvl <= 3) {
      return {
        tier: 2,
        duration: 3.2,
        phase1At: 2.2,
        phase2At: 0.8,
        title: 'PAC-MAN',
        titleColor: '#44aaff',
        bgColor: 'rgba(0,0,20,0.88)',
        pacSpeed: 260,
        ghostSpeed: 4,
        subtitle: `NÍVEL ${lvl}`,
        subtitleColor: '#44aaff',
        showParticles: false,
        screenShake: false,
      };
    } else if (lvl <= 6) {
      return {
        tier: 3,
        duration: 2.8,
        phase1At: 1.8,
        phase2At: 0.6,
        title: 'PAC-MAN',
        titleColor: '#ff6644',
        bgColor: 'rgba(20,0,0,0.90)',
        pacSpeed: 340,
        ghostSpeed: 5,
        subtitle: `⚡ NÍVEL ${lvl} ⚡`,
        subtitleColor: '#ff6644',
        showParticles: true,
        screenShake: false,
      };
    } else {
      return {
        tier: 4,
        duration: 2.5,
        phase1At: 1.5,
        phase2At: 0.4,
        title: 'PAC-MAN',
        titleColor: '#ff0044',
        bgColor: 'rgba(30,0,10,0.92)',
        pacSpeed: 420,
        ghostSpeed: 6,
        subtitle: `🔥 NÍVEL ${lvl} — MÁXIMO 🔥`,
        subtitleColor: '#ff0044',
        showParticles: true,
        screenShake: true,
      };
    }
  }

  /** Atualiza partículas de intro */
  _updateIntroParticles(dt) {
    const cfg = this._getIntroConfig();
    if (!cfg.showParticles) return;
    // Spawn
    if (Math.random() < 0.6) {
      const colors = ['#ffcc00', '#ff0044', '#ff6644', '#fff'];
      this.introParticles.push({
        x: Math.random() * W,
        y: -5,
        vy: 30 + Math.random() * 50,
        vx: (Math.random() - 0.5) * 30,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 1 + Math.random() * 2,
        life: 1.0
      });
    }
    // Update
    for (let i = this.introParticles.length - 1; i >= 0; i--) {
      const p = this.introParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt * 0.5;
      if (p.life <= 0 || p.y > H + 5) this.introParticles.splice(i, 1);
    }
  }

  /** Renderiza a tela de intermissão entre níveis */
  _renderIntermission(ctx) {
    const progress = 1 - (this.intermissionTimer / 3.0);
    const fadeIn = Math.min(progress * 3, 1);
    const fadeOut = this.intermissionTimer < 0.5 ? this.intermissionTimer * 2 : 1;
    const alpha = Math.min(fadeIn, fadeOut);

    ctx.globalAlpha = alpha;

    // Fundo escuro semi-transparente
    ctx.fillStyle = 'rgba(0,0,0,0.88)';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    let y = H / 2 - 50;

    // Título "NÍVEL COMPLETO!"
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('NÍVEL COMPLETO!', cx, y);

    // Número do nível
    y += 30;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(`NÍVEL ${this.level}`, cx, y);

    // Pontuação
    y += 35;
    ctx.fillStyle = '#ffb8ae';
    ctx.font = '14px monospace';
    ctx.fillText('PONTUAÇÃO', cx, y - 10);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px monospace';
    ctx.fillText(String(this.score), cx, y + 12);

    // Vidas restantes
    y += 45;
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText('VIDAS', cx, y - 5);
    for (let i = 0; i < this.lives; i++) {
      const lx = cx - ((this.lives - 1) * 12) + i * 24;
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(lx, y + 12, 6, 0.25 * Math.PI, 1.75 * Math.PI);
      ctx.lineTo(lx, y + 12);
      ctx.closePath();
      ctx.fill();
    }

    // Fantasmas decorativos na parte inferior
    y += 38;
    const ghostColors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851'];
    const ghostNames = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'];
    ctx.font = '8px monospace';
    ghostColors.forEach((color, i) => {
      const gx = cx - 45 + i * 30;
      // Mini fantasma
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gx, y, 5, Math.PI, 0);
      ctx.lineTo(gx + 5, y + 6);
      ctx.lineTo(gx - 5, y + 6);
      ctx.closePath();
      ctx.fill();
      // Nome
      ctx.fillStyle = '#888';
      ctx.fillText(ghostNames[i], gx, y + 14);
    });

    ctx.globalAlpha = 1;
  }

  /** Atualiza partículas de confete para a tela de high score */
  _updateHighScoreParticles(dt) {
    // Adiciona novas partículas periodicamente
    if (this.highScoreTimer > 0.5 && Math.random() < 0.4) {
      const colors = ['#ffcc00', '#ff0000', '#ffb8ff', '#00ffff', '#ffb851', '#fff'];
      this.highScoreParticles.push({
        x: Math.random() * W,
        y: -10,
        vx: (Math.random() - 0.5) * 80,
        vy: 40 + Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 3 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 8,
        life: 1.0
      });
    }
    // Atualiza partículas existentes
    for (let i = this.highScoreParticles.length - 1; i >= 0; i--) {
      const p = this.highScoreParticles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotSpeed * dt;
      p.life -= dt * 0.4;
      if (p.life <= 0 || p.y > H + 10) {
        this.highScoreParticles.splice(i, 1);
      }
    }
  }

  /** Renderiza a tela de high score com confete e ranking */
  _renderHighScore(ctx) {
    const t = 4.0 - this.highScoreTimer; // tempo decorrido
    const alpha = Math.min(t * 2, 1);
    ctx.globalAlpha = alpha;

    // Fundo escuro
    ctx.fillStyle = 'rgba(0,0,0,0.9)';
    ctx.fillRect(0, 0, W, H);

    // Partículas de confete (atrás do texto)
    this.highScoreParticles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = Math.min(p.life, 1) * alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx.restore();
    });
    ctx.globalAlpha = alpha;

    const cx = W / 2;
    let y = H / 2 - 70;

    // Título "★ NOVO RECORDE! ★" com pulso
    const pulse = 1 + Math.sin(t * 4) * 0.05;
    ctx.save();
    ctx.translate(cx, y);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('★ NOVO RECORDE! ★', 0, 0);
    ctx.restore();

    // Posição no ranking
    y += 40;
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`#${this.highScoreRank} NO RANKING`, cx, y);

    // Pontuação (grande e dourada)
    y += 40;
    ctx.fillStyle = '#ffb8ae';
    ctx.font = '13px monospace';
    ctx.fillText('PONTUAÇÃO', cx, y - 10);
    ctx.fillStyle = '#ffcc00';
    ctx.font = 'bold 28px monospace';
    ctx.fillText(String(this.score).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), cx, y + 15);

    // Troféu animado
    y += 55;
    const trophyBounce = Math.sin(t * 3) * 5;
    ctx.font = '30px serif';
    ctx.fillText('🏆', cx, y + trophyBounce);

    // Nível alcançado
    y += 40;
    ctx.fillStyle = '#aaa';
    ctx.font = '12px monospace';
    ctx.fillText(`NÍVEL ${this.level} COMPLETO`, cx, y);

    // Fantasmas comemorando na base
    y += 25;
    const ghostColors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851'];
    const bounce = Math.sin(t * 5);
    ghostColors.forEach((color, i) => {
      const gx = cx - 50 + i * 33;
      const gy = y + bounce * (i % 2 === 0 ? 1 : -1);
      const r = 6;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(gx, gy - r * 0.2, r, Math.PI, 0);
      ctx.lineTo(gx + r, gy + r * 0.6);
      ctx.lineTo(gx - r, gy + r * 0.6);
      ctx.closePath();
      ctx.fill();
    });

    ctx.globalAlpha = 1;
  }

  /** Renderiza a animação de intro (tier-based por nível) */
  _renderIntro(ctx) {
    const cfg = this._getIntroConfig();
    const t = cfg.duration - this.introTimer; // tempo decorrido
    const cx = W / 2;
    const cy = H / 2;

    // Screen shake para tier 4
    if (cfg.screenShake) {
      ctx.save();
      const shake = Math.sin(t * 30) * 1.5;
      ctx.translate(shake, shake * 0.5);
    }

    // Fundo
    ctx.fillStyle = cfg.bgColor;
    ctx.fillRect(0, 0, W, H);

    // Partículas de fundo para tiers 3-4
    if (cfg.showParticles) {
      this.introParticles.forEach(p => {
        ctx.globalAlpha = Math.min(p.life, 1) * 0.7;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    // Flash para tier 4 (pulsa a cada 0.5s)
    if (cfg.tier >= 4) {
      const flash = Math.sin(t * 8) * 0.04;
      if (flash > 0) {
        ctx.fillStyle = `rgba(255,0,50,${flash})`;
        ctx.fillRect(0, 0, W, H);
      }
    }

    // ── Fase 0: Letras do título ──
    const letters = cfg.title;
    const letterDelay = cfg.tier <= 1 ? 0.12 : 0.1;
    const totalLetters = letters.length;
    const letterSize = cfg.tier >= 3 ? 36 : 32;
    const letterSpacing = cfg.tier >= 3 ? 42 : 38;
    for (let i = 0; i < totalLetters; i++) {
      const appear = i * letterDelay + 0.2;
      if (t > appear) {
        const alpha = Math.min((t - appear) * 5, 1);
        const bounce = t - appear < 0.15 ? Math.sin((t - appear) / 0.15 * Math.PI) * 10 : 0;
        ctx.globalAlpha = alpha;
        ctx.fillStyle = cfg.titleColor;
        ctx.font = `bold ${letterSize}px monospace`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const lx = cx + (i - totalLetters / 2 + 0.5) * letterSpacing;
        const ly = cy - 40 - bounce;
        ctx.fillText(letters[i], lx, ly);

        // Glow para tiers 3-4
        if (cfg.tier >= 3) {
          ctx.shadowColor = cfg.titleColor;
          ctx.shadowBlur = 8 + Math.sin(t * 6 + i) * 4;
          ctx.fillText(letters[i], lx, ly);
          ctx.shadowBlur = 0;
        }
      }
    }
    ctx.globalAlpha = 1;

    // ── Fase 1: Pac-Man comendo dots ──
    if (this.introPhase >= 1) {
      const phaseT = t - (cfg.duration - cfg.phase1At);
      const pacX = -30 + phaseT * cfg.pacSpeed;
      const pacY = cy + 10;
      const mouth = Math.abs(Math.sin(Date.now() / 80)) * 0.35 + 0.05;

      // Linha de dots
      ctx.fillStyle = '#ffb8ae';
      for (let dx = 20; dx < W - 20; dx += 30) {
        if (dx > pacX + 10) {
          ctx.beginPath();
          ctx.arc(dx, pacY, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Trail de pontos para tier 4
      if (cfg.tier >= 4) {
        for (let j = 1; j <= 3; j++) {
          const trailX = pacX - j * 15;
          if (trailX > 0) {
            ctx.globalAlpha = 0.3 - j * 0.08;
            ctx.fillStyle = '#ffcc00';
            ctx.beginPath();
            ctx.arc(trailX, pacY, TS * 0.35, 0.3, Math.PI * 2 - 0.3);
            ctx.lineTo(trailX, pacY);
            ctx.closePath();
            ctx.fill();
          }
        }
        ctx.globalAlpha = 1;
      }

      // Pac-Man
      ctx.save();
      ctx.translate(pacX, pacY);
      if (cfg.tier >= 3) {
        ctx.shadowColor = '#ffcc00';
        ctx.shadowBlur = 10;
      }
      ctx.fillStyle = '#ffcc00';
      ctx.beginPath();
      ctx.arc(0, 0, TS * 0.42, mouth, Math.PI * 2 - mouth);
      ctx.lineTo(0, 0);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // ── Fase 2: Fantasmas + READY ──
    if (this.introPhase >= 2) {
      const phaseT = t - (cfg.duration - cfg.phase2At);
      const ghostColors = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851'];
      const ghostNames = ['BLINKY', 'PINKY', 'INKY', 'CLYDE'];
      const ghostY = cy + 65;

      const ghostAlpha = Math.min(phaseT * cfg.ghostSpeed, 1);
      ctx.globalAlpha = ghostAlpha;

      ghostColors.forEach((color, i) => {
        const spacing = cfg.tier >= 3 ? 42 : 38;
        const gx = cx - 55 + i * spacing;
        const slideIn = Math.min(phaseT * cfg.ghostSpeed, 1);
        const gy = ghostY + (1 - slideIn) * 50;
        const r = 8;

        // Corpo
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(gx, gy - r * 0.2, r, Math.PI, 0);
        ctx.lineTo(gx + r, gy + r * 0.6);
        const wave = 3;
        for (let j = 0; j < 4; j++) {
          const bx = gx + r - (j / 4) * r * 2;
          ctx.quadraticCurveTo(bx - r / 4, gy + r * 0.6 + (j % 2 === 0 ? -wave : wave), bx - r / 2, gy + r * 0.6);
        }
        ctx.closePath();
        ctx.fill();

        // Glow para tiers 3-4
        if (cfg.tier >= 3) {
          ctx.shadowColor = color;
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }

        // Olhos
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(gx - 2.5, gy - r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 2.5, gy - r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00f';
        ctx.beginPath(); ctx.arc(gx - 2.5, gy - r * 0.2, 1, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(gx + 2.5, gy - r * 0.2, 1, 0, Math.PI * 2); ctx.fill();

        // Nome
        ctx.fillStyle = '#888';
        ctx.font = '7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(ghostNames[i], gx, gy + 14);
      });

      ctx.globalAlpha = 1;

      // "READY!" text
      const readyAlpha = Math.min((phaseT - 0.3) * 5, 1);
      if (readyAlpha > 0) {
        ctx.globalAlpha = readyAlpha;
        ctx.fillStyle = cfg.titleColor;
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('READY!', cx, cy - 65);
        ctx.globalAlpha = 1;
      }
    }

    // ── Subtítulo na parte inferior ──
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 400) * 0.2;
    ctx.fillStyle = cfg.subtitleColor;
    ctx.font = cfg.tier >= 3 ? 'bold 11px monospace' : '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(cfg.subtitle, cx, H - 30);
    ctx.globalAlpha = 1;

    // ── Hint de pulo (aparece após 0.5s) ──
    if (t > 0.5) {
      ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 500) * 0.15;
      ctx.fillStyle = '#888';
      ctx.font = '9px monospace';
      ctx.fillText('PRESSIONE ESPAÇO PARA PULAR', cx, H - 12);
      ctx.globalAlpha = 1;
    }

    // Screen shake restore
    if (cfg.screenShake) {
      ctx.restore();
    }
  }

  updateUI() {
    document.getElementById('score-display').textContent = this.score;
    document.getElementById('lives-display').textContent = this.lives;
    document.getElementById('level-display').textContent = this.level;
  }
}

// ── BOOTSTRAP E INTERFACE FRONTEND ──────────────────────────────
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

// ── FIX 2 — Input via keydown events (enfileira uma direção por press) ──
document.addEventListener('keydown', e => {
  // P — Pausar / Retomar
  if (e.code === 'KeyP' && (game.state === 'PLAYING' || game.state === 'PAUSED')) {
    e.preventDefault();
    game.togglePause();
    return;
  }

  // Início do jogo (IDLE) — Space: continuar ou novo jogo
  if (e.code === 'Space' && game.state === 'IDLE') {
    e.preventDefault();
    Audio.init();
    const save = game._loadGame();
    if (save && save.level > 1) {
      game.resumeGame(save);
    } else {
      game.state = 'READY';
      game.readyTimer = 0.9;
      game._readySoundPlayed = true;
      game.hideOverlay(true);
      Audio.gameStart();
    }
    return;
  }

  // N — Novo jogo (ignora save)
  if (e.code === 'KeyN' && game.state === 'IDLE') {
    e.preventDefault();
    game._clearSave();
    game._showIdleOverlay();
    return;
  }

  // Pular intro com Space
  if (e.code === 'Space' && game.state === 'INTRO') {
    e.preventDefault();
    game._finishIntro();
    return;
  }

  // FIX 2 — Direção enfileirada (uma por keydown, não por frame)
  const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (dirMap[e.code] && game.state === 'PLAYING') {
    e.preventDefault();
    game.inputQueue.push(dirMap[e.code]);
  } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
  }
});

// Telas e Autenticação
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');

async function fetchScores() {
  try {
    const res = await fetch('/api/scores?limit=10');
    const scores = await res.json();
    const list = document.getElementById('scores-list');
    if (!list) return;
    if (!scores.length) {
      list.innerHTML = '<li style="color:#555;">Nenhuma pontuação ainda</li>';
      return;
    }
    list.innerHTML = scores.map((s, i) => {
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] + ' ' : '';
      const rank = i >= 3 ? `${i + 1}. ` : '';
      const date = new Date(s.created_at + 'Z').toLocaleDateString('pt-BR');
      return `<li>${rank}${medal}<span style="color:#ffcc00;font-weight:bold">${s.score.toLocaleString()}</span> <span style="color:#888">${s.player_email}</span> <span style="color:#555;font-size:11px">${date}</span></li>`;
    }).join('');
  } catch (_) { /* offline */ }
}

function showGame() {
  authScreen.style.display = 'none';
  gameScreen.style.display = 'flex';
  Audio.init();
  game.init(1);
  fetchScores();
}

function showAuth() {
  authScreen.style.display = 'flex';
  gameScreen.style.display = 'none';
}

if (localStorage.getItem('token')) { showGame(); } else { showAuth(); }

document.getElementById('logout-btn').onclick = () => {
  localStorage.removeItem('token');
  location.reload();
};

// ── Mobile D-pad touch controls ──
(function initMobileControls() {
  const dirMap = { up: 'up', down: 'down', left: 'left', right: 'right' };

  // Debounce para evitar firing múltiplo (touchstart + mousedown + click)
  let _lastAction = 0;
  function debounce() {
    const now = Date.now();
    if (now - _lastAction < 300) return false;
    _lastAction = now;
    return true;
  }

  // Lógica compartilhada para START (touch, mouse, click)
  function handleStart() {
    if (!debounce()) return;
    Audio.init();
    if (game.state === 'IDLE') {
      const save = game._loadGame();
      if (save && save.level > 1) {
        game.resumeGame(save);
      } else {
        game.state = 'READY';
        game.readyTimer = 0.9;
        game._readySoundPlayed = true;
        game.hideOverlay(true);
        Audio.gameStart();
      }
    } else if (game.state === 'GAMEOVER') {
      game.init(1);
    } else if (game.state === 'INTRO') {
      game._finishIntro();
    }
  }

  // D-pad buttons com hold-to-repeat
  document.querySelectorAll('.dpad-btn').forEach(btn => {
    const dir = btn.dataset.dir;
    if (!dir) return;
    let repeatInterval = null;

    function startRepeat() {
      btn.classList.add('active');
      if (game.state === 'PLAYING') game.inputQueue.push(dirMap[dir]);
      repeatInterval = setInterval(() => {
        if (game.state === 'PLAYING') game.inputQueue.push(dirMap[dir]);
      }, 120);
    }
    function stopRepeat() {
      btn.classList.remove('active');
      if (repeatInterval) { clearInterval(repeatInterval); repeatInterval = null; }
    }

    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startRepeat(); }, { passive: false });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); stopRepeat(); }, { passive: false });
    btn.addEventListener('touchcancel', (e) => { e.preventDefault(); stopRepeat(); }, { passive: false });
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); startRepeat(); });
    btn.addEventListener('mouseup', stopRepeat);
    btn.addEventListener('mouseleave', stopRepeat);
  });

  // Start button
  const startBtn = document.getElementById('mobile-start');
  if (startBtn) {
    startBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startBtn.classList.add('active'); handleStart(); }, { passive: false });
    startBtn.addEventListener('touchend', (e) => { e.preventDefault(); startBtn.classList.remove('active'); }, { passive: false });
    startBtn.addEventListener('mousedown', (e) => { e.preventDefault(); handleStart(); });
    startBtn.addEventListener('click', (e) => { e.preventDefault(); handleStart(); });
  }

  // Pause button
  const pauseBtn = document.getElementById('mobile-pause');
  if (pauseBtn) {
    function handlePause() {
      if (!debounce()) return;
      if (game.state === 'PLAYING' || game.state === 'PAUSED') game.togglePause();
    }
    pauseBtn.addEventListener('touchstart', (e) => { e.preventDefault(); pauseBtn.classList.add('active'); handlePause(); }, { passive: false });
    pauseBtn.addEventListener('touchend', (e) => { e.preventDefault(); pauseBtn.classList.remove('active'); }, { passive: false });
    pauseBtn.addEventListener('mousedown', (e) => { e.preventDefault(); handlePause(); });
    pauseBtn.addEventListener('click', (e) => { e.preventDefault(); handlePause(); });
  }
})();

// Controle de Abas
document.querySelectorAll('.tab').forEach(t => {
  t.onclick = () => {
    document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
    t.classList.add('active');
    document.getElementById('login-form').style.display = t.dataset.tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = t.dataset.tab === 'register' ? 'block' : 'none';
  };
});

// Submit Login
document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/login', { 
    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-pass').value }) 
  });
  const data = await res.json();
  if (data.token) { localStorage.setItem('token', data.token); showGame(); }
  else { document.getElementById('login-error').textContent = data.error; }
};

// Submit Registro
document.getElementById('register-form').onsubmit = async (e) => {
  e.preventDefault();
  const res = await fetch('/api/register', { 
    method: 'POST', headers: { 'Content-Type': 'application/json' }, 
    body: JSON.stringify({ email: document.getElementById('reg-email').value, password: document.getElementById('reg-pass').value }) 
  });
  const data = await res.json();
  if (data.token) { localStorage.setItem('token', data.token); showGame(); }
  else { document.getElementById('reg-error').textContent = data.error; }
};
