// SOLUNA BAY — local Playwright checks. Serves the repo, loads the game,
// and exercises the controls. Run: node test-game.mjs
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire('/home/hatch/workspace/makefun/.shot/package.json');
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:8080';

let pass = 0;
let fail = 0;
function check(name, ok, extra = '') {
  if (ok) {
    pass += 1;
    console.log(`  PASS ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL ${name} ${extra}`);
  }
}

const server = spawn('node', ['serve.ts'], { cwd: here, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 1200));

const browser = await chromium.launch({
  args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
// A smaller viewport for the interaction tests keeps software rendering fast
// enough that the fixed-step simulation keeps up with real time.
const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
const errors = [];
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('pageerror', (e) => errors.push(String(e)));

try {
  // 1. The title screen loads over a living city.
  await page.goto(`${BASE}/game/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(2500);
  check('page loads without console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
  check('title overlay is visible', await page.isVisible('#title'));
  check('game object exists', await page.evaluate(() => !!window.__soluna));
  check('WebGL canvas has size', await page.evaluate(() => {
    const c = document.getElementById('game');
    return c.width > 0 && c.height > 0;
  }));

  // 2. Start the game and walk.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(1200);
  check('title hides after Enter', await page.evaluate(() => document.getElementById('title').style.display === 'none'));
  const startPos = await page.evaluate(() => ({ x: window.__soluna.world.player.x, z: window.__soluna.world.player.z }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3500);
  await page.keyboard.up('KeyW');
  const endPos = await page.evaluate(() => ({ x: window.__soluna.world.player.x, z: window.__soluna.world.player.z }));
  const walked = Math.hypot(endPos.x - startPos.x, endPos.z - startPos.z);
  check('WASD walks the player', walked > 4, `moved ${walked.toFixed(1)} m`);
  check('HUD shows money', (await page.textContent('#money')).includes('$'));

  // 3. Pause and map.
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  check('Esc opens pause', await page.isVisible('#pause'));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(900);
  check('Esc resumes', await page.evaluate(() => document.getElementById('pause').style.display === 'none'));
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(900);
  check('M opens the map', await page.isVisible('#map-overlay'));
  await page.keyboard.press('KeyM');
  await page.waitForTimeout(900);

  // 4. Start a mission with J.
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(900);
  check('J starts mission 1', await page.evaluate(() => {
    const m = window.__soluna.world.mission.active;
    return !!m && m.def.id === 'm1';
  }));
  check('mission tracker shows the objective', (await page.textContent('#mission-objective')).length > 3);

  // 5. Enter a car and drive it.
  await page.evaluate(() => {
    const w = window.__soluna.world;
    const car = w.cars.find((c) => !c.parked && c.kind === 'traffic');
    w.player.x = car.x + 2;
    w.player.z = car.z;
  });
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
  check('E enters a car', await page.evaluate(() => !window.__soluna.world.player.onFoot));
  const carStart = await page.evaluate(() => ({ x: window.__soluna.world.player.x, z: window.__soluna.world.player.z }));
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(4000);
  const speed = await page.evaluate(() => Math.abs(window.__soluna.world.player.car?.speed || 0));
  await page.keyboard.up('KeyW');
  const carEnd = await page.evaluate(() => ({ x: window.__soluna.world.player.x, z: window.__soluna.world.player.z }));
  const drove = Math.hypot(carEnd.x - carStart.x, carEnd.z - carStart.z);
  check('car drives', drove > 15 && speed > 3, `drove ${drove.toFixed(1)} m at ${speed.toFixed(1)} m/s`);

  // 6. Wanted level: jacking a car should have raised the heat.
  check('carjacking raised wanted', await page.evaluate(() => window.__soluna.world.player.wanted >= 1));

  // 7. Each shot scene renders without errors.
  for (const shot of ['chase', 'mission', 'night', 'map']) {
    await page.goto(`${BASE}/game/index.html?shot=${shot}&seed=1`, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    const shot2 = await page.screenshot({ type: 'jpeg', quality: 70 });
    check(`shot ${shot} renders (not blank)`, shot2.length > 20000, `${shot2.length} bytes`);
  }
  check('no console errors across all shots', errors.length === 0, errors.slice(0, 3).join(' | '));

  // 8. The world is alive: traffic moves.
  await page.goto(`${BASE}/game/index.html`, { waitUntil: 'load' });
  await page.waitForTimeout(1500);
  const t0 = await page.evaluate(() => window.__soluna.world.cars.filter((c) => !c.parked).map((c) => [c.x, c.z]));
  await page.waitForTimeout(1500);
  const t1 = await page.evaluate(() => window.__soluna.world.cars.filter((c) => !c.parked).map((c) => [c.x, c.z]));
  const moved = t0.reduce((n, c, i) => n + (Math.hypot(t1[i][0] - c[0], t1[i][1] - c[1]) > 1 ? 1 : 0), 0);
  check('traffic drives itself', moved >= 5, `${moved} cars moved`);
} finally {
  await browser.close();
  server.kill();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
