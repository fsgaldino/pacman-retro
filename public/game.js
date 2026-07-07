/* ===========================================================
   PAC-MAN RETRÔ — Motor Completo
   Inclui: Web Audio API (sons sintetizados),
   mapa 21×21, 4 fantasmas com IA, pontuação, autenticação.
   =========================================================== */

// ─── CONSTANTES ─────────────────────────────────────────────
const COLS = 21;
const ROWS = 21;
const TS   = 20; // tile size (px)
// ─── FIX v3.0 — Precisão no alinhamento de tiles ────────────
const TURN_TOLERANCE = 10;
const TILE_CENTER_THRESHOLD = 2.0; // px para considerar 'alinhado' ao centro
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

// ─── CICLO SCATTER/CHASE ──────────────────────────────────
const SCATTERCHASE_BY_LEVEL = [
  [7, 20, 7, 20, 5, 20, 5, Infinity],
  [7, 20, 7, 20, 5, 20, 5, Infinity],
  [7, 20, 7, 20, 5, 20, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
  [5, 20, 5, 20, 5, 17, 5, Infinity],
];

// ─── FRUTAS (FIX 3 — spawnam progressivamente a cada 2 min) ──
const FRUITS = [
  { emoji: '🍒', points: 100  },
  { emoji: '🍓', points: 300  },
  { emoji: '🍎', points: 500  },
  { emoji: '🍉', points: 700  },
  { emoji: '🍈', points: 1000, powerUp: 'speed' },
  { emoji: '🚀', points: 2000, powerUp: 'shield' },
];
const FRUIT_SPAWN_INTERVAL = 30; // 30 segundos entre frutas
const FRUIT_DURATION = 30; // segundos visível no mapa
const POWERUP_SPEED_MULT = 1.5;
const POWERUP_SPEED_DURATION = 5;
const POWERUP_SHIELD_DURATION = 4;

// ─── TABELA DE VELOCIDADES ────────────────────────────────
const SPEED_TABLE = [
  { pacman: 5.5, blinky: 5.0, pinky: 5.0, inky: 5.0, clyde: 5.0 },
  { pacman: 5.7, blinky: 5.4, pinky: 5.2, inky: 5.1, clyde: 5.1 },
  { pacman: 5.9, blinky: 5.7, pinky: 5.4, inky: 5.3, clyde: 5.2 },
  { pacman: 6.1, blinky: 6.0, pinky: 5.6, inky: 5.5, clyde: 5.3 },
  { pacman: 6.3, blinky: 6.3, pinky: 5.8, inky: 5.7, clyde: 5.4 },
  { pacman: 6.5, blinky: 6.5, pinky: 6.0, inky: 5.9, clyde: 5.5 },
  { pacman: 6.8, blinky: 6.8, pinky: 6.2, inky: 6.1, clyde: 5.7 },
  { pacman: 7.0, blinky: 7.0, pinky: 6.5, inky: 6.3, clyde: 5.9 },
  { pacman: 7.2, blinky: 7.2, pinky: 6.7, inky: 6.5, clyde: 6.1 },
  { pacman: 7.5, blinky: 7.5, pinky: 7.0, inky: 6.7, clyde: 6.3 },
];
const GHOST_FRIGHT_SPEED = 3.0;
const GHOST_TUNNEL_SPEED = 2.5;
const GHOST_EYES_SPEED_MULT = 2.5;

function getSpeeds(level) {
  const i = Math.min(level - 1, SPEED_TABLE.length - 1);
  const s = SPEED_TABLE[i];
  return { pacman: s.pacman, blinky: s.blinky, pinky: s.pinky, inky: s.inky, clyde: s.clyde };
}

function isInTunnel(col, row) {
  return (col <= 5 || col >= 15) && row === 7;
}

// ─── MAPA 21×21 ───────────────────────────────────────────
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

// ─── ÁUDIO ────────────────────────────────────────────────
const Audio = {
  ctx: null,
  init() {
    try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (_) {}
  },
  _muted: false,
  _tone(freq, dur, type, vol = 0.08) {
    if (!this.ctx || this._muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(this.ctx.destination);
    o.start(t); o.stop(t + dur);
  },
  chomp() { this._tone(320, 0.06, 'square', 0.07); setTimeout(() => this._tone(480, 0.06, 'square', 0.07), 50); },
  powerPellet() {
    if (!this.ctx || this._muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t);
    o.frequency.linearRampToValueAtTime(680, t + 0.35);
    g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 0.35);
  },
  eatGhost() { this._tone(700, 0.08, 'square', 0.10); setTimeout(() => this._tone(1100, 0.12, 'square', 0.10), 80); },
  death() {
    if (!this.ctx || this._muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 1.0);
    g.gain.setValueAtTime(0.10, t); g.gain.exponentialRampToValueAtTime(0.001, t + 1.0);
    o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + 1.0);
  },
  gameStart() { [260, 330, 390, 520].forEach((f, i) => setTimeout(() => this._tone(f, 0.18, 'square', 0.07), i * 180)); },
  eatFruit() { [520, 660, 780, 1040].forEach((f, i) => setTimeout(() => this._tone(f, 0.10, 'sine', 0.08), i * 60)); },
  powerUp() { [440, 660, 880, 1100, 1320].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'square', 0.08), i * 70)); },
  levelComplete() { [520, 660, 780, 1040, 1320, 1560].forEach((f, i) => setTimeout(() => this._tone(f, 0.15, 'square', 0.07), i * 110)); },
  ready() { [440, 550, 660].forEach((f, i) => setTimeout(() => this._tone(f, 0.12, 'triangle', 0.08), i * 100)); },
  modeSwitch() { this._tone(330, 0.08, 'sine', 0.06); setTimeout(() => this._tone(440, 0.08, 'sine', 0.06), 60); },
  intro() { [260, 330, 390, 520, 390, 330].forEach((f, i) => setTimeout(() => this._tone(f, 0.15, 'square', 0.07), i * 150)); },
  celebrate() {
    [520, 660, 780, 1040, 780, 1040, 1320, 1560].forEach((f, i) => setTimeout(() => this._tone(f, 0.15, 'square', 0.09), i * 90));
    setTimeout(() => { [1560, 1760, 2080].forEach((f, i) => setTimeout(() => this._tone(f, 0.2, 'sine', 0.07), i * 120)); }, 750);
  },
  combo(level) { const base = 400 + level * 80; [base, base * 1.25, base * 1.5].forEach((f, i) => setTimeout(() => this._tone(f, 0.1, 'square', 0.08), i * 50)); }
};

// ─── ENTIDADE ─────────────────────────────────────────────
class Entity {
  constructor(col, row, speed) {
    this.col = col; this.row = row;
    this.px = col * TS + TS / 2; this.py = row * TS + TS / 2;
    this.dir = 'right'; this.speed = speed;
    this.moving = false;
    this.targetX = this.px; this.targetY = this.py;
    this.bufferedDir = null;
  }
  center() { return { x: this.col * TS + TS / 2, y: this.row * TS + TS / 2 }; }
  distTo(tc, tr) { return Math.abs(this.col - tc) + Math.abs(this.row - tr); }
  atCenter() { return Math.abs(this.px - this.targetX) < 1.5 && Math.abs(this.py - this.targetY) < 1.5; }
  _nearCenter(t) { return Math.abs(this.px - this.targetX) < t && Math.abs(this.py - this.targetY) < t; }

  _instantReverse() {
    const d = DIR[this.dir];
    const destCol = this.col + d.dx; const destRow = this.row + d.dy;
    this.dir = DIR_REV[this.dir];
    if (destCol >= 0 && destCol < COLS && destRow >= 0 && destRow < ROWS) {
      const oldCol = this.col; const oldRow = this.row;
      this.col = destCol; this.row = destRow;
      this.targetX = oldCol * TS + TS / 2; this.targetY = oldRow * TS + TS / 2;
    } else {
      const c = this.center(); this.targetX = c.x; this.targetY = c.y;
    }
    this.moving = true;
  }

  canMoveTo(col, row, map, isGhost) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const t = map[row][col];
    if (t === TILE.WALL) return false;
    if (!isGhost && (t === TILE.GHOUSE || t === TILE.DOOR)) return false;
    return true;
  }

  getValidMoves(map, isGhost) {
    const rev = DIR_REV[this.dir];
    return DIR_LIST.filter(d => d.name !== rev && this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost));
  }

  _isTunnelRow(row, map) {
    return row >= 0 && row < ROWS && map[row][0] !== TILE.WALL && map[row][COLS - 1] !== TILE.WALL;
  }

  step(dt, map, isGhost) {
    const d = DIR[this.dir];
    if (!d) { this.moving = false; return true; }

    if (this.dir === 'left' && this.col === 0 && this._isTunnelRow(this.row, map)) {
      this.col = COLS - 1; this.px = this.col * TS + TS / 2; this.targetX = this.px;
    } else if (this.dir === 'right' && this.col === COLS - 1 && this._isTunnelRow(this.row, map)) {
      this.col = 0; this.px = this.col * TS + TS / 2; this.targetX = this.px;
    }

    const nc = this.col + d.dx; const nr = this.row + d.dy;
    if (!this.canMoveTo(nc, nr, map, isGhost)) {
      this.moving = false;
      const c = this.center(); this.px = c.x; this.py = c.y; this.targetX = c.x; this.targetY = c.y;
      this.checkAndApplyBuffer(map, isGhost);
      return false;
    }

    this.targetX = nc * TS + TS / 2; this.targetY = nr * TS + TS / 2;
    this.moving = true;
    const pixelsPerSec = this.speed * TS; const stepPx = pixelsPerSec * dt;
    const diffX = this.targetX - this.px; const diffY = this.targetY - this.py;
    const dist = Math.sqrt(diffX * diffX + diffY * diffY);

    if (dist <= stepPx) {
      this.px = this.targetX; this.py = this.targetY; this.col = nc; this.row = nr;
      // v3.0: Consome buffer no alinhamento exato com o centro do tile
      this.checkAndApplyBuffer(map, isGhost);
    } else {
      this.px += (diffX / dist) * stepPx; this.py += (diffY / dist) * stepPx;
    }

    if (this.px < -TS / 2) { this.px += W + TS; this.targetX = this.col * TS + TS / 2; }
    else if (this.px > W + TS / 2) { this.px -= W + TS; this.targetX = this.col * TS + TS / 2; }
    return true;
  }

  /**
   * _applyBuffer — Consome o buffer de direção (FIX v3.0)
   *
   * Agora verifica a posição exata x/y em relação ao centro do tile.
   * Ao atingir o centro (dentro de TILE_CENTER_THRESHOLD px), o comando
   * armazenado é executado imediatamente, garantindo curvas precisas
   * mesmo em alta velocidade.
   */
  _applyBuffer(map, isGhost) {
    if (!this.bufferedDir) return;
    const d = DIR[this.bufferedDir];
    if (!d) { this.bufferedDir = null; return; }

    if (this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost)) {
      this.dir = this.bufferedDir;
      this.bufferedDir = null;
      this.moving = true;
      this.targetX = (this.col + d.dx) * TS + TS / 2;
      this.targetY = (this.row + d.dy) * TS + TS / 2;
      return;
    }
    // Caminho bloqueado: descarta buffer para evitar acumulação
    this.bufferedDir = null;
  }

  /**
   * setBufferedDir — Fila de direção com consumo preciso em interseções
   *
   * v3.0: Melhora a detecção de alinhamento com o centro do tile.
   * Quando o jogador pressiona uma direção enquanto Pac-Man está entre
   * tiles, o comando é armazenado em bufferedDir. A cada frame, o
   * Entity.step() verifica se a entidade está alinhada ao centro do
   * tile atual (atCenter()). Quando alinhada, o buffer é consumido.
   *
   * Meias-voltas (direção oposta) são executadas instantaneamente.
   * Se a direção é válida no tile atual, aplica imediatamente.
   * Caso contrário, armazena no buffer (será consumido ao chegar
   * no centro do próximo tile).
   */
  setBufferedDir(newDir, map, isGhost) {
    // Meia-volta: sempre instantânea
    if (newDir === DIR_REV[this.dir]) {
      this._instantReverse();
      this.bufferedDir = null;
      return;
    }

    const d = DIR[newDir];
    if (!d) return;

    const atCenter = (
      Math.abs(this.px - this.targetX) < TILE_CENTER_THRESHOLD &&
      Math.abs(this.py - this.targetY) < TILE_CENTER_THRESHOLD
    );

    // Se está exatamente no centro do tile, tenta aplicar imediatamente
    if (atCenter && this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost)) {
      this.dir = newDir;
      this.bufferedDir = null;
      this.targetX = (this.col + d.dx) * TS + TS / 2;
      this.targetY = (this.row + d.dy) * TS + TS / 2;
      this.moving = true;
      return;
    }

    // Fora do centro: enfileira para ser consumido no próximo alinhamento
    this.bufferedDir = newDir;

    // Early snap (v3.0): se está perto do centro e a direção é válida
    // no tile à frente, aplica imediatamente para fluidez máxima
    if (this.moving && this._nearCenter(TURN_TOLERANCE)) {
      const nextD = DIR[this.dir];
      const nc = this.col + (nextD ? nextD.dx : 0);
      const nr = this.row + (nextD ? nextD.dy : 0);
      if (this.canMoveTo(nc + d.dx, nr + d.dy, map, isGhost)) {
        this.dir = newDir;
        this.bufferedDir = null;
        this.targetX = (nc + d.dx) * TS + TS / 2;
        this.targetY = (nr + d.dy) * TS + TS / 2;
        this.moving = true;
      }
    }
  }

  /**
   * checkAndApplyBuffer — Chamado a cada frame por step()
   * Verifica se a entidade está alinhada ao centro e, em caso positivo,
   * tenta consumir o buffer de direção.
   */
  checkAndApplyBuffer(map, isGhost) {
    if (!this.bufferedDir) return false;
    if (!this.atCenter()) return false;
    this._applyBuffer(map, isGhost);
    return true;
  }
}

// ─── CLASSE PRINCIPAL ─────────────────────────────────────
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = []; this.pacman = null; this.ghosts = [];
    this.score = 0; this.lives = 3; this.level = 1;
    this.state = 'IDLE';
    this.dotsTotal = 0; this.dotsEaten = 0;
    this.frightTimer = 0; this.frightDuration = 6;
    this.ghostEatCombo = 0; this.spawnTimer = 0;
    this.overlayEl = document.getElementById('game-overlay');
    this.overlayText = document.getElementById('overlay-text');
    this.overlayHint = document.getElementById('overlay-hint');
    this.inputQueue = []; this.scorePopups = [];
    this.modeTimer = 0; this.modeIndex = 0;
    this._savedModeIndex = 0; this._savedModeTimer = 0;
    this.fruit = null; this.fruitCol = 10; this.fruitRow = 9;
    this.fruitTimer = 0; this.fruitIndex = 0;
    this.fruitSpawnTimer = 0;
    this.fruitSpawnAnim = 0;
    this.fruitParticles = []; // partículas da fruta
    this.fruitEatEffects = []; // efeitos ao comer fruta
    this._fruitOriginalTile = null; // tile original sob a fruta
    this._readySoundPlayed = false;
    this.powerUpSpeedTimer = 0; this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false; this.powerUpShieldActive = false;
    this.lastTime = 0; this.animFrame = null;
    this.dyingTimer = 0; this.winTimer = 0; this.readyTimer = 0;
    this.intermissionTimer = 0; this.introTimer = 0;
    this.introPhase = 0; this.introParticles = [];
    this.highScoreTimer = 0; this.highScoreRank = 0;
    this.highScoreParticles = [];
    this.comboTimer = 0; this.comboCount = 0; this.comboMultiplier = 1;
    this._pauseScores = [];
    this.settings = this._loadSettings();
  }

  init(level = 1) {
    this.level = level;
    this.map = RAW_MAP.map(r => [...r]);
    this.score = 0; this.lives = 3; this.dotsEaten = 0;
    this.frightTimer = 0; this.ghostEatCombo = 0;
    this.spawnTimer = 0; this.modeTimer = 0; this.modeIndex = 0;
    this.fruit = null; this.fruitCol = 10; this.fruitRow = 9;
    this.fruitTimer = 0; this.fruitIndex = 0;
    this.fruitSpawnTimer = 0; this.fruitSpawnAnim = 0; this.fruitParticles = [];
    this.fruitEatEffects = [];
    this._fruitOriginalTile = null;
    this.powerUpSpeedTimer = 0; this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false; this.powerUpShieldActive = false;
    this.comboTimer = 0; this.comboCount = 0; this.comboMultiplier = 1;

    this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER) this.dotsTotal++;

    const spd = getSpeeds(level);
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';

    this.ghosts = [
      { e: new Entity(10, 9, spd.blinky), color: '#ff0000', name: 'blinky', scatter: { x: 20, y: 0 }, mode: 'house', baseSpeed: spd.blinky },
      { e: new Entity(10, 11, spd.pinky), color: '#ffb8ff', name: 'pinky', scatter: { x: 0, y: 0 }, mode: 'house', baseSpeed: spd.pinky },
      { e: new Entity(11, 11, spd.inky), color: '#00ffff', name: 'inky', scatter: { x: 20, y: 20 }, mode: 'house', baseSpeed: spd.inky },
      { e: new Entity(9, 11, spd.clyde), color: '#ffb851', name: 'clyde', scatter: { x: 0, y: 20 }, mode: 'house', baseSpeed: spd.clyde }
    ];

    this.state = 'INTRO';
    this.introTimer = this._getIntroConfig().duration;
    this.introPhase = 0; this.introParticles = [];
    this.hideOverlay(false);
    this._updateMobileContinueBtn();
    Audio._muted = !this.settings.soundEnabled;
    if (this.settings.introEnabled) Audio.intro();
    this.lastTime = 0; this.inputQueue = [];
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
    this._initSettingsUI();
    this.loop(0);
  }

  startLevel() {
    this.map = RAW_MAP.map(r => [...r]);
    this.dotsEaten = 0; this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER) this.dotsTotal++;
    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman);
    this.pacman.dir = 'left';
    const gs = [spd.blinky, spd.pinky, spd.inky, spd.clyde];
    this.ghosts.forEach((g, i) => {
      const pos = [{ col: 10, row: 9 }, { col: 10, row: 11 }, { col: 11, row: 11 }, { col: 9, row: 11 }][i];
      g.e = new Entity(pos.col, pos.row, gs[i]);
      g.baseSpeed = gs[i]; g.mode = 'house';
    });
    this.frightTimer = 0; this.spawnTimer = 0; this.scorePopups = [];
    this.modeTimer = 0; this.modeIndex = 0;
    this.fruit = null; this.fruitCol = 10; this.fruitRow = 9;
    this.fruitTimer = 0; this.fruitIndex = 0; this.fruitSpawnTimer = 0; // reset para contagem de 30s
    this.fruitSpawnAnim = 0; this.fruitParticles = []; this.fruitEatEffects = [];
    this.powerUpSpeedTimer = 0; this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false; this.powerUpShieldActive = false;
    this.comboTimer = 0; this.comboCount = 0; this.comboMultiplier = 1;
    this.settings = this._loadSettings();
    if (this.level > 1 && this.settings.introEnabled) {
      this.state = 'INTRO'; this.introTimer = this._getIntroConfig().duration;
      this.introPhase = 0; this.introParticles = [];
      this.hideOverlay(false); Audio._muted = !this.settings.soundEnabled; Audio.intro();
    } else {
      this.state = 'READY'; this.readyTimer = 2.0; this._readySoundPlayed = false;
    }
    this.intermissionTimer = 0;
    this._updateMobileContinueBtn();
  }

  showOverlay(text, hint = '') {
    this.overlayText.textContent = text;
    this.overlayHint.textContent = hint;
    if (this.overlayEl) this.overlayEl.classList.add('show');
  }
  hideOverlay(immediate) { if (immediate && this.overlayEl) this.overlayEl.classList.remove('show'); }

  loop = (time) => {
    const dt = Math.min((time - this.lastTime) / 1000, 0.05);
    this.lastTime = time; this.update(dt); this.render();
    this.animFrame = requestAnimationFrame(this.loop);
  }

  async togglePause() {
    if (this.state === 'PLAYING') {
      this.state = 'PAUSED'; this._saveGame(); this.hideOverlay(true);
      await this._fetchPauseScores();
    } else if (this.state === 'PAUSED') {
      this.hideOverlay(true); this.state = 'PLAYING'; this.inputQueue = [];
    }
  }

  async _fetchPauseScores() {
    try { const res = await fetch('/api/scores?limit=5'); this._pauseScores = await res.json(); }
    catch (_) { this._pauseScores = []; }
  }

  _renderPause(ctx) {
    const cx = W / 2;
    ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⏸ PAUSADO', cx, 40);
    ctx.strokeStyle = '#333'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, 60); ctx.lineTo(W - 30, 60); ctx.stroke();
    ctx.fillStyle = '#aaa'; ctx.font = '10px monospace'; ctx.fillText('ESTATÍSTICAS', cx, 78);
    const stats = [
      { label: '🏆 Score', value: String(this.score), color: '#ffcc00' },
      { label: '🎯 Nível', value: String(this.level), color: '#44aaff' },
      { label: '❤️ Vidas', value: String(this.lives), color: '#ff4444' },
      { label: '🔥 Combo', value: this.comboCount > 1 ? `x${this.comboMultiplier.toFixed(1)} (${this.comboCount})` : '—', color: '#ff6644' },
      { label: '👻 Dots', value: `${this.dotsEaten}/${this.dotsTotal}`, color: '#ffb8ae' },
    ];
    let sy = 98;
    stats.forEach(s => {
      ctx.fillStyle = '#777'; ctx.font = '12px monospace'; ctx.textAlign = 'left'; ctx.fillText(s.label, 40, sy);
      ctx.fillStyle = s.color; ctx.font = 'bold 13px monospace'; ctx.textAlign = 'right'; ctx.fillText(s.value, W - 40, sy);
      sy += 22;
    });
    sy += 4; ctx.strokeStyle = '#333'; ctx.beginPath(); ctx.moveTo(30, sy); ctx.lineTo(W - 30, sy); ctx.stroke(); sy += 16;
    ctx.fillStyle = '#aaa'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('🏅 TOP SCORES', cx, sy); sy += 18;
    const scores = this._pauseScores || [];
    if (!scores.length) { ctx.fillStyle = '#555'; ctx.font = '11px monospace'; ctx.fillText('Nenhuma pontuação', cx, sy + 10); }
    else {
      const medals = ['🥇', '🥈', '🥉'];
      scores.forEach((s, i) => {
        const medal = i < 3 ? medals[i] : `${i + 1}.`;
        const isCurrent = s.score === this.score;
        ctx.fillStyle = isCurrent ? '#ffcc00' : '#888'; ctx.font = `${isCurrent ? 'bold ' : ''}12px monospace`;
        ctx.textAlign = 'left'; ctx.fillText(`${medal} ${String(s.score).padStart(6, ' ')}`, 50, sy);
        ctx.fillStyle = isCurrent ? '#ffcc00' : '#555'; ctx.font = '10px monospace';
        ctx.textAlign = 'right';        ctx.fillText(s.player_name || s.player_email || '', W - 50, sy); sy += 18;
      });
    }
    ctx.fillStyle = '#666'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
    ctx.fillText('P para continuar  •  ⚙️ Configurações', cx, H - 12);
  }

  update(dt) {
    if (this.state === 'PAUSED') return;
    this._aiConfig = this._getGhostAIConfig();

    if (this.state === 'INTRO') {
      const cfg = this._getIntroConfig(); this.introTimer -= dt;
      this._updateIntroParticles(dt);
      if (this.introTimer <= cfg.phase1At && this.introPhase === 0) this.introPhase = 1;
      if (this.introTimer <= cfg.phase2At && this.introPhase === 1) this.introPhase = 2;
      if (this.introTimer <= 0) this._finishIntro();
      return;
    }

    if (this.state === 'READY') {
      this.readyTimer -= dt;
      if (!this._readySoundPlayed) { Audio.ready(); this._readySoundPlayed = true; }
      if (this.readyTimer <= 0) { this.state = 'PLAYING'; this.spawnTimer = 0; }
      return;
    }

    if (this.state === 'DYING') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
          this.submitScore();
          this._showGameOverOverlay();
        } else {
          this.state = 'READY'; this.readyTimer = 1.0;
          this._readySoundPlayed = false; this.respawnEntities();
        }
      }
      return;
    }

    if (this.state === 'WIN') {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.level++; this._saveGame();
        this.state = 'INTERMISSION'; this.intermissionTimer = 3.0; this.hideOverlay(true);
      }
      return;
    }

    if (this.state === 'INTERMISSION') {
      this.intermissionTimer -= dt;
      if (this.intermissionTimer <= 0) this.startLevel();
      return;
    }

    if (this.state === 'NEWHIGHSCORE') {
      this.highScoreTimer -= dt; this._updateHighScoreParticles(dt);
      if (this.highScoreTimer <= 0) {
        this.state = 'GAMEOVER'; this._showGameOverOverlay();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    // Input
    for (const dir of this.inputQueue) this.pacman.setBufferedDir(dir, this.map, false);
    this.inputQueue = [];

    // Combo timer
    if (this.comboTimer > 0) { this.comboTimer -= dt; if (this.comboTimer <= 0) { this.comboCount = 0; this.comboMultiplier = 1; } }

    // Power-up timers
    if (this.powerUpSpeedTimer > 0) { this.powerUpSpeedTimer -= dt; if (this.powerUpSpeedTimer <= 0) { this.powerUpSpeedActive = false; this.pacman.speed = getSpeeds(this.level).pacman; } }
    if (this.powerUpShieldTimer > 0) { this.powerUpShieldTimer -= dt; if (this.powerUpShieldTimer <= 0) this.powerUpShieldActive = false; }

    // Move Pac-Man
    this.pacman.step(dt, this.map, false);

    // Check dot eating
    const tileCol = Math.round((this.pacman.px - TS / 2) / TS);
    const tileRow = Math.round((this.pacman.py - TS / 2) / TS);
    if (tileCol >= 0 && tileCol < COLS && tileRow >= 0 && tileRow < ROWS) {
      const t = this.map[tileRow][tileCol];
      if (t === TILE.DOT) {
        this.map[tileRow][tileCol] = TILE.EMPTY; this.score += 10; this.dotsEaten++;
        Audio.chomp(); this.updateUI();
      } else if (t === TILE.POWER) {
        this.map[tileRow][tileCol] = TILE.EMPTY; this.score += 50; this.dotsEaten++;
        this.activateFrightMode(); Audio.powerPellet(); this.updateUI();
      }
    }

    // ── FIX 3 — Fruta: spawna progressivamente a cada 2 minutos ──
    if (!this.fruit) {
      this.fruitSpawnTimer += dt;
      if (this.fruitSpawnTimer >= FRUIT_SPAWN_INTERVAL) {
        this.fruitSpawnTimer = 0;
        this._spawnFruit();
      }
    }      if (this.fruit) {
      this.fruitTimer -= dt;
      if (this.fruitSpawnAnim > 0) this.fruitSpawnAnim -= dt;
      // Atualiza partículas da fruta
      const fx = this.fruitCol * TS + TS / 2; const fy = this.fruitRow * TS + TS / 2;
      if (this.fruitSpawnAnim > 0 && Math.random() < 0.5) {
        const angle = Math.random() * Math.PI * 2;
        const dist = 8 + Math.random() * 6;
        this.fruitParticles.push({ x: fx + Math.cos(angle) * dist, y: fy + Math.sin(angle) * dist, vx: Math.cos(angle) * 15, vy: Math.sin(angle) * 15 - 20, life: 1.0, color: Math.random() > 0.5 ? '#ffcc00' : '#fff' });
      }
      for (let i = this.fruitParticles.length - 1; i >= 0; i--) {
        const p = this.fruitParticles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 2.5;
        if (p.life <= 0) this.fruitParticles.splice(i, 1);
      }
      // Atualiza efeitos de comer fruta
      for (let i = this.fruitEatEffects.length - 1; i >= 0; i--) {
        const e = this.fruitEatEffects[i];
        e.x += e.vx * dt; e.y += e.vy * dt;
        if (e.ring) { e.size += 120 * dt; } else { e.vy += 60 * dt; }
        e.life -= dt * 2.0;
        if (e.life <= 0) this.fruitEatEffects.splice(i, 1);
      }
      if (this.fruitTimer <= 0) {
        // Restaura tile original quando fruta expira (não quando é comida)
        if (this._fruitOriginalTile != null) {
          this.map[this.fruitRow][this.fruitCol] = this._fruitOriginalTile;
          this._fruitOriginalTile = null;
        }
        this.fruit = null; this.fruitSpawnTimer = 0; this.fruitParticles = [];
      }
      else {
        const dx = Math.abs(this.pacman.px - fx); const dy = Math.abs(this.pacman.py - fy);
        if (dx < TS * 0.7 && dy < TS * 0.7) {
          this.comboCount++; this.comboTimer = 3.0;
          this.comboMultiplier = 1 + (this.comboCount - 1) * 0.5;
          const fruitPts = Math.round(this.fruit.points * this.comboMultiplier);
          this.score += fruitPts;
          const label = this.comboCount > 1 ? `${fruitPts} x${this.comboMultiplier.toFixed(1)}!` : String(fruitPts);
          this._addScorePopup(fx, fy - 10, label);
          if (this.fruit.powerUp) this._activatePowerUp(this.fruit.powerUp); else Audio.eatFruit();
          if (this.comboCount > 1) Audio.combo(this.comboCount);
          // Efeito de comer fruta: burst de partículas + flash
          const eatColor = this.fruit.powerUp ? (this.fruit.powerUp === 'speed' ? '#00ff88' : '#4488ff') : '#ffcc00';
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const speed = 40 + Math.random() * 30;
            this.fruitEatEffects.push({ x: fx, y: fy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.0, color: i % 2 === 0 ? eatColor : '#fff', size: 2 + Math.random() * 2 });
          }
          this.fruitEatEffects.push({ x: fx, y: fy, vx: 0, vy: 0, life: 1.0, color: eatColor, size: 0, ring: true });
          // Restaura pastilha original sob a fruta
          if (this._fruitOriginalTile != null) {
            this.map[this.fruitRow][this.fruitCol] = this._fruitOriginalTile;
            this._fruitOriginalTile = null;
          }
          this.updateUI(); this.fruit = null; this.fruitTimer = 0; this.fruitSpawnTimer = 0; this.fruitParticles = [];
        }
      }
    }

    // Win check
    if (this.dotsEaten >= this.dotsTotal) {
      this.state = 'WIN'; this.winTimer = 2.0; this._saveGame();
      Audio.levelComplete(); this.showOverlay('NÍVEL COMPLETO!', 'Preparando próximo nível...');
      return;
    }

    // Ciclo scatter/CHASE
    if (this.frightTimer <= 0) {
      this.modeTimer += dt;
      const timings = SCATTERCHASE_BY_LEVEL[Math.min(this.level - 1, SCATTERCHASE_BY_LEVEL.length - 1)];
      let limit = timings[this.modeIndex];
      if (this._aiConfig && this._aiConfig.tier >= 3 && this.modeIndex % 2 === 0 && limit !== Infinity) limit = Math.max(limit * 0.5, 2);
      if (this.modeTimer >= limit) {
        this.modeTimer = 0; this.modeIndex = Math.min(this.modeIndex + 1, timings.length - 1);
        const isScatter = this.modeIndex % 2 === 0; Audio.modeSwitch();
        this.ghosts.forEach(g => {
          if (g.mode === 'chase' || g.mode === 'scatter') { g.mode = isScatter ? 'scatter' : 'chase'; g.e.dir = DIR_REV[g.e.dir]; }
        });
      }
    }

    if (this.frightTimer > 0) { this.frightTimer -= dt; if (this.frightTimer <= 0) this.endFrightMode(); }

    Audio._muted = !this.settings.soundEnabled;

    // ── Move fantasmas ──
    this.spawnTimer -= dt;
    this.ghosts.forEach((g, gi) => {
      if (g.mode === 'house') {
        const SPAWN_DELAYS = [0, 3, 6, 9];
        if (this.spawnTimer <= -SPAWN_DELAYS[gi]) g.mode = 'leaving';
        return;
      }
      if (g.mode === 'eaten') { this._moveEyesToHouse(g, dt); return; }

      // FIX 2 — Saída da casa: navega até coluna 10 (corredor) e sobe
      if (g.mode === 'leaving') {
        if (g.e.col !== 10) {
          g.e.dir = g.e.col < 10 ? 'right' : 'left';
          g.e.step(dt, this.map, true);
        } else if (g.e.row > 8) {
          g.e.dir = 'up';
          g.e.step(dt, this.map, true);
        } else {
          g.mode = this.modeIndex % 2 === 0 ? 'scatter' : 'chase';
        }
        return;
      }

      if (g.e.atCenter()) {
        const target = this.getGhostTarget(gi);
        g.e.dir = this.chooseGhostDir(g.e, target);
        if (g.mode === 'fright') g.e.speed = GHOST_FRIGHT_SPEED;
        else if (isInTunnel(g.e.col, g.e.row)) g.e.speed = GHOST_TUNNEL_SPEED;
        else g.e.speed = g.baseSpeed * this._getDifficultyMultiplier();
      }
      g.e.step(dt, this.map, true);

      if (this.checkCollision(this.pacman, g.e) && !this.powerUpShieldActive) {
        if (this.frightTimer > 0) {
          this.ghostEatCombo++; this.comboCount++; this.comboTimer = 3.0;
          this.comboMultiplier = 1 + (this.comboCount - 1) * 0.5;
          const basePts = 200 * Math.pow(2, this.ghostEatCombo - 1);
          const pts = Math.round(basePts * this.comboMultiplier);
          this.score += pts; Audio.eatGhost();
          if (this.comboCount > 1) Audio.combo(this.comboCount);
          const label = this.comboCount > 1 ? `${pts} x${this.comboMultiplier.toFixed(1)}!` : String(pts);
          this._addScorePopup(g.e.px, g.e.py, label); this.updateUI();
          g.mode = 'eaten'; g.e.dir = 'up';
        } else { this.pacmanDie(); return; }
      }
    });
  }

  // ── FIX 3 — Spawn de fruta em posição aleatória com pastilha ──
  _spawnFruit() {
    const candidates = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER)
          candidates.push({ c, r });
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    // Salva tile original e limpa para a fruta aparecer limpa
    this._fruitOriginalTile = this.map[pick.r][pick.c];
    this.map[pick.r][pick.c] = TILE.EMPTY;
    this.fruit = FRUITS[this.fruitIndex];
    this.fruitCol = pick.c;
    this.fruitRow = pick.r;
    this.fruitTimer = FRUIT_DURATION;
    this.fruitSpawnAnim = 2.0; // 2s de animação de spawn
    this.fruitParticles = []; // reseta partículas
    this.fruitIndex = (this.fruitIndex + 1) % FRUITS.length;
    Audio.powerUp(); // som ao aparecer
  }

  _getGhostAIConfig() {
    const lvl = this.level;
    if (lvl <= 1) return { tier: 1, blinkyAhead: 0, pinkyAhead: 4, inkyPivot: 2, clydeThreshold: 8, clydeAlwaysChase: false, lookAheadTiles: 0, flankEnabled: false, coordinationEnabled: false, retreatThreshold: 10 };
    if (lvl <= 3) return { tier: 2, blinkyAhead: 1, pinkyAhead: 5, inkyPivot: 3, clydeThreshold: 6, clydeAlwaysChase: false, lookAheadTiles: 1, flankEnabled: false, coordinationEnabled: false, retreatThreshold: 8 };
    if (lvl <= 6) return { tier: 3, blinkyAhead: 2, pinkyAhead: 6, inkyPivot: 3, clydeThreshold: 4, clydeAlwaysChase: false, lookAheadTiles: 2, flankEnabled: true, coordinationEnabled: false, retreatThreshold: 6 };
    return { tier: 4, blinkyAhead: 3, pinkyAhead: 7, inkyPivot: 4, clydeThreshold: 0, clydeAlwaysChase: true, lookAheadTiles: 3, flankEnabled: true, coordinationEnabled: true, retreatThreshold: 4 };
  }

  getGhostTarget(gi) {
    const g = this.ghosts[gi]; const ai = this._aiConfig || this._getGhostAIConfig();
    if (this.frightTimer > 0) {
      const corners = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 0, y: 20 }];
      return corners[gi % corners.length];
    }
    if (g.mode === 'scatter') {
      if (ai.coordinationEnabled && gi === 0) return { x: this.pacman.col, y: this.pacman.row };
      return g.scatter;
    }
    const p = this.pacman; const d = DIR[p.dir];
    switch (gi) {
      case 0: { const dx = d ? d.dx : 0; const dy = d ? d.dy : 0; return { x: p.col + dx * ai.blinkyAhead, y: p.row + dy * ai.blinkyAhead }; }
      case 1: { const dx = d ? d.dx : 0; const dy = d ? d.dy : 0; if (ai.flankEnabled && g.e.distTo(p.col, p.row) < ai.retreatThreshold) return { x: p.col - dx * 2, y: p.row - dy * 2 }; return { x: p.col + dx * ai.pinkyAhead, y: p.row + dy * ai.pinkyAhead }; }
      case 2: { const blinky = this.ghosts[0].e; const dx = d ? d.dx : 0; const dy = d ? d.dy : 0; const pivotX = p.col + dx * ai.inkyPivot; const pivotY = p.row + dy * ai.inkyPivot; const bd = DIR[blinky.dir]; const bTargetX = blinky.col + (bd ? bd.dx * ai.lookAheadTiles : 0); const bTargetY = blinky.row + (bd ? bd.dy * ai.lookAheadTiles : 0); return { x: pivotX * 2 - bTargetX, y: pivotY * 2 - bTargetY }; }
      case 3: { const dist = g.e.distTo(p.col, p.row); if (ai.clydeAlwaysChase || dist > ai.clydeThreshold) { if (ai.coordinationEnabled) { const dx = d ? d.dx : 0; const dy = d ? d.dy : 0; return { x: p.col + dx * 2, y: p.row + dy * 2 }; } return { x: p.col, y: p.row }; } return g.scatter; }
      default: return { x: p.col, y: p.row };
    }
  }

  _moveEyesToHouse(g, dt) {
    const HOUSE_X = 10, HOUSE_Y = 8;
    const tx = HOUSE_X * TS + TS / 2; const ty = HOUSE_Y * TS + TS / 2;
    const dx = tx - g.e.px; const dy = ty - g.e.py;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const speed = g.baseSpeed * GHOST_EYES_SPEED_MULT * TS * dt;
    if (dist <= speed + 1) {
      g.e.col = HOUSE_X; g.e.row = 11;
      g.e.px = HOUSE_X * TS + TS / 2; g.e.py = 11 * TS + TS / 2;
      g.e.targetX = g.e.px; g.e.targetY = g.e.py;
      g.mode = 'leaving';
    } else {
      g.e.px += (dx / dist) * speed; g.e.py += (dy / dist) * speed;
      if (Math.abs(dx) > Math.abs(dy)) g.e.dir = dx > 0 ? 'right' : 'left';
      else g.e.dir = dy > 0 ? 'down' : 'up';
    }
  }

  chooseGhostDir(ghost, target) {
    const dirs = DIR_LIST.filter(d => d.name !== DIR_REV[ghost.dir]);
    let best = ghost.dir; let bestDist = Infinity;
    for (const d of dirs) {
      const nc = ghost.col + d.dx; const nr = ghost.row + d.dy;
      if (!ghost.canMoveTo(nc, nr, this.map, true)) continue;
      const dist = Math.abs(nc - target.x) + Math.abs(nr - target.y);
      if (dist < bestDist) { bestDist = dist; best = d.name; }
    }
    return best;
  }

  _activatePowerUp(type) {
    if (type === 'speed') {
      this.powerUpSpeedActive = true; this.powerUpSpeedTimer = POWERUP_SPEED_DURATION;
      this.pacman.speed = getSpeeds(this.level).pacman * POWERUP_SPEED_MULT;
      Audio.powerUp(); this._addScorePopup(this.pacman.px, this.pacman.py - 20, '⚡ SPEED!');
    } else if (type === 'shield') {
      this.powerUpShieldActive = true; this.powerUpShieldTimer = POWERUP_SHIELD_DURATION;
      Audio.powerUp(); this._addScorePopup(this.pacman.px, this.pacman.py - 20, '🛡️ SHIELD!');
    }
  }

  activateFrightMode() {
    this.frightTimer = this.frightDuration + this.level * 0.5; this.ghostEatCombo = 0;
    this._savedModeIndex = this.modeIndex; this._savedModeTimer = this.modeTimer;
    this.ghosts.forEach(g => { if (g.mode === 'chase' || g.mode === 'scatter') { g.e.dir = DIR_REV[g.e.dir]; g.mode = 'fright'; } });
  }

  endFrightMode() {
    this.frightTimer = 0;
    this.modeIndex = this._savedModeIndex != null ? this._savedModeIndex : this.modeIndex;
    this.modeTimer = this._savedModeTimer != null ? this._savedModeTimer : this.modeTimer;
    const isScatter = this.modeIndex % 2 === 0;
    this.ghosts.forEach(g => { if (g.mode === 'fright') { g.mode = isScatter ? 'scatter' : 'chase'; g.e.dir = DIR_REV[g.e.dir]; } });
  }

  // FIX 4 — Auto-save ao perder vida
  pacmanDie() {
    this._saveGame(); // salva ANTES de decrementar (preserve vidas no save)
    this.lives--; this.state = 'DYING'; this.dyingTimer = 1.5;
    Audio.death(); this.updateUI();
  }

  // Overlay de GAMEOVER com Continue/Restart
  _showGameOverOverlay() {
    const hasSave = this._hasSave();
    if (hasSave) {
      this.showOverlay('GAME OVER', 'C continuar  •  N reiniciar');
    } else {
      this.showOverlay('GAME OVER', 'Pressione ESPAÇO');
    }
    this._updateMobileContinueBtn();
  }

  // Mostra/esconde botão Continue no mobile
  _updateMobileContinueBtn() {
    const btn = document.getElementById('mobile-continue');
    if (!btn) return;
    const show = this.state === 'GAMEOVER' && this._hasSave();
    btn.style.display = show ? 'flex' : 'none';
  }

  respawnEntities() {
    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman); this.pacman.dir = 'left';
    const gs = [spd.blinky, spd.pinky, spd.inky, spd.clyde];
    this.ghosts.forEach((g, i) => {
      const pos = [{ col: 10, row: 9 }, { col: 10, row: 11 }, { col: 11, row: 11 }, { col: 9, row: 11 }][i];
      g.e = new Entity(pos.col, pos.row, gs[i]); g.baseSpeed = gs[i]; g.mode = 'house';
    });
    this.frightTimer = 0; this.spawnTimer = 0; this.scorePopups = [];
    this.modeTimer = 0; this.modeIndex = 0;
    this.fruit = null; this.fruitCol = 10; this.fruitRow = 9;
    this.fruitTimer = 0; this.fruitIndex = 0; this.fruitSpawnTimer = 0;
    this.fruitSpawnAnim = 0; this.fruitParticles = []; this.fruitEatEffects = [];
    this.powerUpSpeedTimer = 0; this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false; this.powerUpShieldActive = false;
    this.comboTimer = 0; this.comboCount = 0; this.comboMultiplier = 1;
  }

  checkCollision(a, b) {
    return Math.abs(a.px - b.px) < TS * 0.7 && Math.abs(a.py - b.py) < TS * 0.7;
  }

  async submitScore() {
    const token = localStorage.getItem('token');
    if (!token) return;
    try {
      await fetch('/api/scores', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ score: this.score }) });
      const res = await fetch('/api/scores?limit=10'); const scores = await res.json();
      const rank = scores.findIndex(s => s.score <= this.score && s.player_email);
      if (rank >= 0 && this.score > 0) {
        this.highScoreRank = rank + 1; this.highScoreTimer = 4.0; this.highScoreParticles = [];
        this.state = 'NEWHIGHSCORE'; this.hideOverlay(true); Audio.celebrate(); return;
      }
    } catch (_) {}
  }

  // ── RENDER ──────────────────────────────────────────────
  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const t = this.map[r][c]; const x = c * TS, y = r * TS;
        if (t === TILE.WALL) {
          ctx.fillStyle = '#2121de'; ctx.fillRect(x + 1, y + 1, TS - 2, TS - 2);
          ctx.fillStyle = '#000';
          if (r > 0 && this.map[r-1][c] === TILE.WALL) ctx.fillRect(x+1, y, TS-2, 2);
          if (r < ROWS-1 && this.map[r+1][c] === TILE.WALL) ctx.fillRect(x+1, y+TS-2, TS-2, 2);
          if (c > 0 && this.map[r][c-1] === TILE.WALL) ctx.fillRect(x, y+1, 2, TS-2);
          if (c < COLS-1 && this.map[r][c+1] === TILE.WALL) ctx.fillRect(x+TS-2, y+1, 2, TS-2);
        } else if (t === TILE.GHOUSE) { ctx.fillStyle = '#222'; ctx.fillRect(x, y, TS, TS); }
        else if (t === TILE.DOOR) { ctx.fillStyle = '#ffb8ff'; ctx.fillRect(x, y + TS/2 - 2, TS, 4); }
        else if (t === TILE.DOT) { ctx.fillStyle = '#ffb8ae'; ctx.beginPath(); ctx.arc(x + TS/2, y + TS/2, 2.5, 0, Math.PI * 2); ctx.fill(); }
        else if (t === TILE.POWER) { ctx.fillStyle = '#ffb8ae'; ctx.beginPath(); ctx.arc(x + TS/2, y + TS/2, 5 + Math.sin(Date.now() / 200) * 1.5, 0, Math.PI * 2); ctx.fill(); }
      }
    }

    if (this.frightTimer > 0) {
      const alpha = 0.06 + Math.sin(Date.now() / 150) * 0.04;
      ctx.fillStyle = `rgba(33,33,222,${alpha})`; ctx.fillRect(0, 0, W, H);
    }

    this.ghosts.forEach(g => {
      if (g.mode === 'eaten') this.drawGhostEyes(ctx, g);
      else { if (g.mode === 'house' || g.mode === 'leaving') ctx.globalAlpha = 0.5; this.drawGhost(ctx, g); }
      ctx.globalAlpha = 1;
    });

    // FIX 3 — Fruta renderiza com efeito de brilho/spawn
    if (this.fruit) {
      const fx = this.fruitCol * TS + TS / 2; const fy = this.fruitRow * TS + TS / 2;
      const now = Date.now();
      // Efeito de pulse durante spawn (primeiros 2s)
      const spawnPhase = this.fruitSpawnAnim > 0;
      const spawnAlpha = spawnPhase ? Math.min((2.0 - this.fruitSpawnAnim) * 3, 1) : 1;
      const spawnScale = spawnPhase ? 0.5 + (2.0 - this.fruitSpawnAnim) * 0.5 : 1;
      // Pulse constante
      const pulse = this.fruitTimer < 3 ? 0.7 + Math.sin(now / 100) * 0.3 : 1;
      // Brilho/ring durante spawn
      if (spawnPhase) {
        const ringR = (2.0 - this.fruitSpawnAnim) * 20;
        const ringAlpha = Math.max(0, 1 - (2.0 - this.fruitSpawnAnim) / 2);
        ctx.save(); ctx.globalAlpha = ringAlpha * 0.6;
        ctx.strokeStyle = '#ffcc00'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fx, fy, ringR, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        // Glow
        ctx.save(); ctx.globalAlpha = ringAlpha * 0.3;
        ctx.fillStyle = '#ffcc00'; ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 15;
        ctx.beginPath(); ctx.arc(fx, fy, 14, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0; ctx.restore();
      }
      // Partículas
      this.fruitParticles.forEach(p => {
        ctx.save(); ctx.globalAlpha = Math.max(0, p.life) * 0.8;
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      });
      // Fruta (emoji)
      ctx.save(); ctx.globalAlpha = spawnAlpha * pulse;
      ctx.translate(fx, fy); ctx.scale(spawnScale, spawnScale);
      ctx.font = `${TS}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(this.fruit.emoji, 0, 0);
      ctx.restore(); ctx.globalAlpha = 1;
    }

    this.drawPacman(ctx); this._drawScorePopups(ctx);

    if (this.state === 'PLAYING' && this.comboCount > 1 && this.comboTimer > 0) {
      const comboAlpha = Math.min(this.comboTimer / 1.0, 1);
      ctx.globalAlpha = comboAlpha; ctx.fillStyle = '#ff4444'; ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'right'; ctx.textBaseline = 'top';
      ctx.fillText(`COMBO x${this.comboMultiplier.toFixed(1)}`, W - 8, 4);
      ctx.fillStyle = '#ffcc00'; ctx.fillRect(8, 4, (W - 16) * (this.comboTimer / 3.0), 3);
      ctx.globalAlpha = 1;
    }

    if (this.state === 'INTRO') this._renderIntro(ctx);
    if (this.state === 'INTERMISSION') this._renderIntermission(ctx);
    if (this.state === 'NEWHIGHSCORE') this._renderHighScore(ctx);

    if (this.state === 'READY' && this.readyTimer > 0) {
      const phase = this.readyTimer > 1.0 ? 'LEVEL' : 'READY!';
      const label = this.readyTimer > 1.0 ? `NÍVEL ${this.level}` : '';
      ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(phase, W / 2, H / 2 - 8);
      if (label) { ctx.font = 'bold 14px monospace'; ctx.fillStyle = '#fff'; ctx.fillText(label, W / 2, H / 2 + 15); }
    }

    if (this.state === 'DYING') {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(Date.now() / 80) * 0.15})`; ctx.fillRect(0, 0, W, H);
    }

    // Efeitos de comer fruta (flash + partículas)
    if (this.fruitEatEffects.length > 0) {
      this.fruitEatEffects.forEach(e => {
        ctx.save(); ctx.globalAlpha = Math.max(0, e.life);
        if (e.ring) {
          ctx.strokeStyle = e.color; ctx.lineWidth = 2 * e.life;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2); ctx.stroke();
        } else {
          ctx.fillStyle = e.color;
          ctx.beginPath(); ctx.arc(e.x, e.y, e.size * e.life, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
      });
    }

    if (this.state === 'PAUSED') this._renderPause(ctx);

    // Copyright moved to HTML above game-header
  }

  drawPacman(ctx) {
    const p = this.pacman; const x = p.px, y = p.py; const r = TS * 0.42;
    const mouth = this.state === 'DYING' ? 0 : Math.abs(Math.sin(Date.now() / 100)) * 0.35 + 0.05;
    const angle = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 }[p.dir] || 0;
    if (this.powerUpSpeedActive || this.powerUpShieldActive) {
      ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(Date.now() / 80) * 0.15;
      ctx.fillStyle = this.powerUpSpeedActive ? '#00ff88' : '#4488ff';
      ctx.beginPath(); ctx.arc(x, y, r * 2.0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = this.powerUpShieldActive ? '#88ccff' : '#ffcc00';
    ctx.beginPath(); ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  _getGhostVisualTier() { return (this._aiConfig || this._getGhostAIConfig()).tier; }

  drawGhost(ctx, g) {
    const e = g.e; const x = e.px, y = e.py; const r = TS * 0.4;
    const isFright = this.frightTimer > 0 && g.mode !== 'house' && g.mode !== 'leaving' && g.mode !== 'eaten';
    const tier = this._getGhostVisualTier(); const now = Date.now();
    let flash = false;
    if (isFright) { if (this.frightTimer < 1) flash = Math.floor(now / 80) % 2 === 0; else if (this.frightTimer < 2) flash = Math.floor(now / 140) % 2 === 0; else flash = Math.floor(now / 250) % 2 === 0; }
    let color = isFright ? (flash ? '#fff' : '#2121de') : g.color;
    const wobble = isFright ? Math.sin(now / 60) * 1.5 : 0;

    if (tier >= 3 && !isFright) { ctx.save(); ctx.globalAlpha = 0.15 + Math.sin(now / 300 + g.e.col) * 0.08; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(x + 2, y - r * 0.2 + 3, r * 1.1, Math.PI, 0); ctx.lineTo(x + r + 2, y + r * 0.6 + 3); ctx.lineTo(x - r - 2, y + r * 0.6 + 3); ctx.closePath(); ctx.fill(); ctx.restore(); }

    if (tier >= 4 && !isFright && g.mode !== 'house' && g.mode !== 'leaving') {
      if (!g._trail) g._trail = [];
      if (!g._lastTrailTime || now - g._lastTrailTime > 50) { g._lastTrailTime = now; g._trail.push({ x, y, t: now }); }
      while (g._trail.length > 4) g._trail.shift();
      g._trail.forEach((snap, i) => { const age = (now - snap.t) / 80; const alpha = 0.12 * (1 - age); if (alpha <= 0) return; ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(snap.x, snap.y - r * 0.2, r * (0.9 + i * 0.02), Math.PI, 0); ctx.lineTo(snap.x + r, snap.y + r * 0.6); ctx.lineTo(snap.x - r, snap.y + r * 0.6); ctx.closePath(); ctx.fill(); ctx.restore(); });
    } else if (g._trail) g._trail = [];

    ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 0.2 + wobble, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r * 0.6 + wobble);
    const wave = 4;
    for (let i = 0; i < 4; i++) { const bx = x + r - (i / 4) * r * 2; ctx.quadraticCurveTo(bx - r/4, y + r * 0.6 + wobble + (i % 2 === 0 ? -wave : wave), bx - r/2, y + r * 0.6 + wobble); }
    ctx.closePath(); ctx.fill();

    if (tier >= 2 && !isFright) { ctx.save(); const glowAlpha = tier >= 4 ? 0.20 + Math.sin(now / 250) * 0.08 : 0.10 + Math.sin(now / 400) * 0.05; const glowR = tier >= 4 ? r * 1.8 : r * 1.4; ctx.globalAlpha = glowAlpha; ctx.shadowColor = color; ctx.shadowBlur = tier >= 4 ? 14 : 8; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y - r * 0.2 + wobble, glowR, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore(); }

    if (!isFright) {
      const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0;
      const dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0;
      if (tier >= 4) {
        ctx.save(); ctx.shadowColor = '#ff4444'; ctx.shadowBlur = 6 + Math.sin(now / 200) * 3; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2.2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2.2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        const irisPulse = 1.0 + Math.sin(now / 180) * 0.2; ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(x - 2.5 + dx*1.8, y - r * 0.2 + dy*1.8, 1.1 * irisPulse, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx*1.8, y - r * 0.2 + dy*1.8, 1.1 * irisPulse, 0, Math.PI*2); ctx.fill(); ctx.restore();
      } else if (tier >= 3) {
        ctx.save(); ctx.shadowColor = '#aaaaff'; ctx.shadowBlur = 4; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill(); ctx.shadowBlur = 0;
        ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(x - 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill(); ctx.restore();
      } else {
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(x - 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
      }
    } else {
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 2.5, y - r * 0.2 + wobble, 2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5, y - r * 0.2 + wobble, 2, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = '#f00'; ctx.beginPath(); ctx.arc(x - 2.5, y - r * 0.2 + wobble, 1, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 2.5, y - r * 0.2 + wobble, 1, 0, Math.PI*2); ctx.fill();
    }
  }

  _drawScorePopups(ctx) {
    const now = Date.now();
    for (let i = this.scorePopups.length - 1; i >= 0; i--) {
      const sp = this.scorePopups[i]; const elapsed = now - sp.time;
      if (elapsed > 800) { this.scorePopups.splice(i, 1); continue; }
      const progress = elapsed / 800; ctx.globalAlpha = 1 - progress;
      ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
      ctx.fillText(sp.text, sp.x, sp.y - progress * 25); ctx.globalAlpha = 1;
    }
  }
  _addScorePopup(x, y, text) { this.scorePopups.push({ x, y, text, time: Date.now() }); }

  drawGhostEyes(ctx, g) {
    const e = g.e; const x = e.px, y = e.py; const r = TS * 0.3;
    const tier = this._getGhostVisualTier(); const now = Date.now();
    const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0;
    const dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0;
    ctx.save(); if (tier >= 3) { ctx.shadowColor = tier >= 4 ? '#ff6666' : '#aaaaff'; ctx.shadowBlur = tier >= 4 ? 6 : 3; }
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - 3, y - 1, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3, y - 1, r * 0.7, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    if (tier >= 4) { const pulse = 1.0 + Math.sin(now / 180) * 0.15; ctx.fillStyle = '#ff2222'; ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35 * pulse, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35 * pulse, 0, Math.PI * 2); ctx.fill(); }
    else if (tier >= 3) { ctx.fillStyle = '#4444ff'; ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(x - 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(x + 3 + dx * 1.5, y - 1 + dy * 1.5, r * 0.35, 0, Math.PI * 2); ctx.fill(); }
  }

  _finishIntro() {
    this.introTimer = 0;
    if (this.level > 1) { this.state = 'READY'; this.readyTimer = 2.0; this._readySoundPlayed = false; }
    else { this.state = 'IDLE'; this._showIdleOverlay(); setTimeout(() => { if (this.state === 'IDLE') this._showRanking(); }, 300); }
  }

  _settingsKey() { return 'pacman_settings'; }
  _loadSettings() {
    const defaults = { introEnabled: true, soundEnabled: true, difficulty: 'normal' };
    try { const raw = localStorage.getItem(this._settingsKey()); if (raw) { const loaded = { ...defaults, ...JSON.parse(raw) }; if (!['easy','normal','hard'].includes(loaded.difficulty)) loaded.difficulty = 'normal'; return loaded; } } catch (_) {}
    return defaults;
  }
  _saveSettings() { try { localStorage.setItem(this._settingsKey(), JSON.stringify(this.settings)); } catch (_) {} }
  _getDifficultyMultiplier() { return this.settings.difficulty === 'easy' ? 0.7 : this.settings.difficulty === 'hard' ? 1.3 : 1.0; }
  _toggleSound() { this.settings.soundEnabled = !this.settings.soundEnabled; Audio._muted = !this.settings.soundEnabled; this._saveSettings(); this._updateMuteBtn(); const st = document.getElementById('set-sound'); if (st) st.checked = this.settings.soundEnabled; }
  _updateMuteBtn() { const mb = document.getElementById('mute-btn'); if (!mb) return; mb.textContent = this.settings.soundEnabled ? '🔊' : '🔇'; mb.classList.toggle('muted', !this.settings.soundEnabled); mb.title = this.settings.soundEnabled ? 'Silenciar som' : 'Ativar som'; }

  _initSettingsUI() {
    const modal = document.getElementById('settings-modal'); const btn = document.getElementById('settings-btn');
    const closeBtn = document.getElementById('settings-close');
    const introToggle = document.getElementById('set-intro'); const soundToggle = document.getElementById('set-sound');
    const muteBtn = document.getElementById('mute-btn'); const diffBtns = document.querySelectorAll('.diff-btn');
    if (!modal || !btn) return;
    if (muteBtn) { this._updateMuteBtn(); muteBtn.onclick = () => this._toggleSound(); }
    introToggle.checked = this.settings.introEnabled; soundToggle.checked = this.settings.soundEnabled;
    diffBtns.forEach(b => b.classList.toggle('active', b.dataset.diff === this.settings.difficulty));
    btn.onclick = () => { const wasPlaying = this.state === 'PLAYING'; if (wasPlaying) this.togglePause(); modal.classList.add('show'); this._settingsWasPaused = wasPlaying; };
    const closeModal = () => { modal.classList.remove('show'); if (this._settingsWasPaused && this.state === 'PAUSED') this.togglePause(); };
    closeBtn.onclick = closeModal; modal.onclick = (e) => { if (e.target === modal) closeModal(); };
    introToggle.onchange = () => { this.settings.introEnabled = introToggle.checked; this._saveSettings(); };
    soundToggle.onchange = () => {
      this.settings.soundEnabled = soundToggle.checked;
      Audio._muted = !this.settings.soundEnabled;
      this._saveSettings();
      this._updateMuteBtn();
    };
    diffBtns.forEach(b => { b.onclick = () => { diffBtns.forEach(x => x.classList.remove('active')); b.classList.add('active'); this.settings.difficulty = b.dataset.diff; this._saveSettings(); }; });
    // Ranking modal
    const rnkBtn = document.getElementById('ranking-btn');
    const rnkModal = document.getElementById('ranking-modal');
    const rnkClose = document.getElementById('ranking-close');
    if (rnkBtn) rnkBtn.onclick = () => this._showRanking();
    if (rnkClose) rnkClose.onclick = () => this._hideRanking();
    if (rnkModal) rnkModal.onclick = (e) => { if (e.target === rnkModal) this._hideRanking(); };
  }

  // ── SAVE/RESUME ─────────────────────────────────────────
  _saveKey() { return 'pacman_save'; }
  _saveGame() {
    const data = { level: this.level, score: this.score, lives: this.lives, map: this.map, dotsEaten: this.dotsEaten, fruitIndex: this.fruitIndex, fruitSpawnTimer: this.fruitSpawnTimer, modeIndex: this.modeIndex, modeTimer: this.modeTimer, timestamp: Date.now() };
    try { localStorage.setItem(this._saveKey(), JSON.stringify(data)); } catch (_) {}
  }
  _hasSave() { try { const raw = localStorage.getItem(this._saveKey()); if (!raw) return false; const data = JSON.parse(raw); return data && data.level >= 1; } catch (_) { return false; } }
  _loadGame() { try { const raw = localStorage.getItem(this._saveKey()); return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
  _clearSave() { try { localStorage.removeItem(this._saveKey()); } catch (_) {} }

  resumeGame(saveData) {
    this.level = saveData.level; this.map = saveData.map; this.score = saveData.score;
    this.lives = saveData.lives; this.dotsEaten = saveData.dotsEaten;
    this.fruitIndex = saveData.fruitIndex || 0;
    this.fruitSpawnTimer = saveData.fruitSpawnTimer || 0;
    this.modeIndex = saveData.modeIndex || 0; this.modeTimer = saveData.modeTimer || 0;
    this.dotsTotal = this.dotsEaten; // BUG FIX: inclui dots já comidos no total
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER) this.dotsTotal++;
    const spd = getSpeeds(this.level);
    this.pacman = new Entity(10, 15, spd.pacman); this.pacman.dir = 'left';
    this.ghosts = [
      { e: new Entity(10, 9, spd.blinky), color: '#ff0000', name: 'blinky', scatter: { x: 20, y: 0 }, mode: 'house', baseSpeed: spd.blinky },
      { e: new Entity(10, 11, spd.pinky), color: '#ffb8ff', name: 'pinky', scatter: { x: 0, y: 0 }, mode: 'house', baseSpeed: spd.pinky },
      { e: new Entity(11, 11, spd.inky), color: '#00ffff', name: 'inky', scatter: { x: 20, y: 20 }, mode: 'house', baseSpeed: spd.inky },
      { e: new Entity(9, 11, spd.clyde), color: '#ffb851', name: 'clyde', scatter: { x: 0, y: 20 }, mode: 'house', baseSpeed: spd.clyde }
    ];
    this.frightTimer = 0; this.ghostEatCombo = 0; this.spawnTimer = 0;
    this.modeTimer = 0; this.modeIndex = 0;
    this.fruit = null; this.fruitCol = 10; this.fruitRow = 9; this.fruitTimer = 0;
    this.scorePopups = []; this.powerUpSpeedTimer = 0; this.powerUpShieldTimer = 0;
    this.powerUpSpeedActive = false; this.powerUpShieldActive = false;
    this.settings = this._loadSettings();
    this.state = 'READY'; this.readyTimer = 2.0; this._readySoundPlayed = false;
    this.hideOverlay(true); this.updateUI();
    this._hideRanking();
    this._updateMobileContinueBtn();
  }

  _showIdleOverlay() {
    if (this._hasSave()) this.showOverlay('PRESSIONE ESPAÇO', 'continuar  •  N novo jogo');
    else this.showOverlay('PRESSIONE ESPAÇO', 'para começar');
  }

  _showRanking() {
    const modal = document.getElementById('ranking-modal');
    if (!modal) return;
    modal.classList.add('show');
    this._fetchRankingScores();
  }
  _hideRanking() {
    const modal = document.getElementById('ranking-modal');
    if (modal) modal.classList.remove('show');
  }
  async _fetchRankingScores() {
    try {
      const res = await fetch('/api/scores?limit=10');
      const scores = await res.json();
      const list = document.getElementById('ranking-list');
      if (!list) return;
      if (!scores.length) { list.innerHTML = '<li style="color:#555;">Nenhuma pontuação ainda</li>'; return; }
      list.innerHTML = scores.map((s, i) => {
        const medals = ['🥇', '🥈', '🥉'];
        const medal = i < 3 ? medals[i] + ' ' : `${i + 1}. `;
        const date = new Date(s.created_at + 'Z').toLocaleDateString('pt-BR');
        return `<li>${medal}<span style="color:#ffcc00;font-weight:bold">${s.score.toLocaleString()}</span> <span style="color:#888">${s.player_name || s.player_email}</span> <span style="color:#555;font-size:11px">${date}</span></li>`;
      }).join('');
    } catch (_) {}
  }

  _getIntroConfig() {
    const lvl = this.level;
    if (lvl <= 1) return { tier: 1, duration: 3.5, phase1At: 2.5, phase2At: 1.0, title: 'PAC-MAN', titleColor: '#ffcc00', bgColor: 'rgba(0,0,0,0.85)', pacSpeed: 200, ghostSpeed: 3, subtitle: 'RETRO EDITION', subtitleColor: '#2121de', showParticles: false, screenShake: false };
    if (lvl <= 3) return { tier: 2, duration: 3.2, phase1At: 2.2, phase2At: 0.8, title: 'PAC-MAN', titleColor: '#44aaff', bgColor: 'rgba(0,0,20,0.88)', pacSpeed: 260, ghostSpeed: 4, subtitle: `NÍVEL ${lvl}`, subtitleColor: '#44aaff', showParticles: false, screenShake: false };
    if (lvl <= 6) return { tier: 3, duration: 2.8, phase1At: 1.8, phase2At: 0.6, title: 'PAC-MAN', titleColor: '#ff6644', bgColor: 'rgba(20,0,0,0.90)', pacSpeed: 340, ghostSpeed: 5, subtitle: `⚡ NÍVEL ${lvl} ⚡`, subtitleColor: '#ff6644', showParticles: true, screenShake: false };
    return { tier: 4, duration: 2.5, phase1At: 1.5, phase2At: 0.4, title: 'PAC-MAN', titleColor: '#ff0044', bgColor: 'rgba(30,0,10,0.92)', pacSpeed: 420, ghostSpeed: 6, subtitle: `🔥 NÍVEL ${lvl} — MÁXIMO 🔥`, subtitleColor: '#ff0044', showParticles: true, screenShake: true };
  }

  _updateIntroParticles(dt) {
    const cfg = this._getIntroConfig(); if (!cfg.showParticles) return;
    if (Math.random() < 0.6) { const colors = ['#ffcc00', '#ff0044', '#ff6644', '#fff']; this.introParticles.push({ x: Math.random() * W, y: -5, vy: 30 + Math.random() * 50, vx: (Math.random() - 0.5) * 30, color: colors[Math.floor(Math.random() * colors.length)], size: 1 + Math.random() * 2, life: 1.0 }); }
    for (let i = this.introParticles.length - 1; i >= 0; i--) { const p = this.introParticles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt * 0.5; if (p.life <= 0 || p.y > H + 5) this.introParticles.splice(i, 1); }
  }

  _renderIntermission(ctx) {
    const progress = 1 - (this.intermissionTimer / 3.0);
    const alpha = Math.min(Math.min(progress * 3, 1), this.intermissionTimer < 0.5 ? this.intermissionTimer * 2 : 1);
    ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(0,0,0,0.88)'; ctx.fillRect(0, 0, W, H);
    const cx = W / 2; let y = H / 2 - 50;
    ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('NÍVEL COMPLETO!', cx, y);
    y += 30; ctx.fillStyle = '#fff'; ctx.font = 'bold 24px monospace'; ctx.fillText(`NÍVEL ${this.level}`, cx, y);
    y += 35; ctx.fillStyle = '#ffb8ae'; ctx.font = '14px monospace'; ctx.fillText('PONTUAÇÃO', cx, y - 10); ctx.fillStyle = '#fff'; ctx.font = 'bold 20px monospace'; ctx.fillText(String(this.score), cx, y + 12);
    y += 45; ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText('VIDAS', cx, y - 5);
    for (let i = 0; i < this.lives; i++) { const lx = cx - ((this.lives - 1) * 12) + i * 24; ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(lx, y + 12, 6, 0.25 * Math.PI, 1.75 * Math.PI); ctx.lineTo(lx, y + 12); ctx.closePath(); ctx.fill(); }
    y += 38; const gc = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851']; const gn = ['BLINKY', 'PINKY', 'INKY', 'CLYDE']; ctx.font = '8px monospace';
    gc.forEach((color, i) => { const gx = cx - 45 + i * 30; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(gx, y, 5, Math.PI, 0); ctx.lineTo(gx + 5, y + 6); ctx.lineTo(gx - 5, y + 6); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#888'; ctx.fillText(gn[i], gx, y + 14); });
    ctx.globalAlpha = 1;
  }

  _updateHighScoreParticles(dt) {
    if (this.highScoreTimer > 0.5 && Math.random() < 0.4) { const colors = ['#ffcc00', '#ff0000', '#ffb8ff', '#00ffff', '#ffb851', '#fff']; this.highScoreParticles.push({ x: Math.random() * W, y: -10, vx: (Math.random() - 0.5) * 80, vy: 40 + Math.random() * 60, color: colors[Math.floor(Math.random() * colors.length)], size: 3 + Math.random() * 4, rotation: Math.random() * Math.PI * 2, rotSpeed: (Math.random() - 0.5) * 8, life: 1.0 }); }
    for (let i = this.highScoreParticles.length - 1; i >= 0; i--) { const p = this.highScoreParticles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += p.rotSpeed * dt; p.life -= dt * 0.4; if (p.life <= 0 || p.y > H + 10) this.highScoreParticles.splice(i, 1); }
  }

  _renderHighScore(ctx) {
    const t = 4.0 - this.highScoreTimer; const alpha = Math.min(t * 2, 1);
    ctx.globalAlpha = alpha; ctx.fillStyle = 'rgba(0,0,0,0.9)'; ctx.fillRect(0, 0, W, H);
    this.highScoreParticles.forEach(p => { ctx.save(); ctx.globalAlpha = Math.min(p.life, 1) * alpha; ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.fillStyle = p.color; ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); ctx.restore(); });
    ctx.globalAlpha = alpha; const cx = W / 2; let y = H / 2 - 70;
    const pulse = 1 + Math.sin(t * 4) * 0.05; ctx.save(); ctx.translate(cx, y); ctx.scale(pulse, pulse); ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('★ NOVO RECORDE! ★', 0, 0); ctx.restore();
    y += 40; ctx.fillStyle = '#fff'; ctx.font = 'bold 16px monospace'; ctx.textAlign = 'center'; ctx.fillText(`#${this.highScoreRank} NO RANKING`, cx, y);
    y += 40; ctx.fillStyle = '#ffb8ae'; ctx.font = '13px monospace'; ctx.fillText('PONTUAÇÃO', cx, y - 10); ctx.fillStyle = '#ffcc00'; ctx.font = 'bold 28px monospace'; ctx.fillText(String(this.score).replace(/\B(?=(\d{3})+(?!\d))/g, '.'), cx, y + 15);
    y += 55; ctx.font = '30px serif'; ctx.fillText('🏆', cx, y + Math.sin(t * 3) * 5);
    y += 40; ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText(`NÍVEL ${this.level} COMPLETO`, cx, y);
    y += 25; const gc = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851']; const bounce = Math.sin(t * 5);
    gc.forEach((color, i) => { const gx = cx - 50 + i * 33; const gy = y + bounce * (i % 2 === 0 ? 1 : -1); ctx.fillStyle = color; ctx.beginPath(); ctx.arc(gx, gy - 1.2, 6, Math.PI, 0); ctx.lineTo(gx + 6, gy + 3.6); ctx.lineTo(gx - 6, gy + 3.6); ctx.closePath(); ctx.fill(); });
    ctx.globalAlpha = 1;
  }

  _renderIntro(ctx) {
    const cfg = this._getIntroConfig(); const t = cfg.duration - this.introTimer; const cx = W / 2; const cy = H / 2;
    if (cfg.screenShake) { ctx.save(); ctx.translate(Math.sin(t * 30) * 1.5, Math.sin(t * 30) * 0.75); }
    ctx.fillStyle = cfg.bgColor; ctx.fillRect(0, 0, W, H);
    if (cfg.showParticles) { this.introParticles.forEach(p => { ctx.globalAlpha = Math.min(p.life, 1) * 0.7; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill(); }); ctx.globalAlpha = 1; }
    if (cfg.tier >= 4) { const flash = Math.sin(t * 8) * 0.04; if (flash > 0) { ctx.fillStyle = `rgba(255,0,50,${flash})`; ctx.fillRect(0, 0, W, H); } }
    const letters = cfg.title; const letterDelay = cfg.tier <= 1 ? 0.12 : 0.1;
    const totalLetters = letters.length; const letterSize = cfg.tier >= 3 ? 36 : 32; const letterSpacing = cfg.tier >= 3 ? 42 : 38;
    for (let i = 0; i < totalLetters; i++) {
      const appear = i * letterDelay + 0.2;
      if (t > appear) { const alpha = Math.min((t - appear) * 5, 1); const bounce = t - appear < 0.15 ? Math.sin((t - appear) / 0.15 * Math.PI) * 10 : 0; ctx.globalAlpha = alpha; ctx.fillStyle = cfg.titleColor; ctx.font = `bold ${letterSize}px monospace`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; const lx = cx + (i - totalLetters / 2 + 0.5) * letterSpacing; const ly = cy - 40 - bounce; ctx.fillText(letters[i], lx, ly); if (cfg.tier >= 3) { ctx.shadowColor = cfg.titleColor; ctx.shadowBlur = 8 + Math.sin(t * 6 + i) * 4; ctx.fillText(letters[i], lx, ly); ctx.shadowBlur = 0; } }
    }
    ctx.globalAlpha = 1;
    if (this.introPhase >= 1) {
      const phaseT = t - (cfg.duration - cfg.phase1At); const pacX = -30 + phaseT * cfg.pacSpeed; const pacY = cy + 10;
      const mouth = Math.abs(Math.sin(Date.now() / 80)) * 0.35 + 0.05;
      ctx.fillStyle = '#ffb8ae'; for (let dx = 20; dx < W - 20; dx += 30) { if (dx > pacX + 10) { ctx.beginPath(); ctx.arc(dx, pacY, 3, 0, Math.PI * 2); ctx.fill(); } }
      if (cfg.tier >= 4) { for (let j = 1; j <= 3; j++) { const trailX = pacX - j * 15; if (trailX > 0) { ctx.globalAlpha = 0.3 - j * 0.08; ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(trailX, pacY, TS * 0.35, 0.3, Math.PI * 2 - 0.3); ctx.lineTo(trailX, pacY); ctx.closePath(); ctx.fill(); } } ctx.globalAlpha = 1; }
      ctx.save(); ctx.translate(pacX, pacY); if (cfg.tier >= 3) { ctx.shadowColor = '#ffcc00'; ctx.shadowBlur = 10; }
      ctx.fillStyle = '#ffcc00'; ctx.beginPath(); ctx.arc(0, 0, TS * 0.42, mouth, Math.PI * 2 - mouth); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0; ctx.restore();
    }
    if (this.introPhase >= 2) {
      const phaseT = t - (cfg.duration - cfg.phase2At); const gc = ['#ff0000', '#ffb8ff', '#00ffff', '#ffb851']; const gn = ['BLINKY', 'PINKY', 'INKY', 'CLYDE']; const ghostY = cy + 65;
      const ghostAlpha = Math.min(phaseT * cfg.ghostSpeed, 1); ctx.globalAlpha = ghostAlpha;
      gc.forEach((color, i) => { const spacing = cfg.tier >= 3 ? 42 : 38; const gx = cx - 55 + i * spacing; const slideIn = Math.min(phaseT * cfg.ghostSpeed, 1); const gy = ghostY + (1 - slideIn) * 50; const r = 8;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(gx, gy - r * 0.2, r, Math.PI, 0); ctx.lineTo(gx + r, gy + r * 0.6); const wave = 3; for (let j = 0; j < 4; j++) { const bx = gx + r - (j / 4) * r * 2; ctx.quadraticCurveTo(bx - r / 4, gy + r * 0.6 + (j % 2 === 0 ? -wave : wave), bx - r / 2, gy + r * 0.6); } ctx.closePath(); ctx.fill();
        if (cfg.tier >= 3) { ctx.shadowColor = color; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0; }
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(gx - 2.5, gy - r * 0.2, 2, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(gx + 2.5, gy - r * 0.2, 2, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#00f'; ctx.beginPath(); ctx.arc(gx - 2.5, gy - r * 0.2, 1, 0, Math.PI * 2); ctx.fill(); ctx.beginPath(); ctx.arc(gx + 2.5, gy - r * 0.2, 1, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#888'; ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.fillText(gn[i], gx, gy + 14);
      }); ctx.globalAlpha = 1;
      const readyAlpha = Math.min((phaseT - 0.3) * 5, 1); if (readyAlpha > 0) { ctx.globalAlpha = readyAlpha; ctx.fillStyle = cfg.titleColor; ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center'; ctx.fillText('READY!', cx, cy - 65); ctx.globalAlpha = 1; }
    }
    ctx.globalAlpha = 0.4 + Math.sin(Date.now() / 400) * 0.2; ctx.fillStyle = cfg.subtitleColor; ctx.font = cfg.tier >= 3 ? 'bold 11px monospace' : '10px monospace'; ctx.textAlign = 'center'; ctx.fillText(cfg.subtitle, cx, H - 30); ctx.globalAlpha = 1;
    if (t > 0.5) { ctx.globalAlpha = 0.35 + Math.sin(Date.now() / 500) * 0.15; ctx.fillStyle = '#888'; ctx.font = '9px monospace'; ctx.fillText('PRESSIONE ESPAÇO PARA PULAR', cx, H - 12); ctx.globalAlpha = 1; }
    if (cfg.screenShake) ctx.restore();
  }

  updateUI() {
    document.getElementById('score-display').textContent = this.score;
    document.getElementById('lives-display').textContent = this.lives;
    document.getElementById('level-display').textContent = this.level;
  }
}

// ── BOOTSTRAP ──────────────────────────────────────────────
const canvas = document.getElementById('game-canvas');
const game = new Game(canvas);

// ── Input ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (gameScreen.style.display === 'none') return;

  if (e.code === 'KeyM') { e.preventDefault(); game._toggleSound(); return; }
  if (e.code === 'KeyP' && (game.state === 'PLAYING' || game.state === 'PAUSED')) { e.preventDefault(); game.togglePause(); return; }

  // Space no IDLE: continua ou novo jogo
  if (e.code === 'Space' && game.state === 'IDLE') {
    e.preventDefault(); Audio.init(); game._hideRanking();
    const save = game._loadGame();
    if (save && save.level >= 1) { game.resumeGame(save); }
    else { game.state = 'READY'; game.readyTimer = 0.9; game._readySoundPlayed = true; game.hideOverlay(true); Audio.gameStart(); }
    return;
  }

  // N: novo jogo em IDLE e GAMEOVER
  if (e.code === 'KeyN' && (game.state === 'IDLE' || game.state === 'GAMEOVER')) {
    e.preventDefault(); game._clearSave(); game._hideRanking();
    if (game.state === 'GAMEOVER') { game.init(1); }
    else { game._showIdleOverlay(); }
    return;
  }

  // FIX 4 — C: Continuar no GAMEOVER
  if (e.code === 'KeyC' && game.state === 'GAMEOVER') {
    e.preventDefault();
    const save = game._loadGame();
    if (save) { game.resumeGame(save); }
    return;
  }

  // R: Mostrar ranking em IDLE, PAUSED e GAMEOVER
  if (e.code === 'KeyR' && (game.state === 'IDLE' || game.state === 'PAUSED' || game.state === 'GAMEOVER')) {
    e.preventDefault(); game._showRanking(); return;
  }

  // Space no GAMEOVER sem save
  if (e.code === 'Space' && game.state === 'GAMEOVER') {
    e.preventDefault();
    const save = game._loadGame();
    if (save) { game.resumeGame(save); } else { game.init(1); }
    return;
  }

  // Escape fecha ranking
  if (e.code === 'Escape') { e.preventDefault(); game._hideRanking(); return; }

  if (e.code === 'Space' && game.state === 'INTRO') { e.preventDefault(); game._finishIntro(); return; }

  const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  if (dirMap[e.code] && game.state === 'PLAYING') { e.preventDefault(); game.inputQueue.push(dirMap[e.code]); }
  else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
});

// ── Auth ───────────────────────────────────────────────────
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');

function showGame() {
  authScreen.style.display = 'none'; gameScreen.style.display = 'flex';
  Audio.init();
  const save = game._loadGame();
  if (save && save.level >= 1) {
    game.init(save.level);
    game.score = save.score; game.lives = save.lives;
    game.fruitIndex = save.fruitIndex || 0;
    game.fruitSpawnTimer = save.fruitSpawnTimer || 0;
    game.state = 'IDLE';
    game.showOverlay('JOGO SALVO ENCONTRADO', 'C continuar  •  N novo jogo');
  } else {
    game.init(1);
  }
  // Ranking auto-opens in _finishIntro() when state becomes IDLE
}

function showAuth() { authScreen.style.display = 'flex'; gameScreen.style.display = 'none'; }

if (localStorage.getItem('token')) { showGame(); } else { showAuth(); }

document.getElementById('logout-btn').onclick = () => { localStorage.removeItem('token'); location.reload(); };

// ── Virtual Joystick (Touch Delta Controls) ──────────────
// v3.0: Joystick virtual suave baseado na Web Touch API.
// Remove as setas direcionais rígidas e implementa um joystick
// dinâmico: primeiro toque define o centro, arrasto calcula
// delta X/Y, normaliza para direções discretas da grade.
(function initVirtualJoystick() {
  const stickEl = document.getElementById('virtual-joystick');
  const knobEl = document.getElementById('joystick-knob');
  if (!stickEl || !knobEl) return;

  const DEADZONE = 8; // px — zona morta para evitar inputs fantasmas
  const MAX_RADIUS = 45; // px — raio máximo do joystick
  const SEND_INTERVAL = 80; // ms — intervalo entre envios de direção

  let centerX = 0, centerY = 0;
  let currentDir = null;
  let activeTouchId = null;
  let lastSentTime = 0;
  let lastDir = null;

  function handlePause() {
    Audio.init();
    game.togglePause();
  }

  function getDirection(dx, dy) {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx < DEADZONE && absDy < DEADZONE) return null;
    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'down' : 'up';
    }
  }

  function sendDirection(dir) {
    if (!dir) return;
    if (dir !== lastDir) {
      // Direção mudou: envia imediatamente
      game.inputQueue.push(dir);
      lastDir = dir;
      lastSentTime = Date.now();
    } else {
      // Mesma direção: envia no intervalo (repeat rate)
      const now = Date.now();
      if (now - lastSentTime >= SEND_INTERVAL) {
        game.inputQueue.push(dir);
        lastSentTime = now;
      }
    }
  }

  function updateKnob(dx, dy) {
    const dist = Math.sqrt(dx * dx + dy * dy);
    const clampedDist = Math.min(dist, MAX_RADIUS);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    knobEl.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;
    knobEl.classList.toggle('active', dist > DEADZONE);
  }

  function onTouchStart(e) {
    // Já tem um toque ativo
    if (activeTouchId !== null) return;

    const touch = e.changedTouches[0];
    if (!touch) return;
    activeTouchId = touch.identifier;

    // Obtém coordenadas relativas ao canvas wrapper
    const wrapper = document.getElementById('game-canvas-wrapper');
    const rect = wrapper.getBoundingClientRect();
    const relX = touch.clientX - rect.left;
    const relY = touch.clientY - rect.top;

    // Verifica se o toque está dentro do canvas
    if (relX < 0 || relX > rect.width || relY < 0 || relY > rect.height) {
      activeTouchId = null;
      return;
    }

    // Define centro do joystick nessa posição
    centerX = touch.clientX;
    centerY = touch.clientY;

    // Posiciona o joystick visual
    const stickSize = 120;
    stickEl.style.left = (centerX - stickSize / 2) + 'px';
    stickEl.style.top = (centerY - stickSize / 2) + 'px';
    stickEl.classList.add('visible');
    knobEl.style.transform = 'translate(-50%, -50%)';
    currentDir = null;
    lastDir = null;

    // Long-press timer (para pause)
    touchStartTime = Date.now();
    longPressTimer = setTimeout(() => {
      // Só pausa se ainda estiver com toque ativo e não moveu muito
      if (activeTouchId !== null) {
        const currentTouch = e.changedTouches[0];
        if (currentTouch) {
          const moved = Math.abs(currentTouch.clientX - centerX) + Math.abs(currentTouch.clientY - centerY);
          if (moved < DEADZONE * 2) {
            handlePause();
          }
        }
      }
      longPressTimer = null;
    }, LONG_PRESS_MS);

    // Inicia o jogo se estiver em IDLE/GAMEOVER/INTRO (como o START antigo)
    Audio.init();
    if (game.state === 'IDLE') {
      game._hideRanking();
      const save = game._loadGame();
      if (save && save.level >= 1) { game.resumeGame(save); }
      else { game.state = 'READY'; game.readyTimer = 0.9; game._readySoundPlayed = true; game.hideOverlay(true); Audio.gameStart(); }
    } else if (game.state === 'GAMEOVER') {
      const save = game._loadGame();
      if (save) { game.resumeGame(save); } else { game.init(1); }
    } else if (game.state === 'INTRO') {
      game._finishIntro();
    }

    e.preventDefault();
  }

  function onTouchMove(e) {
    if (activeTouchId === null) return;

    // Encontra o toque ativo
    let touch = null;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touch = e.changedTouches[i];
        break;
      }
    }
    if (!touch) return;

    // Calcula delta em relação ao centro
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;

    // Atualiza knob visual
    updateKnob(dx, dy);

    // Converte delta para direção discreta
    const dir = getDirection(dx, dy);
    currentDir = dir;

    // Envia direção para o inputQueue do jogo
    if (game.state === 'PLAYING' && dir) {
      sendDirection(dir);
    }

    e.preventDefault();
  }

  function onTouchEnd(e) {
    // Verifica se algum toque que terminou é o ativo
    let touchEnded = false;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === activeTouchId) {
        touchEnded = true;
        break;
      }
    }
    if (!touchEnded) return;

    // Cancela long-press timer
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }

    // Se foi um toque curto (tap sem movimento), também pode pausar
    if (touchStartTime > 0) {
      const elapsed = Date.now() - touchStartTime;
      if (elapsed < 200 && game.state === 'PLAYING') {
        // Tap curto no canvas em modo PLAYING = pause
        handlePause();
      }
    }

    // Reset do joystick
    activeTouchId = null;
    currentDir = null;
    lastDir = null;
    stickEl.classList.remove('visible');
    knobEl.style.transform = 'translate(-50%, -50%)';
    knobEl.classList.remove('active');

    e.preventDefault();
  }

  function onTouchCancel(e) {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
    activeTouchId = null;
    currentDir = null;
    lastDir = null;
    stickEl.classList.remove('visible');
    knobEl.style.transform = 'translate(-50%, -50%)';
    knobEl.classList.remove('active');
    e.preventDefault();
  }

  // Para suporte a mouse (desktop) — comportamento similar reduzido
  let mouseDown = false;
  function onMouseDown(e) {
    if (e.button !== 0) return;
    // Só funciona em modo touch (pointer: coarse)
    const isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
    if (!isTouchDevice && !('ontouchstart' in window)) return;

    mouseDown = true;
    centerX = e.clientX;
    centerY = e.clientY;

    const stickSize = 120;
    stickEl.style.left = (centerX - stickSize / 2) + 'px';
    stickEl.style.top = (centerY - stickSize / 2) + 'px';
    stickEl.classList.add('visible');
    knobEl.style.transform = 'translate(-50%, -50%)';
    currentDir = null;
    lastDir = null;
    e.preventDefault();

    // Inicia jogo também no mouse
    Audio.init();
    if (game.state === 'IDLE') {
      game._hideRanking();
      const save = game._loadGame();
      if (save && save.level >= 1) { game.resumeGame(save); }
      else { game.state = 'READY'; game.readyTimer = 0.9; game._readySoundPlayed = true; game.hideOverlay(true); Audio.gameStart(); }
    } else if (game.state === 'GAMEOVER') {
      const save = game._loadGame();
      if (save) { game.resumeGame(save); } else { game.init(1); }
    } else if (game.state === 'INTRO') {
      game._finishIntro();
    }
  }

  function onMouseMove(e) {
    if (!mouseDown) return;
    const dx = e.clientX - centerX;
    const dy = e.clientY - centerY;
    updateKnob(dx, dy);
    const dir = getDirection(dx, dy);
    currentDir = dir;
    if (game.state === 'PLAYING' && dir) {
      sendDirection(dir);
    }
    e.preventDefault();
  }

  function onMouseUp(e) {
    if (!mouseDown) return;
    mouseDown = false;
    currentDir = null;
    lastDir = null;
    stickEl.classList.remove('visible');
    knobEl.style.transform = 'translate(-50%, -50%)';
    knobEl.classList.remove('active');
    e.preventDefault();
  }

  // Registra eventos
  const wrapper = document.getElementById('game-canvas-wrapper');
  if (wrapper) {
    wrapper.addEventListener('touchstart', onTouchStart, { passive: false });
    wrapper.addEventListener('touchmove', onTouchMove, { passive: false });
    wrapper.addEventListener('touchend', onTouchEnd, { passive: false });
    wrapper.addEventListener('touchcancel', onTouchCancel, { passive: false });
    wrapper.addEventListener('mousedown', onMouseDown);
    wrapper.addEventListener('mousemove', onMouseMove);
    wrapper.addEventListener('mouseup', onMouseUp);
    wrapper.addEventListener('mouseleave', onMouseUp);
  }

  // Botão de pause mobile
  const pauseBtn = document.getElementById('mobile-pause-btn');
  if (pauseBtn) {
    pauseBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handlePause();
    }, { passive: false });
    pauseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      handlePause();
    });
  }

  // Botão continue mobile
  const continueBtn = document.getElementById('mobile-continue');
  if (continueBtn) {
    continueBtn.addEventListener('touchstart', (e) => {
      e.preventDefault();
      e.stopPropagation();
      Audio.init();
      if (game.state === 'GAMEOVER') {
        const save = game._loadGame();
        if (save) { game.resumeGame(save); } else { game.init(1); }
      }
    }, { passive: false });
    continueBtn.addEventListener('click', (e) => {
      e.preventDefault();
      Audio.init();
      if (game.state === 'GAMEOVER') {
        const save = game._loadGame();
        if (save) { game.resumeGame(save); } else { game.init(1); }
      }
    });
    // Visibilidade inicial
    game._updateMobileContinueBtn = function() {
      const btn = document.getElementById('mobile-continue');
      if (!btn) return;
      const show = this.state === 'GAMEOVER' && this._hasSave();
      btn.style.display = show ? 'flex' : 'none';
    };
  }
})();

// ── Auth forms (Passwordless — Privacy by Design) ──────────
// v3.0: Login/registro sem senha. Apenas email (identificador único).
document.getElementById('login-form').onsubmit = async (e) => {
  e.preventDefault();
  const email = document.getElementById('login-email').value;
  const res = await fetch('/api/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    showGame();
  } else {
    document.getElementById('login-error').textContent = data.detail || data.error || 'Erro ao fazer login';
  }
};

document.getElementById('register-form').onsubmit = async (e) => {
  e.preventDefault();
  const name = document.getElementById('reg-name').value;
  const email = document.getElementById('reg-email').value;
  const res = await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, email })
  });
  const data = await res.json();
  if (data.token) {
    localStorage.setItem('token', data.token);
    showGame();
  } else {
    document.getElementById('reg-error').textContent = data.detail || data.error || 'Erro ao cadastrar';
  }
};

// Service Worker Registration
document.addEventListener('DOMContentLoaded', () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
