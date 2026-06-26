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
  UP:    { dx:  0, dy: -1, name: 'up'    },
  DOWN:  { dx:  0, dy:  1, name: 'down'  },
  LEFT:  { dx: -1, dy:  0, name: 'left'  },
  RIGHT: { dx:  1, dy:  0, name: 'right' }
};
const DIR_LIST = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];
const DIR_REV  = { up: 'down', down: 'up', left: 'right', right: 'left' };

// ─── MAPA 21×21 ─────────────────────────────────────────────
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
  [1,1,1,1,1,2,1,0,1,4,5,5,4,1,0,1,2,1,1,1,1],
  [0,0,0,0,0,2,0,0,1,4,5,5,4,1,0,0,2,0,0,0,0],
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
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) { /* fallback silencioso */ }
  },

  _tone(freq, dur, type, vol = 0.08) {
    if (!this.ctx) return;
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

  levelComplete() {
    [400, 500, 600, 800, 1000, 1300].forEach((f, i) => {
      setTimeout(() => this._tone(f, 0.12, 'square', 0.06), i * 100);
    });
  }
};

// ─── CLASSE ENTIDADE (Pac-Man / Fantasma) ──────────────────
class Entity {
  constructor(col, row, speed) {
    this.col = col; this.row = row;
    this.px = col * TS + TS/2; // centro em pixels
    this.py = row * TS + TS/2;
    this.dir    = 'right';
    this.speed  = speed;        // tiles / segundo
    this.moving = false;
    this.nextDir = null;        // direção enfileirada (Pac-Man)
  }

  /** Retorna o centro do tile atual */
  center() { return { x: this.col * TS + TS/2, y: this.row * TS + TS/2 }; }

  /** Distância Manhattan até um tile */
  distTo(tc, tr) { return Math.abs(this.col - tc) + Math.abs(this.row - tr); }

  /** Verifica se está alinhado ao centro do tile (tolerância 1px) */
  atCenter() {
    const c = this.center();
    return Math.abs(this.px - c.x) < 1.5 && Math.abs(this.py - c.y) < 1.5;
  }

  /** Verifica se um tile é transitável (para Pac-Man) */
  canMoveTo(col, row, map, isGhost) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
    const t = map[row][col];
    if (t === TILE.WALL) return false;
    if (!isGhost && (t === TILE.GHOUSE || t === TILE.DOOR)) return false;
    return true;
  }

  /** Move suavemente na direção atual. Retorna false se colidir */
  step(dt, map, isGhost) {
    const d = DIR[this.dir];
    if (!d) { this.moving = false; return true; }

    const nc = this.col + d.dx;
    const nr = this.row + d.dy;

    if (!this.canMoveTo(nc, nr, map, isGhost)) {
      this.moving = false;
      // Apenas alinha ao centro
      const c = this.center();
      this.px = c.x; this.py = c.y;
      return false;
    }

    this.moving = true;

    // Move em pixels
    const pixelsPerSec = this.speed * TS;
    const stepPx = pixelsPerSec * dt;

    this.px += d.dx * stepPx;
    this.py += d.dy * stepPx;

    // Túneis (wrap horizontal nas bordas)
    if (this.px < -TS/2) this.px = W + TS/2;
    if (this.px > W + TS/2) this.px = -TS/2;

    // Atualiza tile quando cruza o centro
    const c = this.center();
    if (Math.abs(this.px - c.x) < 1) this.px = c.x;
    if (Math.abs(this.py - c.y) < 1) this.py = c.y;

    // Se cruzou o centro, atualiza col/row
    const cx = this.col * TS + TS/2;
    const cy = this.row * TS + TS/2;
    if (d.dx !== 0 && Math.abs(this.px - cx) >= TS) {
      this.col = nc;
      this.px = cx + d.dx * TS;
    }
    if (d.dy !== 0 && Math.abs(this.py - cy) >= TS) {
      this.row = nr;
      this.py = cy + d.dy * TS;
    }

    return true;
  }

  /** Tenta trocar de direção (se alinhado e passagem livre) */
  trySetDir(newDir, map, isGhost) {
    const d = DIR[newDir];
    if (!d) return false;
    const nc = this.col + d.dx;
    const nr = this.row + d.dy;
    if (this.canMoveTo(nc, nr, map, isGhost) && this.atCenter()) {
      this.dir = newDir;
      const c = this.center();
      this.px = c.x; this.py = c.y;
      this.moving = true;
      return true;
    }
    return false;
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
    this.state = 'IDLE';     // IDLE | PLAYING | DYING | GAMEOVER | WIN
    this.dotsTotal = 0;
    this.dotsEaten = 0;
    this.frightTimer = 0;
    this.frightDuration = 6;
    this.ghostEatCombo = 0;
    this.spawnTimer = 0;
    this.overlayEl = document.getElementById('game-overlay');
    this.overlayText = document.getElementById('overlay-text');
    this.overlayHint = document.getElementById('overlay-hint');
    this.keys = {};
    this.lastTime = 0;
    this.animFrame = null;
    this.dyingTimer = 0;
    this.winTimer = 0;
    this.readyTimer = 0;
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

    // Conta total de dots
    this.dotsTotal = 0;
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        if (this.map[r][c] === TILE.DOT || this.map[r][c] === TILE.POWER)
          this.dotsTotal++;

    // Pac-Man (posição inicial: linha 16, coluna 10)
    this.pacman = new Entity(10, 15, 5.5 + level * 0.2);
    this.pacman.dir = 'left';

    // Fantasmas
    this.ghosts = [
      { e: new Entity(10,  9, 5.0 + level * 0.15), color: '#ff0000', target: null, scatter: { x: 20, y: 0 }, mode: 'house' },
      { e: new Entity(11, 10, 5.0 + level * 0.15), color: '#ffb8ff', target: null, scatter: { x: 0, y: 0 }, mode: 'house' }
    ];

    this.state = 'IDLE';
    this.showOverlay('PRESSIONE ESPAÇO', 'para começar');
    this.hideOverlay(false);
    document.addEventListener('keydown', this._startBinder = (e) => {
      if (e.code === 'Space' && this.state === 'IDLE') {
        this.state = 'READY';
        this.readyTimer = 1.2;
        this.hideOverlay(true);
        Audio.gameStart();
        document.removeEventListener('keydown', this._startBinder);
      }
    });

    this.lastTime = 0;
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
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
    this.pacman = new Entity(10, 15, 5.5 + this.level * 0.2);
    this.pacman.dir = 'left';
    this.ghosts.forEach((g, i) => {
      g.e = new Entity(i === 0 ? 10 : 11, i === 0 ? 9 : 10, 5.0 + this.level * 0.15);
      g.mode = 'house';
    });
    this.frightTimer = 0;
    this.state = 'PLAYING';
  }

  /** Mostra overlay */
  showOverlay(text, hint = '') {
    this.overlayText.textContent = text;
    this.overlayHint.textContent = hint;
  }

  hideOverlay(immediate) {
    if (immediate) {
      this.overlayEl.classList.remove('show');
    } else {
      // Não muda, apenas garante que está com o texto certo
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
  update(dt) {
    if (this.state === 'READY') {
      this.readyTimer -= dt;
      if (this.readyTimer <= 0) {
        this.state = 'PLAYING';
        this.ghosts.forEach(g => { if (g.mode === 'house') g.mode = 'leaving'; });
      }
      return;
    }

    if (this.state === 'DYING') {
      this.dyingTimer -= dt;
      if (this.dyingTimer <= 0) {
        if (this.lives <= 0) {
          this.state = 'GAMEOVER';
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
          this.respawnEntities();
        }
      }
      return;
    }

    if (this.state === 'WIN') {
      this.winTimer -= dt;
      if (this.winTimer <= 0) {
        this.level++;
        this.startLevel();
      }
      return;
    }

    if (this.state !== 'PLAYING') return;

    // ── Input ──
    for (const k of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
      if (this.keys[k]) {
        const dirMap = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
        this.pacman.trySetDir(dirMap[k], this.map, false);
      }
    }

    // ── Move Pac-Man ──
    this.pacman.step(dt, this.map, false);

    // ── Check dot eating ──
    const pc = this.pacman.center();
    const tileCol = Math.round((pc.x - TS/2) / TS);
    const tileRow = Math.round((pc.y - TS/2) / TS);
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

    // ── Win check ──
    if (this.dotsEaten >= this.dotsTotal) {
      this.state = 'WIN';
      this.winTimer = 2.0;
      Audio.levelComplete();
      this.showOverlay('NÍVEL COMPLETO!', 'Preparando próximo nível...');
      return;
    }

    // ── Fright timer ──
    if (this.frightTimer > 0) {
      this.frightTimer -= dt;
      if (this.frightTimer <= 0) this.endFrightMode();
    }

    // ── Move fantasmas ──
    this.spawnTimer -= dt;
    this.ghosts.forEach((g, gi) => {
      if (g.mode === 'house') {
        // Espera um pouco antes de sair
        if (gi === 0 && this.spawnTimer <= 0) g.mode = 'leaving';
        if (gi === 1 && this.spawnTimer <= -1.5) g.mode = 'leaving';
        return;
      }

      if (g.mode === 'leaving') {
        // Sobe até sair do ghost house
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
      }

      g.e.step(dt, this.map, true);

      // Verifica colisão com Pac-Man
      if (this.checkCollision(this.pacman, g.e)) {
        if (this.frightTimer > 0) {
          // Comeu fantasma
          this.ghostEatCombo++;
          const pts = 200 * Math.pow(2, this.ghostEatCombo - 1);
          this.score += pts;
          Audio.eatGhost();
          this.updateUI();
          g.mode = 'eaten';
          // Volta pra casa
          g.e.col = gi === 0 ? 10 : 11;
          g.e.row = gi === 0 ? 9 : 10;
          g.e.px = g.e.col * TS + TS/2;
          g.e.py = g.e.row * TS + TS/2;
          g.mode = 'leaving';
        } else {
          // Pac-Man morre
          this.pacmanDie();
          return;
        }
      }
    });
  }

  getGhostTarget(gi) {
    if (this.frightTimer > 0) {
      // Fright mode: foge para um canto
      const corners = [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 0, y: 20 }, { x: 20, y: 20 }];
      return corners[gi % corners.length];
    }
    const p = this.pacman;
    if (gi === 0) {
      // Persegue diretamente
      return { x: p.col, y: p.row };
    }
    // 2 tiles à frente do Pac-Man
    const d = DIR[p.dir];
    return { x: p.col + (d ? d.dx * 2 : 0), y: p.row + (d ? d.dy * 2 : 0) };
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

  activateFrightMode() {
    this.frightTimer = this.frightDuration + this.level * 0.5;
    this.ghostEatCombo = 0;
    // Inverte direção dos fantasmas
    this.ghosts.forEach(g => {
      if (g.mode === 'chase' || g.mode === 'scatter') {
        g.e.dir = DIR_REV[g.e.dir];
        g.mode = 'fright';
      }
    });
  }

  endFrightMode() {
    this.frightTimer = 0;
    this.ghosts.forEach(g => {
      if (g.mode === 'fright') g.mode = 'chase';
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
    this.pacman = new Entity(10, 15, 5.5 + this.level * 0.2);
    this.pacman.dir = 'left';
    this.ghosts.forEach((g, i) => {
      g.e = new Entity(i === 0 ? 10 : 11, i === 0 ? 9 : 10, 5.0 + this.level * 0.15);
      g.mode = 'house';
    });
    this.frightTimer = 0;
    this.spawnTimer = 0;
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
          // Cantos arredondados simples
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

    // Ghost house label
    ctx.fillStyle = '#555';
    ctx.font = '7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('GHOSTS', 10 * TS + TS/2, 10 * TS + TS/2 + 2.5);

    // Fantasmas
    this.ghosts.forEach(g => {
      if (g.mode === 'house' || g.mode === 'leaving') {
        // Meio transparente se estiver na casa
        ctx.globalAlpha = 0.5;
      }
      this.drawGhost(ctx, g);
      ctx.globalAlpha = 1;
    });

    // Pac-Man
    this.drawPacman(ctx);

    // Efeito de morte
    if (this.state === 'DYING') {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + Math.sin(Date.now() / 80) * 0.15})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  drawPacman(ctx) {
    const p = this.pacman;
    const x = p.px, y = p.py;
    const r = TS * 0.42;
    const mouth = this.state === 'DYING' ? 0 : Math.abs(Math.sin(Date.now() / 100)) * 0.35 + 0.05;
    const angle = { up: -Math.PI/2, down: Math.PI/2, left: Math.PI, right: 0 }[p.dir] || 0;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Corpo
    ctx.fillStyle = '#ffcc00';
    ctx.beginPath();
    ctx.arc(0, 0, r, mouth, Math.PI * 2 - mouth);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  drawGhost(ctx, g) {
    const e = g.e;
    const x = e.px, y = e.py;
    const r = TS * 0.4;
    const isFright = this.frightTimer > 0 && g.mode !== 'house' && g.mode !== 'leaving' && g.mode !== 'eaten';
    const flash = this.frightTimer < 2 && Math.floor(Date.now() / 200) % 2 === 0;

    let color;
    if (isFright) {
      color = flash ? '#fff' : '#2121de';
    } else {
      color = g.color;
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    // Corpo
    ctx.arc(x, y - r * 0.2, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r * 0.6);
    // Onda na base
    const wave = 4;
    for (let i = 0; i < 4; i++) {
      const bx = x + r - (i / 4) * r * 2;
      ctx.quadraticCurveTo(bx - r/4, y + r * 0.6 + (i % 2 === 0 ? -wave : wave), bx - r/2, y + r * 0.6);
    }
    ctx.closePath();
    ctx.fill();

    // Olhos dos fantasmas
      if (!isFright) {
        const dx = e.dir === 'left' ? -1 : e.dir === 'right' ? 1 : 0;
        const dy = e.dir === 'up' ? -1 : e.dir === 'down' ? 1 : 0;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx, y - r * 0.2 + dy, 2, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#00f';
        ctx.beginPath(); ctx.arc(x - 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(x + 2.5 + dx*2, y - r * 0.2 + dy*2, 1, 0, Math.PI*2); ctx.fill();
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

// Controles
document.addEventListener('keydown', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    e.preventDefault();
    game.keys[e.code] = true;
  }
});
document.addEventListener('keyup', e => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
    game.keys[e.code] = false;
  }
});

// Telas e Autenticação
const authScreen = document.getElementById('auth-screen');
const gameScreen = document.getElementById('game-screen');

function showGame() {
  authScreen.style.display = 'none';
  gameScreen.style.display = 'flex';
  Audio.init(); // O navegador exige que o áudio seja iniciado após o clique do usuário
  game.init(1);
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
