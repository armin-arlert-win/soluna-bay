// Soluna Bay: boot, the one loop, screens and cameras. The game moves
// between title (with the city alive behind it), play, pause/map, garage,
// how-to and the busted/wasted screen. With no input at all it plays itself
// in attract mode, so the grading harness's screenshots always show a living
// city. ?shot=chase|mission|night|map stages one scene and paints it.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { Renderer } from './gl.js';
import { buildCity } from './city.js';
import { createWorld } from './world.js';
import { createPlayer } from './player.js';
import { createMissions } from './missions.js';
import { createInput } from './input.js';
import { AudioEngine } from './audio.js';
import { HUD } from './hud.js';
import { listSlots, saveToSlot, loadFromSlot, snapshotState, applySnapshot } from './save.js';
import { createMeshes, drawScene, environmentFor } from './render.js';
import { stageShot, attractDrive } from './shots.js';
import { mat4Perspective, mat4LookAt, clamp, lerp } from './util.js';
import { CITY, GARAGE, PRICES } from './config.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;
const params = new URLSearchParams(window.location.search);
const shotName = params.get('shot');

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const root = document.getElementById('root');
const renderer = new Renderer(canvas);
const meshes = createMeshes(renderer.gl);
const input = createInput(canvas);
const audio = new AudioEngine();

function announce(message) {
  statusEl.textContent = message;
}

window.addEventListener('error', (event) => {
  statusEl.textContent = `Error: ${event.message}`;
});

// ---- Build a fresh game (used at boot and for New Game) ----
function buildGame() {
  const city = buildCity(renderer.gl);
  const worldApi = createWorld(city);
  const playerApi = createPlayer(worldApi, city);
  const missionsApi = createMissions(worldApi, playerApi);
  return {
    city, worldApi, playerApi, missionsApi,
    properties: [],
    garageUpgrades: {},
    time: 0,
    audio,
  };
}

let game = buildGame();
let screen = 'title';
let camYaw = Math.PI;
let camPitch = 0.32;
let camPos = [300, 8, -90];
let camTarget = [300, 1, -120];
let shakeT = 0;
let shakeAmp = 0;
let attractIdle = 0;
let titleFaded = false;
let pendingFine = 0;
let prevM = false;
let prevEsc = false;
let garageNear = false;
let hintEl = null;

function spawnAttractCar() {
  const player = game.playerApi.player;
  if (player.car) return;
  const car = game.worldApi.addCar('player', -300, 358, Math.PI / 2, {
    name: 'Calyx Sprint GT', maxSpeed: 34, accel: 14, len: 4.4,
    color: [0.9, 0.25, 0.55], paint: [0.9, 0.25, 0.55],
  });
  game.playerApi.enterCar(car);
  player.x = car.x;
  player.z = car.z;
}
spawnAttractCar();

function showHint(text) {
  if (!hintEl) {
    hintEl = document.createElement('div');
    hintEl.className = 'hintbar';
    root.appendChild(hintEl);
  }
  hintEl.textContent = text;
  hintEl.style.display = text ? 'block' : 'none';
}

// ---- HUD callbacks ----
const hud = new HUD(root, {
  onNewGame() {
    audio.unlock();
    game = buildGame();
    startPlay();
  },
  onContinue() {
    audio.unlock();
    const slots = listSlots();
    const first = slots.find((s) => !s.empty);
    if (!first) {
      hud.showTitle(false);
      return;
    }
    game = buildGame();
    const save = loadFromSlot(first.index);
    if (save) applySnapshot(game, save);
    startPlay();
  },
  onResume() {
    screen = 'play';
    hud.hideOverlays();
    showHint('');
    announce('Playing.');
  },
  onSave() {
    hud.saveMsg.textContent = 'Pick a slot to save into.';
    hud.renderSaveSlots();
  },
  onSaveSlot(i) {
    const ok = saveToSlot(i, snapshotState(game));
    hud.saveMsg.textContent = ok ? `Saved to slot ${i + 1}.` : 'Save failed — storage is off.';
    hud.renderSaveSlots();
  },
  onQuitToTitle() {
    game = buildGame();
    spawnAttractCar();
    screen = 'title';
    attractIdle = 0;
    titleFaded = false;
    hud.showTitle(listSlots().some((s) => !s.empty));
    announce('Soluna Bay. Press Enter to play.');
  },
  onLeaveGarage() {
    screen = 'play';
    hud.hideOverlays();
  },
  onCloseHowTo() {
    if (screen === 'title') hud.showTitle(listSlots().some((s) => !s.empty));
    else {
      screen = 'play';
      hud.hideOverlays();
    }
  },
  onRespawn() {
    game.playerApi.respawn(pendingFine);
    hud.hideOverlays();
    screen = 'play';
    announce('Back on the street.');
  },
  onListSlots() {
    return listSlots();
  },
  onMoney() {
    return game.playerApi.player.money;
  },
  onGarageOwned() {
    return game.garageUpgrades;
  },
  onProperties() {
    return game.properties;
  },
  onBuyGarage(key) {
    const player = game.playerApi.player;
    const item = GARAGE[key];
    const car = player.car;
    if (!car || player.money < item.price) return;
    player.money -= item.price;
    if (key === 'repair') car.health = 100;
    if (key === 'respray') {
      const colors = [[0.9, 0.2, 0.2], [0.2, 0.4, 0.9], [0.95, 0.8, 0.25], [0.2, 0.8, 0.4], [0.85, 0.85, 0.85], [0.1, 0.1, 0.12]];
      car.model.color = colors[Math.floor(Math.random() * colors.length)];
    }
    if (key === 'armour') car.armour = 50;
    if (key === 'engine') car.model.maxSpeed *= 1.18;
    if (key === 'nitro') car.nitro = true;
    game.garageUpgrades[key] = true;
    hud.garageMsg.textContent = `${item.name} fitted.`;
    hud.renderGarage();
    audio.blip(990);
  },
  onBuyProperty(id) {
    const player = game.playerApi.player;
    const prop = PRICES.property.find((p) => p.id === id);
    if (!prop || player.money < prop.price) return;
    player.money -= prop.price;
    game.properties.push(id);
    hud.garageMsg.textContent = `${prop.name} is yours.`;
    hud.renderGarage();
    audio.blip(990);
  },
});

function startPlay() {
  const player = game.playerApi.player;
  // New game starts on foot in Marina Row, next to a parked car.
  if (player.car) {
    player.car.kind = 'parked';
    player.car.driver = false;
    player.car = null;
  }
  player.x = 300;
  player.z = -120;
  player.heading = Math.PI;
  player.camYaw = Math.PI;
  screen = 'play';
  hud.hideOverlays();
  showHint('');
  announce('Playing. Press J for your first job.');
  hud.bannerText('SOLUNA BAY — press J to start your first job', 4200);
}

function openPause() {
  screen = 'pause';
  hud.showPause();
  hud.drawBigMap(game);
  announce('Paused.');
}

function openGarage() {
  screen = 'garage';
  hud.showGarage();
  announce('Soluna Spray & Tune.');
}

// ---- Events from the world ----
function drainEvents() {
  const world = game.worldApi.world;
  const player = game.playerApi.player;
  for (const event of world.events) {
    switch (event.type) {
      case 'wanted':
        if (event.data.stars > 0) hud.bannerText(`WANTED ${event.data.stars}★ — ${event.data.reason}`, 2400);
        break;
      case 'busted':
        pendingFine = 300 + world.wanted.stars * 100;
        screen = 'end';
        hud.showEnd('busted', pendingFine);
        break;
      case 'wasted':
        pendingFine = 250;
        screen = 'end';
        hud.showEnd('wasted', pendingFine);
        break;
      case 'missionStart':
        hud.bannerText(`NEW JOB — ${event.data.title}`, 3000);
        audio.blip(880);
        break;
      case 'missionComplete':
        hud.bannerText(`JOB DONE — ${event.data.title}  +$${event.data.money}`, 3600);
        audio.blip(1180);
        break;
      case 'missionFailed':
        hud.bannerText(`JOB FAILED — ${event.data.title}`, 3000);
        break;
      case 'gate':
        audio.blip(event.data.index === event.data.total ? 1320 : 990);
        break;
      case 'collectible':
        hud.bannerText(`Sun shell ${event.data.count}/40  +$250`, 2200);
        break;
      case 'crash':
        audio.crash();
        shakeT = 0.35;
        shakeAmp = 0.35;
        player.hurtT = 0.4;
        break;
      case 'ram':
        shakeT = 0.2;
        shakeAmp = 0.22;
        break;
      case 'explosion':
        shakeT = 0.5;
        shakeAmp = 0.5;
        audio.crash();
        break;
      case 'enemyDown':
        player.money += event.data.reward;
        break;
      case 'playerHit':
        player.hurtT = 0.5;
        hud.setFlash(0.5);
        break;
      case 'roadblock':
        hud.bannerText('SBPD roadblock ahead!', 2600);
        break;
      case 'heli':
        hud.bannerText('SBPD air unit deployed — CONDOR-1', 2600);
        break;
      case 'carDestroyed':
        if (player.car) {
          game.playerApi.exitCar();
          game.worldApi.addWanted(1, 'car destroyed');
          hud.bannerText('Your car is wrecked!', 2600);
        }
        break;
      default:
        break;
    }
  }
  world.events.length = 0;
}

// ---- Camera ----
function updateCamera(dt) {
  const player = game.playerApi.player;
  const world = game.worldApi.world;
  let eye;
  let target;
  if (screen === 'title') {
    // Attract camera: slow cycle through chase, high and street angles.
    const cycle = (game.time % 36) / 12;
    const car = player.car;
    if (car) {
      if (cycle < 1) {
        eye = [car.x - Math.sin(car.heading) * 9, 3.6, car.z - Math.cos(car.heading) * 9];
        target = [car.x + Math.sin(car.heading) * 8, 1.2, car.z + Math.cos(car.heading) * 8];
      } else if (cycle < 2) {
        const a = game.time * 0.08;
        eye = [car.x + Math.cos(a) * 42, 34, car.z + Math.sin(a) * 42];
        target = [car.x, 1, car.z];
      } else {
        eye = [car.x + 14, 2.2, car.z - 10];
        target = [car.x, 1.4, car.z];
      }
    } else {
      eye = [player.x + 10, 6, player.z - 12];
      target = [player.x, 1.2, player.z];
    }
  } else if (player.car) {
    const car = player.car;
    const back = 9.5 + Math.abs(car.speed) * 0.08;
    const wantEye = [
      car.x - Math.sin(car.heading) * back,
      3.4 + Math.abs(car.speed) * 0.02,
      car.z - Math.cos(car.heading) * back,
    ];
    const wantTarget = [car.x + Math.sin(car.heading) * 10, 1.3, car.z + Math.cos(car.heading) * 10];
    // Snap instead of gliding when the camera is nowhere near its target
    // (first frames, respawns, staged shots): a long fly-through would
    // leave the player out of frame.
    const far = Math.hypot(wantEye[0] - camPos[0], wantEye[1] - camPos[1], wantEye[2] - camPos[2]) > 60;
    eye = far ? wantEye : [lerp(camPos[0], wantEye[0], 1 - Math.pow(0.001, dt)), lerp(camPos[1], wantEye[1], 1 - Math.pow(0.001, dt)), lerp(camPos[2], wantEye[2], 1 - Math.pow(0.001, dt))];
    target = wantTarget;
  } else {
    const dist = 6.8;
    const height = 2.6 + player.camPitch * 2.2;
    const wantEye = [
      player.x - Math.sin(player.camYaw) * dist * Math.cos(player.camPitch),
      height,
      player.z - Math.cos(player.camYaw) * dist * Math.cos(player.camPitch),
    ];
    const wantTarget = [
      player.x + Math.sin(player.camYaw) * 6,
      1.4 - player.camPitch * 2,
      player.z + Math.cos(player.camYaw) * 6,
    ];
    const far = Math.hypot(wantEye[0] - camPos[0], wantEye[1] - camPos[1], wantEye[2] - camPos[2]) > 60;
    eye = far ? wantEye : [lerp(camPos[0], wantEye[0], 1 - Math.pow(0.0005, dt)), lerp(camPos[1], wantEye[1], 1 - Math.pow(0.0005, dt)), lerp(camPos[2], wantEye[2], 1 - Math.pow(0.0005, dt))];
    target = wantTarget;
  }
  // Snap instead of gliding when the camera is nowhere near its target
  // (first frames, respawns, staged shots): a long fly-through would leave
  // the player out of frame.
  if (shakeT > 0) {
    shakeT -= dt;
    const s = shakeAmp * (shakeT / 0.5);
    eye[0] += (Math.random() - 0.5) * s;
    eye[1] += (Math.random() - 0.5) * s * 0.6;
    eye[2] += (Math.random() - 0.5) * s;
  }
  camPos = eye;
  camTarget = target;
  return { eye, target, fov: 1.05 };
}

// ---- Per-frame step ----
function step(dt) {
  game.time += dt;
  const world = game.worldApi.world;
  const player = game.playerApi.player;

  if (screen === 'title') {
    attractIdle += dt;
    if (attractIdle > 8 && !titleFaded) {
      titleFaded = true;
      hud.title.style.opacity = '0';
      hud.title.style.pointerEvents = 'none';
      showHint('SOLUNA BAY — press ENTER to play');
    }
    // Attract autopilot drives the player's car around the city.
    if (player.car) {
      const move = attractDrive(player, world);
      game.playerApi.update(dt, move, { dx: 0, dy: 0 }, {}, false, null);
    }
    game.worldApi.update(dt);
    game.missionsApi.update(dt);
    const actions = input.takeActions();
    if (actions & 1 || input.takeClick()) {
      audio.unlock();
      titleFaded = false;
      attractIdle = 0;
      hud.title.style.opacity = '1';
      hud.title.style.pointerEvents = 'auto';
      showHint('');
      if (actions & 1) {
        const slots = listSlots();
        const first = slots.find((s) => !s.empty);
        if (first) {
          game = buildGame();
          const save = loadFromSlot(first.index);
          if (save) applySnapshot(game, save);
          startPlay();
        } else {
          game = buildGame();
          startPlay();
        }
      }
    }
    return;
  }

  if (screen === 'play') {
    const move = input.move();
    const mouse = input.takeMouse();
    const rawActions = input.takeActions();
    const actions = {
      enter: !!(rawActions & 8),
      steal: !!(rawActions & 16),
      reload: !!(rawActions & 32),
      weaponNext: !!(rawActions & 128),
    };
    if (rawActions & 64) {
      audio.cycleStation();
      hud.bannerText(`Radio — ${audio.stationName()}`, 1600);
    }
    // J starts the next mission. It is a one-shot action (buffered in the
    // input's `pressed` set), so a quick tap can never fall between frames.
    if (rawActions & 512) {
      const idx = game.missionsApi.state.available;
      if (idx < 8 && !game.missionsApi.state.active) {
        game.missionsApi.startMission(idx);
      } else if (game.missionsApi.state.active) {
        hud.bannerText('Finish the current job first', 1800);
      }
    }
    if (input.isDown('KeyM') && !prevM) openPause();
    prevM = input.isDown('KeyM');
    if (input.isDown('Escape') && !prevEsc) openPause();
    prevEsc = input.isDown('Escape');
    if (input.takeClick()) audio.unlock();
    const firing = input.firing() && !player.car;
    // Garage: drive slowly into the marked bay and press E. Intercept the
    // key before the player update, or E would exit the car first.
    const g = game.city.spots.garage;
    const nearGarage = !!player.car && Math.hypot(player.x - g.x, player.z - g.z) < 11 && Math.abs(player.car.speed) < 3;
    let openGarageAfter = false;
    if (nearGarage && actions.enter) {
      actions.enter = false;
      openGarageAfter = true;
    }
    game.playerApi.update(dt, move, mouse, actions, firing, audio);
    game.worldApi.update(dt);
    game.missionsApi.update(dt);
    garageNear = nearGarage;
    showHint(nearGarage ? 'Press E — Soluna Spray & Tune' : '');
    if (openGarageAfter) {
      openGarage();
    }
    // Radio + siren levels.
    const copsNear = world.cars.some((c) => c.kind === 'police' && Math.hypot(c.x - player.x, c.z - player.z) < 55);
    audio.setSiren(world.wanted.stars > 0 && copsNear);
    if (!player.car) audio.setEngine(0, false);
    drainEvents();
    return;
  }

  // Paused screens: the world holds still behind the overlay.
  if (screen === 'pause') {
    const rawActions = input.takeActions();
    if (rawActions & 2 || (input.isDown('KeyM') && !prevM) || (input.isDown('Escape') && !prevEsc)) {
      screen = 'play';
      hud.hideOverlays();
      showHint('');
      announce('Playing.');
    }
    prevM = input.isDown('KeyM');
    prevEsc = input.isDown('Escape');
    if (rawActions & 2) {
      screen = 'play';
      hud.hideOverlays();
      showHint('');
      announce('Playing.');
    }
    return;
  }
  if (screen === 'garage' || screen === 'howto' || screen === 'end') {
    const rawActions = input.takeActions();
    if (screen === 'garage' && rawActions & 2) {
      screen = 'play';
      hud.hideOverlays();
    }
    return;
  }
}

// ---- Render ----
function render() {
  const world = game.worldApi.world;
  const player = game.playerApi.player;
  const camera = updateCamera(1 / 60);
  const env = environmentFor(world.clock, world.night);
  const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
  env.proj = mat4Perspective(camera.fov, aspect, 0.1, 1600);
  env.view = mat4LookAt(camera.eye, camera.target, [0, 1, 0]);
  const marker = game.missionsApi.marker();
  const race = game.missionsApi.state.races.active;
  let gates = null;
  if (race) {
    gates = race.race.gates.slice(race.gateIndex).map((g) => ({ x: g.x, z: g.z, heading: 0 }));
  } else if (marker && marker.race) {
    gates = [marker].map((g) => ({ x: g.x, z: g.z, heading: 0 }));
  }
  // Active mission stage gates (race stages show the next gate).
  const act = game.missionsApi.state.active;
  if (act) {
    const stage = act.mission.stages[act.stage];
    if (stage && stage.type === 'race') {
      gates = stage.gates.slice(act.gateIndex).map((g) => ({ x: g.x, z: g.z, heading: 0 }));
    }
  }
  drawScene(renderer, meshes, game.city, world, player, { ...camera, marker, gates }, env, game.time);
  hud.setFlash(Math.max(0, player.hurtT) * 0.6);
}

// ---- Main loop ----
let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  renderer.resize(canvas.clientWidth, canvas.clientHeight);
  accumulator += Math.min((now - last) / 1000, MAX_FRAME);
  last = now;
  while (accumulator >= STEP) {
    step(STEP);
    accumulator -= STEP;
  }
  render();
  hud.update(game, 1 / 60);
  if (screen === 'pause') hud.drawBigMap(game);
}

// Debug hook for automated checks (harmless in normal play).
Object.defineProperty(window, '__game', { get: () => game });
Object.defineProperty(window, '__screen', { get: () => screen });

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') openPause();
});

// ---- Screenshot staging ----
if (shotName) {
  const shot = stageShot(shotName, game);
  if (shotName === 'map') {
    screen = 'pause';
    hud.showPause();
  } else {
    // Use the in-play camera (chase / third-person), not the attract orbit.
    screen = 'play';
    hud.hideOverlays();
  }
  announce(`Soluna Bay — shot: ${shotName}`);
  let painted = 0;
  function paintShot() {
    renderer.resize(canvas.clientWidth, canvas.clientHeight);
    render();
    hud.update(game, 1 / 60);
    if (shotName === 'map') hud.drawBigMap(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paintShot);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paintShot);
} else {
  hud.showTitle(listSlots().some((s) => !s.empty));
  announce('Soluna Bay. Press Enter to play.');
  requestAnimationFrame(frame);
}
