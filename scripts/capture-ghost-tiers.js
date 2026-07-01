const puppeteer = require('puppeteer');
const path = require('path');

const SCREENSHOTS_DIR = path.join(__dirname, '..', 'screenshots');
const BASE_URL = 'http://localhost:3001';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 800, height: 900 });

  console.log('📸 Capturando ghost visual tiers...\n');

  // Navigate to game
  await page.goto(BASE_URL, { waitUntil: 'networkidle0' });
  await sleep(2000);

  // Debug: check page state
  const pageInfo = await page.evaluate(() => {
    return {
      title: document.title,
      authScreen: document.getElementById('auth-screen')?.style.display,
      gameScreen: document.getElementById('game-screen')?.style.display,
      canvas: !!document.getElementById('game-canvas'),
      loginEmail: !!document.getElementById('login-email'),
      loginPass: !!document.getElementById('login-pass'),
      loginForm: !!document.getElementById('login-form')
    };
  });
  console.log('🔍 Page info:', JSON.stringify(pageInfo));

  // Fill login form using page.evaluate for reliability
  console.log('🔐 Fazendo login...');
  await page.evaluate(() => {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-pass');
    if (emailInput && passInput) {
      // Use native input setter to trigger React/Vue reactivity
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(emailInput, 'testuser2@test.com');
      emailInput.dispatchEvent(new Event('input', { bubbles: true }));
      nativeInputValueSetter.call(passInput, '123456');
      passInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });
  await sleep(500);

  // Submit form
  await page.evaluate(() => {
    const form = document.getElementById('login-form');
    if (form) {
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    }
  });
  await sleep(3000);

  // Check if login succeeded
  const afterLogin = await page.evaluate(() => {
    return {
      authVisible: document.getElementById('auth-screen')?.style.display,
      gameVisible: document.getElementById('game-screen')?.style.display,
      hasGame: typeof window.game !== 'undefined',
      gameState: window.game?.state
    };
  });
  console.log('🔍 After login:', JSON.stringify(afterLogin));

  // If login failed, try clicking a login button
  if (afterLogin.gameVisible === 'none' || afterLogin.gameVisible === null) {
    console.log('⚠️ Login may have failed, trying button click...');
    // Try finding and clicking the submit button
    const btnSelector = '#login-form button[type="submit"], #login-form button';
    const btn = await page.$(btnSelector);
    if (btn) {
      await btn.click();
      await sleep(3000);
    }
    
    const retryAfterLogin = await page.evaluate(() => {
      return {
        authVisible: document.getElementById('auth-screen')?.style.display,
        gameVisible: document.getElementById('game-screen')?.style.display,
        hasGame: typeof window.game !== 'undefined',
        gameState: window.game?.state
      };
    });
    console.log('🔍 After retry:', JSON.stringify(retryAfterLogin));
  }

  // Make sure game screen is visible
  await page.evaluate(() => {
    const gameScreen = document.getElementById('game-screen');
    if (gameScreen) gameScreen.style.display = 'flex';
    const authScreen = document.getElementById('auth-screen');
    if (authScreen) authScreen.style.display = 'none';
  });
  await sleep(500);

  // Ghost tiers mapping: level -> tier
  const tiers = [
    { level: 1, tier: 1, name: 'tier1', desc: 'Tier 1 (Nível 1) — Clássico' },
    { level: 3, tier: 2, name: 'tier2', desc: 'Tier 2 (Nível 3) — Glow sutil' },
    { level: 5, tier: 3, name: 'tier3', desc: 'Tier 3 (Nível 5) — Sombra + olhos glow' },
    { level: 8, tier: 4, name: 'tier4', desc: 'Tier 4 (Nível 8) — Trail + olhos vermelhos' }
  ];

  for (const t of tiers) {
    console.log(`\n🎮 ${t.desc}...`);

    // Initialize game at specific level
    await page.evaluate((level) => {
      if (window.game) {
        window.game.init(level);
      }
    }, t.level);
    await sleep(800);

    // Skip intro
    await page.evaluate(() => {
      if (window.game && window.game.state === 'INTRO') {
        window.game._finishIntro();
      }
    });
    await sleep(500);

    // Force to PLAYING state
    await page.evaluate(() => {
      if (window.game) {
        if (window.game.state === 'READY') {
          window.game.readyTimer = 0;
        }
        if (window.game.state !== 'PLAYING') {
          window.game.state = 'PLAYING';
        }
      }
    });
    await sleep(1000);

    // Position ghosts in visible area for screenshot
    await page.evaluate(() => {
      if (window.game && window.game.ghosts) {
        const positions = [
          { col: 10, row: 8 },   // Blinky
          { col: 9, row: 8 },    // Pinky
          { col: 11, row: 8 },   // Inky
          { col: 10, row: 6 }    // Clyde
        ];
        window.game.ghosts.forEach((g, i) => {
          const pos = positions[i];
          g.e.col = pos.col;
          g.e.row = pos.row;
          g.e.x = pos.col;
          g.e.y = pos.row;
          g.e.px = pos.col;
          g.e.py = pos.row;
          g.mode = 'chase';
        });
      }
    });
    await sleep(1500); // Wait for render

    // Take screenshot of canvas
    const canvasEl = await page.$('#game-canvas');
    if (canvasEl) {
      await canvasEl.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${t.name}.png`),
        type: 'png'
      });
      console.log(`   ✅ ${t.name}.png salvo`);
    } else {
      // Fallback: take full page screenshot
      console.log('   ⚠️ Canvas element not found, taking full page screenshot');
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, `${t.name}.png`),
        fullPage: false
      });
      console.log(`   ✅ ${t.name}.png (full page fallback)`);
    }
  }

  console.log('\n🎉 Ghost tier screenshots capturadas!');
  console.log(`📁 Salvas em: ${SCREENSHOTS_DIR}`);

  await browser.close();
})().catch(err => {
  console.error('❌ Erro:', err.message);
  process.exit(1);
});
