// SOLUNA BAY — the game loop: screens, camera, attract mode, and the
// per-frame dynamic mesh (cars, people, helicopter, markers, sky).
import { Renderer, Mesh, skyFor } from './gl.js';
import { buildStaticMesh } from './meshbuild.js';
import { World } from './world.js';
import { Input, ACTION } from './input.js';
import { AudioSys } from './audio.js';
import { Hud } from './hud.js';
import { stageShot } from './shots.js';
import { readSlots, slotSummary, saveSlot, loadSlot } from './save.js';
import { STEP, WEAPONS, UPGRADES, PROPERTIES, GARAGE, districtAt } from './config.js';
import { RACES } from './missions.js';
import { makeRng } from './rng.js';

const TAU = Math.PI * 2;
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// Fixed stars for the night sky (seeded once, same every night).
const STARS = (() => {
  const rng = makeRng(4242);
  const out = [];
  for (let i = 0; i < 70; i += 1) {
    const a = rng.range(0, TAU);
    const r = rng.range(180, 380);
    out.push({ x: Math.cos(a) * r, y: rng.range(120, 260), z: Math.sin(a) * r });
  }
  return out;
})();

function drawFigure(m, x, z, heading, phase, color, armed) {
  const fx = Math.sin(heading);
  const fz = Math.cos(heading);
  const rx = Math.cos(heading);
  const rz = -Math.sin(heading);
  const swing = Math.sin(phase) * 0.28;
  const legL = 0.55;
  // Legs swing along the walk direction.
  m.box(x + fx * swing - rx * 0.13, 0.35, z + fz * swing - rz * 0.13, 0.2, 0.7, 0.2, 0x2b2f36);
  m.box(x - fx * swing + rx * 0.13, 0.35, z - fz * swing + rz * 0.13, 0.2, 0.7, 0.2, 0x2b2f36);
  // Torso and head.
  m.box(x, 1.05, z, 0.55, 0.7, 0.32, color);
  m.box(x, 1.62, z, 0.32, 0.32, 0.32, 0xd8a878);
  // Arms swing opposite the legs.
  m.box(x - fx * swing * 0.7 + rx * 0.36, 1.05, z - fz * swing * 0.7 + rz * 0.36, 0.16, 0.6, 0.16, color);
  m.box(x + fx * swing * 0.7 - rx * 0.36, 1.05, z + fz * swing * 0.7 - rz * 0.36, 0.16, 0.6, 0.16, color);
  if (armed) {
    m.box(x + fx * 0.35 + rx * 0.36, 1.1, z + fz * 0.35 + rz * 0.36, 0.14, 0.14, 0.7, 0x1a1a1a);
  }
}

function drawCar(m, glow, car, time, night) {
  const h = car.heading;
  const rot = h - Math.PI / 2;
  const L = car.type.len;
  const W = car.type.wid;
  const fx = Math.sin(h);
  const fz = Math.cos(h);
  const rx = Math.cos(h);
  const rz = -Math.sin(h);
  const shade = (c, f) => {
    const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
    const b = Math.min(255, Math.round((c & 255) * f));
    return (r << 16) | (g << 8) | b;
  };
  // Body and cabin. The cabin's sides are dark glass (windows) but its
  // TOP is the roof, so it takes the body colour — a cabin that is dark
  // all over reads as a black box sitting on the car (round-6 diagnosis:
  // the player's red car looked like a black car on a red wedge).
  m.rbox(car.x, 0.55, car.z, L, 0.7, W, rot, car.color, shade(car.color, 1.18));
  m.rbox(car.x - fx * 0.3, 1.18, car.z - fz * 0.3, L * 0.48, 0.55, W * 0.85, rot, 0x222831, shade(car.color, 1.1));
  // Wheels.
  for (const s1 of [-1, 1]) {
    for (const s2 of [-1, 1]) {
      const wx = car.x + fx * s1 * L * 0.32 + rx * s2 * (W / 2 - 0.1);
      const wz = car.z + fz * s1 * L * 0.32 + rz * s2 * (W / 2 - 0.1);
      m.rbox(wx, 0.32, wz, 0.32, 0.62, 0.28, rot, 0x14161a, 0x14161a);
    }
  }
  // Headlights and taillights.
  const hx = car.x + fx * (L / 2 + 0.02);
  const hz = car.z + fz * (L / 2 + 0.02);
  const tx = car.x - fx * (L / 2 + 0.02);
  const tz = car.z - fz * (L / 2 + 0.02);
  for (const s of [-1, 1]) {
    glow.rbox(hx + rx * s * W * 0.3, 0.55, hz + rz * s * W * 0.3, 0.1, 0.18, 0.34, rot, night ? 0xfff2b8 : 0xcfc8a8, 0xfff2b8);
    glow.rbox(tx + rx * s * W * 0.3, 0.55, tz + rz * s * W * 0.3, 0.1, 0.18, 0.34, rot, 0xd82a2a, 0xd82a2a);
  }
  // Police light bar, flashing.
  if (car.kind === 'police') {
    const on = Math.floor(time * 3) % 2 === 0;
    glow.rbox(car.x, 1.62, car.z, 0.5, 0.22, 1.1, rot, on ? 0xff2a2a : 0x2a4aff, on ? 0xff2a2a : 0x2a4aff);
    glow.rbox(car.x, 1.62, car.z, 0.5, 0.22, 1.1, rot, on ? 0x2a4aff : 0xff2a2a, on ? 0x2a4aff : 0xff2a2a);
  }
}

export class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.audio = new AudioSys();
    this.hud = new Hud();
    this.screen = 'title';
    this.camYaw = Math.PI;
    this.camFreeUntil = 0;
    this.titleAt = 0;
    this.titleFaded = false;
    this.flashT = 0;
    this.acc = 0;
    this.last = performance.now();
    this.garageOpen = false;
    const params = new URLSearchParams(window.location.search);
    const seed = parseInt(params.get('seed') || '1', 10) || 1;
    this.world = new World(seed);
    this.world.audio = this.audio;
    this.renderer.uploadStatic(buildStaticMesh(this.world.city));
    const shot = params.get('shot');
    if (shot) {
      const staged = stageShot(shot, this.world);
      this.screen = staged.screen;
      // Snap the camera to its final angle (heading + camSide) now: the
      // chase camera lerps 3% per tick toward it, and the tick count
      // during the screenshot wait depends on the frame rate, so without
      // the snap the cover's camera angle is a frame-rate lottery. With
      // the snap (and the photo freeze) the cover is byte-identical
      // between runs.
      // Mark the page as a staged shot: the HUD's real-time animations
      // (the pulsing wanted stars) are held so the screenshot is
      // byte-identical between runs — a live game pulses, a photo does not.
      document.body.classList.add('shot');
      this.camYaw = this.world.player.heading + (this.world.camSide || 0);
      this.hud.hideTitle(); // the title overlay is visible by default in the HTML
      if (staged.screen === 'map') this.hud.setOverlay('map-overlay', true);
    } else {
      this.world.attract = true;
      this.hud.showTitle(readSlots().map(slotSummary));
      this.titleAt = performance.now();
    }
    window.addEventListener('keydown', () => this.audio.ensure());
    window.addEventListener('mousedown', () => this.audio.ensure());
    requestAnimationFrame((t) => this.loop(t));
  }

  loop(now) {
    requestAnimationFrame((t) => this.loop(t));
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.25) dt = 0.25;
    this.acc += dt;
    let n = 0;
    while (this.acc >= STEP && n < 8) {
      this.tick();
      this.acc -= STEP;
      n += 1;
    }
    // Drop backlog on a slow frame rather than spiralling: the game runs
    // in slow motion instead of freezing.
    if (this.acc > 0.25) this.acc = 0.25;
    this.render();
  }

  tick() {
    const world = this.world;
    const input = this.input;
    let actions = input.takeActions();
    const drag = input.takeDrag();
    if (drag.x !== 0) {
      this.camYaw += drag.x * 0.005;
      this.camFreeUntil = world.time + 2.5;
    }
    if (actions & ACTION.RADIO) {
      this.audio.setStation(this.audio.station + 1);
      this.hud._set('radio', this.audio.stationName());
    }
    if (this.screen === 'title') {
      // Any key or click starts; 1/2/3 load a save slot. (Enter and the other
      // keys are not all mapped actions, so a key held down counts too.)
      const slot = input.weaponSlot();
      if (slot >= 0 && slot < 3) {
        const s = loadSlot(slot + 1);
        if (s) {
          world.restore(s);
          world.attract = false;
          this.screen = 'play';
          this.hud.hideTitle();
          this.hud._set('radio', this.audio.stationName());
        }
        return;
      }
      if (actions !== 0 || input.mouseDown || input.down.size > 0) {
        if (performance.now() - this.titleAt > 300) {
          world.reset();
          world.attract = false;
          this.screen = 'play';
          this.hud.hideTitle();
        }
        return;
      }
      // Fade the title after 8 s idle; the attract drive keeps rolling.
      if (!this.titleFaded && performance.now() - this.titleAt > 8000) {
        this.titleFaded = true;
        const t = document.getElementById('title');
        if (t) t.classList.add('faded');
      }
      world.step(input, 0, this.camYaw);
      this._followCamera();
      return;
    }
    if (this.screen === 'pause') {
      if (actions & ACTION.PAUSE) {
        this.screen = 'play';
        this.hud.setOverlay('pause', false);
      }
      if (input.isDown('KeyX')) {
        this.screen = 'title';
        world.reset();
        world.attract = true;
        this.titleAt = performance.now();
        this.titleFaded = false;
        const t = document.getElementById('title');
        if (t) t.classList.remove('faded');
        this.hud.setOverlay('pause', false);
        this.hud.showTitle(readSlots().map(slotSummary));
      }
      return;
    }
    if (this.screen === 'map') {
      if (actions & (ACTION.PAUSE | ACTION.MAP)) {
        this.screen = 'play';
        this.hud.setOverlay('map-overlay', false);
      }
      if (!world.photoFreeze) world.step(input, 0, this.camYaw);
      this._followCamera();
      this._drainFx();
      return;
    }
    if (this.screen === 'garage') {
      const slot = input.weaponSlot();
      if (slot >= 0 && slot < UPGRADES.length) {
        world.buyUpgrade(UPGRADES[slot].id);
        this.hud.fillGarage(world);
      }
      if (actions & (ACTION.PAUSE | ACTION.ENTER)) {
        this.screen = 'play';
        this.hud.setOverlay('garage-menu', false);
      }
      return;
    }
    if (this.screen === 'save') {
      const slot = input.weaponSlot();
      if (slot >= 0 && slot < 3) {
        if (saveSlot(slot + 1, world.snapshot())) {
          world.say(`Saved to slot ${slot + 1}.`, 3);
        } else {
          world.say('Save failed — storage is full or blocked.', 3);
        }
        this.screen = 'play';
        this.hud.setOverlay('save-menu', false);
      }
      if (actions & ACTION.PAUSE) {
        this.screen = 'play';
        this.hud.setOverlay('save-menu', false);
      }
      return;
    }
    // Screen: play.
    if (actions & ACTION.PAUSE) {
      this.screen = 'pause';
      this.hud.setOverlay('pause', true);
      const st = document.getElementById('pause-stats');
      if (st) {
        st.textContent = `${districtAt(world.player.x, world.player.z)} — ${world.player.money} dollars — `
          + `${world.player.missionsDone.length} of 8 jobs — ${world.player.collected.size} of 40 shells — `
          + `${world.progress()}% complete`;
      }
      return;
    }
    if (actions & ACTION.MAP) {
      this.screen = 'map';
      this.hud.setOverlay('map-overlay', true);
      return;
    }
    // Garage: in a car, near Calder Auto Works.
    if (!world.player.onFoot && Math.hypot(world.player.x - GARAGE.x, world.player.z - GARAGE.z) < 9
      && (actions & ACTION.ENTER)) {
      this.screen = 'garage';
      this.hud.fillGarage(world);
      this.hud.setOverlay('garage-menu', true);
      return;
    }
    // Save points: on foot at an owned property or the garage.
    if (world.player.onFoot && (actions & ACTION.SAVE)) {
      let atSave = false;
      for (const prop of PROPERTIES) {
        if (world.player.properties.has(prop.id) && Math.hypot(world.player.x - prop.x, world.player.z - prop.z) < 6) atSave = true;
      }
      if (Math.hypot(world.player.x - GARAGE.x, world.player.z - GARAGE.z) < 6) atSave = true;
      if (atSave) {
        this.screen = 'save';
        this.hud.setOverlay('save-menu', true);
        return;
      }
    }
    // Race starts: on foot at a race marker. Mask E out afterwards so the
    // world does not also try to enter a nearby car with the same press.
    if (world.player.onFoot && (actions & ACTION.ENTER)) {
      for (const r of RACES) {
        if (!world.player.racesDone.includes(r.id) && Math.hypot(world.player.x - r.start.x, world.player.z - r.start.z) < 6) {
          world.startRace(r);
          actions &= ~ACTION.ENTER;
          break;
        }
      }
    }
    // Photo freeze (set by shots.js for the ?shot= scenes): the world does
    // not step during the screenshot wait, so the frame is exactly the
    // staged one. The browser's coast during that wait varies by tens of
    // metres with the frame rate (on one probe run the player coasted
    // ~74 m and drove straight through the roadblock band), which made
    // the cover a lottery. Rendering, the camera and the HUD still update;
    // only the simulation is held.
    if (!world.photoFreeze) world.step(input, actions, this.camYaw);
    this._followCamera();
    this._drainFx();
    if (this.flashT > 0) this.flashT -= STEP;
  }

  _followCamera() {
    const world = this.world;
    const p = world.player;
    if (world.time > this.camFreeUntil) {
      this.camYaw += angDiff(p.heading + (world.camSide || 0), this.camYaw) * 0.03;
    }
    // Low cinematic chase camera: close behind the car and low, so the
    // player's ride fills the lower frame and the road rushes toward the
    // viewer — the leaders' covers are all shot this way, and the old
    // 15 m / 6.5 m setup read as a surveillance camera (round-6 diagnosis).
    const dist = p.onFoot ? 9 : 8;
    const height = p.onFoot ? 4 : 3.6;
    // Look AHEAD of the car, not at it: the chase camera frames the
    // player's ride in the lower third with the road ahead filling the
    // frame — the leaders' covers are all shot this way. Looking AT the
    // player put the car at frame centre, cropped by the bottom edge.
    const lookAhead = p.onFoot ? 0 : 8;
    const tx = p.x + Math.sin(this.camYaw) * lookAhead;
    const tz = p.z + Math.cos(this.camYaw) * lookAhead;
    this.camera = {
      target: [tx, p.onFoot ? 1.6 : 2.0, tz],
      eye: [
        p.x - Math.sin(this.camYaw) * dist,
        height + (p.onFoot ? 0.6 : 0.4),
        p.z - Math.cos(this.camYaw) * dist,
      ],
    };
  }

  _drainFx() {
    const world = this.world;
    for (const fx of world.fx) {
      if (fx === 'shoot') {
        this.audio.shoot(WEAPONS[world.player.weapon].id);
        this.flashT = 0.06;
      } else if (fx === 'pickup') this.audio.pickup();
      else if (fx === 'crash') this.audio.crash();
      else if (fx === 'busted') this.audio.busted();
    }
    world.fx = [];
    const p = world.player;
    this.audio.setEngine(p.onFoot ? 0 : Math.abs(p.car ? p.car.speed : 0), !p.onFoot);
    const policeNear = world.cars.some((c) => c.kind === 'police' && !c.parked
      && (c.x - p.x) * (c.x - p.x) + (c.z - p.z) * (c.z - p.z) < 60 * 60);
    this.audio.setSiren(p.wanted > 0 && policeNear ? 1 : 0);
  }

  render() {
    const world = this.world;
    const sky = skyFor(world.hour());
    const time = world.time;
    const dyn = new Mesh();
    const glow = new Mesh();
    const alpha = new Mesh();
    const p = world.player;
    // Cars.
    for (const car of world.cars) {
      drawCar(dyn, glow, car, time, sky.night);
    }
    // People.
    for (const ped of world.peds) {
      if (ped.state === 'dead') continue;
      drawFigure(dyn, ped.x, ped.z, ped.heading, ped.phase, ped.color, ped.state === 'attack');
    }
    if (p.onFoot) {
      drawFigure(dyn, p.x, p.z, p.heading, p.walkPhase, 0xe8e4da, p.weapon > 0);
    }
    // Helicopter and its searchlight: a narrow shaft from the heli to the
    // ground. (A glow at the player's feet would sit right in front of the
    // camera, so the beam alone carries it.)
    if (world.heli.active) {
      const h = world.heli;
      const rot = h.rotor;
      dyn.rbox(h.x, h.y, h.z, 4.6, 1.5, 2.0, 0, 0x20242a, 0x2e343c);
      dyn.rbox(h.x - 3.4, h.y + 0.3, h.z, 3.2, 0.5, 0.5, 0, 0x20242a, 0x20242a);
      dyn.rbox(h.x, h.y + 1.0, h.z, 9.0, 0.08, 0.5, rot, 0x14161a, 0x14161a);
      dyn.rbox(h.x, h.y - 1.1, h.z, 1.8, 0.15, 0.3, 0, 0x14161a, 0x14161a);
      alpha.prism(p.x, 0, p.z, 0.6, h.y, 10, 0xfff2b8, 0xfff2b8);
    }
    // Mission target marker and beam.
    const target = world._missionTarget();
    if (target && target.x !== undefined && world.mission.active) {
      const bob = 3 + Math.sin(time * 2) * 0.5;
      glow.gem(target.x, bob, target.z, 1.3, 0xffd23a);
      alpha.prism(target.x, 0, target.z, 0.9, 30, 8, 0xffd23a, 0xffd23a);
    }
    // Mission package gems.
    const m = world.mission.active;
    if (m && m.data.gems) {
      for (const g of m.data.gems) {
        if (!g.taken) glow.gem(g.x, 1 + Math.sin(time * 2 + g.x) * 0.25, g.z, 0.7, 0xffd23a);
      }
    }
    // Collectible shells.
    world.city.collectibles.forEach((c, i) => {
      if (!c.taken && !p.collected.has(i)) {
        glow.gem(c.x, 1 + Math.sin(time * 2 + c.bob) * 0.3, c.z, 0.55, 0xffe9a8);
      }
    });
    // Tracers.
    for (const t of world.tracers) {
      const dx = t.x2 - t.x1;
      const dz = t.z2 - t.z1;
      const len = Math.hypot(dx, dz) || 1;
      const rot = Math.atan2(dx, dz) - Math.PI / 2;
      glow.rbox((t.x1 + t.x2) / 2, 1.3, (t.z1 + t.z2) / 2, len, 0.09, 0.09, rot, 0xfff2b8, 0xfff2b8);
    }
    // Muzzle flash.
    if (this.flashT > 0 && p.onFoot && p.weapon > 0) {
      const gx = p.x + Math.sin(p.heading) * 0.9;
      const gz = p.z + Math.cos(p.heading) * 0.9;
      glow.gem(gx, 1.3, gz, 0.8, 0xfff2b8);
    }
    // Sky: sun or moon, stars, lamp glows at night.
    const cam = this.camera || { target: [p.x, 1.6, p.z] };
    if (sky.night) {
      for (const s of STARS) {
        glow.gem(cam.target[0] + s.x, s.y, cam.target[2] + s.z, 1.6, 0xffffff);
      }
      const md = sky.sunDir;
      glow.gem(cam.target[0] + md[0] * 380, 260, cam.target[2] + md[2] * 380, 10, 0xe8ecf2);
      for (const l of world.city.lamps) {
        glow.box(l.x, 5.35, l.z, 1.1, 0.3, 0.45, 0xffe9a8, 0xfff6c8);
      }
    } else {
      const sd = sky.sunDir;
      glow.gem(cam.target[0] + sd[0] * 380, 280, cam.target[2] + sd[2] * 380, 12, 0xfff2b8);
    }
    if (!this.camera) this._followCamera();
    this.renderer.frame(this.camera, sky, dyn, glow, alpha);
    this.hud.update(world, this.screen);
  }
}

const game = new Game(document.getElementById('game'));
// Exposed for local testing and debugging (Playwright reads it).
window.__soluna = game;
