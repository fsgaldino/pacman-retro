const { JSDOM } = require('jsdom');

// Setup DOM mínimo
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'http://localhost',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
global.HTMLCanvasElement = class {};
global.CanvasRenderingContext2D = class {};

// Previne erro de AudioContext
global.AudioContext = class {
  constructor() {}
  createOscillator() { return { type: '', frequency: { setValueAtTime() {} }, connect() { return { connect() {} }; }, start() {}, stop() {} }; }
  createGain() { return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} }; }
  get currentTime() { return 0; }
  get destination() { return {}; }
};
global.webkitAudioContext = global.AudioContext;

// Importa as constantes do jogo
// Simulação inline das constantes e da classe Entity
const COLS = 21;
const ROWS = 21;
const TS = 20;
const W = COLS * TS;
const H = ROWS * TS;
const TILE_CENTER_THRESHOLD = 2.0;
const TURN_TOLERANCE = 10;

const TILE = { EMPTY: 0, WALL: 1, DOT: 2, POWER: 3, GHOUSE: 4, DOOR: 5 };
const DIR = {
  up:    { dx:  0, dy: -1, name: 'up'    },
  down:  { dx:  0, dy:  1, name: 'down'  },
  left:  { dx: -1, dy:  0, name: 'left'  },
  right: { dx:  1, dy:  0, name: 'right' }
};
const DIR_LIST = [DIR.up, DIR.down, DIR.left, DIR.right];
const DIR_REV = { up: 'down', down: 'up', left: 'right', right: 'left' };

// Mapa de teste (corredor vazio)
const EMPTY_MAP = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));

// ── Entity (cópia da lógica do game.js) ────────────────
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

  step(dt, map, isGhost) {
    const d = DIR[this.dir];
    if (!d) { this.moving = false; return true; }
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
      this.checkAndApplyBuffer(map, isGhost);
    } else {
      this.px += (diffX / dist) * stepPx; this.py += (diffY / dist) * stepPx;
    }
    return true;
  }

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
    this.bufferedDir = null;
  }

  setBufferedDir(newDir, map, isGhost) {
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
    if (atCenter && this.canMoveTo(this.col + d.dx, this.row + d.dy, map, isGhost)) {
      this.dir = newDir;
      this.bufferedDir = null;
      this.targetX = (this.col + d.dx) * TS + TS / 2;
      this.targetY = (this.row + d.dy) * TS + TS / 2;
      this.moving = true;
      return;
    }
    this.bufferedDir = newDir;
    // Early snap
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

  checkAndApplyBuffer(map, isGhost) {
    if (!this.bufferedDir) return false;
    if (!this.atCenter()) return false;
    this._applyBuffer(map, isGhost);
    return true;
  }
}

// ── Testes ────────────────────────────────────────────
let passed = 0;
let failed = 0;

function assert(condition, msg) {
  if (condition) {
    console.log(`  ✅ ${msg}`);
    passed++;
  } else {
    console.log(`  ❌ ${msg}`);
    failed++;
  }
}

function test_instant_reverse() {
  console.log('\n📋 Teste: Meia-volta instantânea');
  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  e.setBufferedDir('left', EMPTY_MAP, false);
  assert(e.dir === 'left', 'Direção deve ser invertida instantaneamente');
  assert(e.col === 11, 'Pac-Man deve mover para o tile da direção original');
}

function test_buffer_consumed_at_center() {
  console.log('\n📋 Teste: Buffer consumido ao atingir centro do tile');
  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  // Move para o centro do próximo tile
  e.px = 10 * TS + TS / 2; // já no centro
  e.py = 10 * TS + TS / 2;
  e.col = 10; e.row = 10;
  e.targetX = 10 * TS + TS / 2;
  e.targetY = 10 * TS + TS / 2;
  e.moving = true;

  // Define buffer para 'down'
  e.setBufferedDir('down', EMPTY_MAP, false);
  assert(e.bufferedDir === null, 'Buffer deve ser nulo (aplicado imediatamente pois está no centro)');
  assert(e.dir === 'down', 'Direção deve mudar para down');
}

function test_buffer_queued_when_between_tiles() {
  console.log('\n📋 Teste: Buffer enfileirado quando entre tiles');
  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  e.moving = true;
  e.targetX = 11 * TS + TS / 2; // destino é tile 11
  e.targetY = 10 * TS + TS / 2;
  e.px = 10 * TS + TS / 2 + 5; // está no meio do caminho
  e.py = 10 * TS + TS / 2;

  e.setBufferedDir('down', EMPTY_MAP, false);
  assert(e.bufferedDir === 'down', 'Buffer deve armazenar direção down');
  assert(e.dir === 'right', 'Direção atual NÃO deve mudar ainda');
}

function test_early_snap() {
  console.log('\n📋 Teste: Early snap aplica direção antes do centro exato');
  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  e.moving = true;
  e.targetX = 11 * TS + TS / 2;
  e.targetY = 10 * TS + TS / 2;
  e.px = 11 * TS + TS / 2 - 8; // perto do centro (8px < TURN_TOLERANCE=10)
  e.py = 10 * TS + TS / 2;

  e.setBufferedDir('up', EMPTY_MAP, false);
  // O early snap deve aplicar imediatamente porque:
  // - Está perto do centro do próximo tile (11,10)
  // - O tile à frente (11,9 = up do tile 11,10) é válido
  assert(e.dir === 'up', 'Early snap deve mudar direção para up');
  assert(e.bufferedDir === null, 'Buffer deve ser limpo pelo early snap');
}

function test_blocked_direction_clears_buffer() {
  console.log('\n📋 Teste: Direção bloqueada descarta buffer');
  const WALL_MAP = Array.from({ length: ROWS }, () => Array(COLS).fill(TILE.EMPTY));
  // Entity em (10,10) movendo right em direção a (11,10)
  // O early snap verifica tile (11, 9) = map[9][11]
  // O _applyBuffer normal verifica tile (10-1, 10) = map[10][9] ... wait, up é dy=-1
  // _applyBuffer: col+0=10, row+(-1)=9 → canMoveTo(10,9) → map[9][10]
  // early snap: nc=11, nr=10, nc+0=11, nr-1=9 → canMoveTo(11,9) → map[9][11]
  // Precisamos bloquear AMBOS os caminhos
  WALL_MAP[9][10] = TILE.WALL;  // Bloqueia _applyBuffer: canMoveTo(10,9)
  WALL_MAP[9][11] = TILE.WALL;  // Bloqueia early snap: canMoveTo(11,9)

  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  e.moving = true;
  e.targetX = 11 * TS + TS / 2;
  e.targetY = 10 * TS + TS / 2;
  e.px = 11 * TS + TS / 2 - 8; // perto do centro (ativa early snap)
  e.py = 10 * TS + TS / 2;

  // Tenta virar para cima — ambos os caminhos bloqueados
  e.setBufferedDir('up', WALL_MAP, false);
  // Early snap deve falhar (tile 11,9 bloqueado)
  // Buffer fica armazenado
  assert(e.bufferedDir === 'up', 'Buffer deve armazenar up (early snap falhou)');
  assert(e.dir === 'right', 'Direção NÃO deve mudar (early snap bloqueado)');

  // Simula chegada ao centro do tile (11,10)
  e.px = e.targetX; e.py = e.targetY; e.col = 11; e.row = 10;
  e.checkAndApplyBuffer(WALL_MAP, false);
  // _applyBuffer tenta canMoveTo(10,9) → map[9][10] = WALL → falha
  assert(e.bufferedDir === null, 'Buffer deve ser descartado se direção está bloqueada');
  assert(e.dir === 'right', 'Direção deve permanecer right');
}

function test_buffer_applied_on_next_tile() {
  console.log('\n📋 Teste: Buffer aplicado ao chegar no próximo tile');
  const e = new Entity(10, 10, 5);
  e.dir = 'right';
  e.moving = true;
  e.targetX = 11 * TS + TS / 2;
  e.targetY = 10 * TS + TS / 2;
  e.px = 10 * TS + TS / 2 + 8; // entre tiles
  e.py = 10 * TS + TS / 2;

  // Enfileira down
  e.setBufferedDir('down', EMPTY_MAP, false);
  assert(e.bufferedDir === 'down', 'Buffer armazenou down');

  // Simula step que completa o movimento até o tile 11,10
  e.px = 11 * TS + TS / 2;
  e.py = 10 * TS + TS / 2;
  e.col = 11;
  e.row = 10;
  e.checkAndApplyBuffer(EMPTY_MAP, false);
  assert(e.dir === 'down', 'Direção deve mudar para down após chegar no tile');
  assert(e.bufferedDir === null, 'Buffer deve ser limpo após aplicação');
}

// ── Executar testes ──────────────────────────────────
console.log('🎮 Testes do Buffer de Input (Entity)');
console.log('====================================');

test_instant_reverse();
test_buffer_consumed_at_center();
test_buffer_queued_when_between_tiles();
test_early_snap();
test_blocked_direction_clears_buffer();
test_buffer_applied_on_next_tile();

console.log(`\n📊 Resultados: ${passed} passaram, ${failed} falharam`);
if (failed > 0) process.exit(1);
else console.log('🎉 Todos os testes passaram!');