// Smoke test + screenshot capture for Soluna Bay.
// Serves game/ on localhost, loads it in real Chromium, checks for console
// errors, drives the game a little, then captures the 4 staged shots.
// Rebuilt under the gta6-01 recording: same checks, re-written from the
// reference build.
// Usage: node test-game.mjs [--shots-only]
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/home/hatch/workspace/makefun/.shot/package.json');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 8081;
const BASE = `http://localhost:${PORT}/`;
const shotsOnly = process.argv.includes('--shots-only');

const server = spawn('node', ['serve.ts', '--port', String(PORT)], { cwd: here, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures += 1;
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

  if (!shotsOnly) {
    await page.goto(BASE, { waitUntil: 'load', timeout: 20000 });
    await page.waitForTimeout(5000);
    check('no console errors on load', errors.length === 0, errors.join(' | ').slice(0, 500));
    const status = await page.evaluate(() => document.getElementById('status').textContent);
    check('status line set', /Soluna Bay/.test(status), status);
    const hud = await page.evaluate(() => !!document.querySelector('.hud'));
    check('HUD present', hud);
    const screen0 = await page.evaluate(() => window.__screen);
    check('starts on title screen', screen0 === 'title', screen0);
    await page.screenshot({ path: '/tmp/smoke-title.png' });

    // New Game via Enter.
    await page.keyboard.press('Enter');
    await page.waitForTimeout(800);
    const screen1 = await page.evaluate(() => window.__screen);
    check('Enter starts play', screen1 === 'play', screen1);
    const pos0 = await page.evaluate(() => ({ x: window.__game.playerApi.player.x, z: window.__game.playerApi.player.z }));
    // Walk forward for 2s.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyW');
    const pos1 = await page.evaluate(() => ({ x: window.__game.playerApi.player.x, z: window.__game.playerApi.player.z }));
    const moved = Math.hypot(pos1.x - pos0.x, pos1.z - pos0.z);
    check('WASD walks the player', moved > 3, `moved ${moved.toFixed(1)}m`);
    await page.screenshot({ path: '/tmp/smoke-play.png' });

    // Pause and map.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    const screen2 = await page.evaluate(() => window.__screen);
    check('Esc opens pause/map', screen2 === 'pause', screen2);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // Mission start with J.
    await page.keyboard.press('KeyJ');
    await page.waitForTimeout(500);
    const mission = await page.evaluate(() => !!window.__game.missionsApi.state.active);
    check('J starts a mission', mission);
    await page.screenshot({ path: '/tmp/smoke-mission.png' });

    // Enter a car: teleport the player next to the parked car at the marina
    // start, then press E.
    await page.evaluate(() => {
      const g = window.__game;
      const p = g.playerApi.player;
      const car = g.worldApi.world.cars.find((c) => c.kind === 'parked' && !c.dead);
      if (car) { p.x = car.x + 2; p.z = car.z; }
    });
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(500);
    const inCar = await page.evaluate(() => !!window.__game.playerApi.player.car);
    check('E enters a car', inCar);
    // Drive forward for 3s.
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyW');
    const speed = await page.evaluate(() => window.__game.playerApi.player.car ? Math.abs(window.__game.playerApi.player.car.speed) : 0);
    check('car drives', speed > 3, `speed ${speed.toFixed(1)} m/s`);
    await page.screenshot({ path: '/tmp/smoke-drive.png' });
    check('no console errors during play', errors.length === 0, errors.join(' | ').slice(0, 500));
    await context.close();
  }

  // ---- Staged screenshots ----
  const shots = [
    { name: '1-chase.jpg', query: '?shot=chase&seed=1' },
    { name: '2-mission.jpg', query: '?shot=mission&seed=1' },
    { name: '3-night.jpg', query: '?shot=night&seed=1' },
    { name: '4-map.jpg', query: '?shot=map&seed=1' },
  ];
  mkdirSync(join(here, 'screenshots'), { recursive: true });
  for (const s of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const p = await ctx.newPage();
    const errs = [];
    p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    p.on('pageerror', (e) => errs.push(`pageerror: ${e.message}`));
    await p.goto(BASE + s.query, { waitUntil: 'load', timeout: 20000 });
    try {
      await p.waitForFunction(() => window.__shotReady === true, null, { timeout: 30000 });
    } catch {
      errs.push('shot never became ready');
    }
    await p.waitForTimeout(400);
    const path = join(here, 'screenshots', s.name);
    await p.screenshot({ path, type: 'jpeg', quality: 85 });
    const { size } = await import('node:fs').then((fs) => fs.statSync(path));
    check(`shot ${s.name}`, errs.length === 0 && size <= 262144, `${Math.round(size / 1024)} KiB${errs.length ? ' | ' + errs.join(' | ').slice(0, 300) : ''}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  server.kill();
}

console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
