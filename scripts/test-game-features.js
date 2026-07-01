const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const BASE = 'http://localhost:3001';
const SHOTS = path.join(__dirname, '..', 'screenshots');

(async () => {
  if (!fs.existsSync(SHOTS)) fs.mkdirSync(SHOTS, { recursive: true });

  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 600, height: 800 });

  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  // Helper: dispatch keyboard event via JS
  async function pressKey(code) {
    await page.evaluate((c) => {
      document.dispatchEvent(new KeyboardEvent('keydown', { code: c, key: c.replace('Key','').toLowerCase(), bubbles: true }));
    }, code);
  }

  console.log('=== 1: Navigate ===');
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SHOTS, 'test-01-login.png') });

  console.log('=== 2: Login ===');
  await page.type('#login-email', 'testuser2@test.com');
  await page.type('#login-pass', '123456');
  await page.click('#login-form button[type="submit"]');
  await new Promise(r => setTimeout(r, 5000)); // wait for intro (3.5s) + idle transition
  await page.screenshot({ path: path.join(SHOTS, 'test-02-after-login.png') });

  const state1 = await page.evaluate(() => game.state);
  console.log(`State after login+wait: ${state1}`);

  console.log('=== 3: Check ranking auto-open ===');
  const rankingVisible = await page.evaluate(() => {
    const m = document.getElementById('ranking-modal');
    return m ? m.classList.contains('show') : false;
  });
  console.log(`Ranking visible on IDLE: ${rankingVisible}`);
  await page.screenshot({ path: path.join(SHOTS, 'test-03-ranking.png') });

  const rankingItems = await page.evaluate(() => {
    const l = document.getElementById('ranking-list');
    return l ? l.children.length : 0;
  });
  console.log(`Ranking list items: ${rankingItems}`);

  const rankingCredits = await page.evaluate(() => {
    const el = document.querySelector('.ranking-credits');
    return el ? el.textContent.trim() : 'NOT FOUND';
  });
  console.log(`Ranking credits: "${rankingCredits}"`);

  console.log('=== 4: Close ranking ===');
  await pressKey('Escape');
  await new Promise(r => setTimeout(r, 500));
  const closed = await page.evaluate(() => !document.getElementById('ranking-modal').classList.contains('show'));
  console.log(`Ranking closed: ${closed}`);

  console.log('=== 5: R opens ranking ===');
  await pressKey('KeyR');
  await new Promise(r => setTimeout(r, 500));
  const rankingAfterR = await page.evaluate(() => document.getElementById('ranking-modal').classList.contains('show'));
  console.log(`Ranking after R key: ${rankingAfterR}`);
  await page.screenshot({ path: path.join(SHOTS, 'test-05-ranking-R.png') });
  await pressKey('Escape');
  await new Promise(r => setTimeout(r, 300));

  console.log('=== 6: Start game ===');
  await pressKey('Space');
  await new Promise(r => setTimeout(r, 4000));
  const state2 = await page.evaluate(() => game.state);
  console.log(`State after Space: ${state2}`);
  await page.screenshot({ path: path.join(SHOTS, 'test-06-playing.png') });

  const info = await page.evaluate(() => ({
    score: game.score, lives: game.lives, level: game.level,
    dotsEaten: game.dotsEaten, dotsTotal: game.dotsTotal,
    fruitIndex: game.fruitIndex
  }));
  console.log(`Game: score=${info.score} lives=${info.lives} level=${info.level} dots=${info.dotsEaten}/${info.dotsTotal} fruitIdx=${info.fruitIndex}`);

  console.log('=== 7: Pause ===');
  await pressKey('KeyP');
  await new Promise(r => setTimeout(r, 500));
  const state3 = await page.evaluate(() => game.state);
  console.log(`State after P: ${state3}`);
  await page.screenshot({ path: path.join(SHOTS, 'test-07-paused.png') });

  console.log('=== 8: R during PAUSED ===');
  await pressKey('KeyR');
  await new Promise(r => setTimeout(r, 500));
  const rInPause = await page.evaluate(() => document.getElementById('ranking-modal').classList.contains('show'));
  console.log(`Ranking in PAUSED: ${rInPause}`);
  await page.screenshot({ path: path.join(SHOTS, 'test-08-ranking-pause.png') });
  await pressKey('Escape');
  await new Promise(r => setTimeout(r, 300));
  await pressKey('KeyP');
  await new Promise(r => setTimeout(r, 300));

  console.log('=== 9: R during PLAYING (should NOT open) ===');
  await pressKey('KeyR');
  await new Promise(r => setTimeout(r, 500));
  const rInPlay = await page.evaluate(() => document.getElementById('ranking-modal').classList.contains('show'));
  console.log(`Ranking in PLAYING: ${rInPlay} (expect false)`);
  await page.screenshot({ path: path.join(SHOTS, 'test-09-R-playing.png') });

  console.log('=== 10: Fruit constants ===');
  const fruit = await page.evaluate(() => ({ SI: FRUIT_SPAWN_INTERVAL, D: FRUIT_DURATION }));
  console.log(`SPAWN_INTERVAL=${fruit.SI}s DURATION=${fruit.D}s`);

  console.log('=== 11: Check overlay text for credits in IDLE ===');
  // Check that credits footer renders (canvas text check)
  const canvasPixels = await page.evaluate(() => {
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    // Check bottom area for credits - look for non-black pixels near bottom
    const data = ctx.getImageData(180, 380, 60, 30).data;
    let nonBlack = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] > 20 || data[i+1] > 20 || data[i+2] > 20) nonBlack++;
    }
    return nonBlack;
  });
  console.log(`Credits footer pixels (non-black in bottom area): ${canvasPixels} (expect >0)`);

  console.log('\n=== ERRORS ===');
  if (errors.length === 0) console.log('None!');
  else errors.forEach(e => console.log(`ERROR: ${e}`));

  await browser.close();
  console.log('\n=== ALL DONE ===');
})();
