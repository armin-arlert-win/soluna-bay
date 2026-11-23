// SOLUNA BAY — the simulation: player, traffic, police, combat, missions.
// One fixed step at a time; the renderer only reads the state it leaves.
import {
  GRID, PITCH, ROAD_CENTERS, STEP, START, WEAPONS, CAR_TYPES, CAR_COLORS,
  UPGRADES, PROPERTIES, GARAGE, COLLECTIBLE_COUNT, WANTED_MAX, districtAt,
  rankFor, CREW,
} from './config.js';
import { MISSIONS, RACES } from './missions.js';
import { buildCity, nearestRoad, onRoad, clampCity } from './city.js';
import { makeRng } from './rng.js';

const TAU = Math.PI * 2;
function angDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function dist2(ax, az, bx, bz) {
  const dx = ax - bx;
  const dz = az - bz;
  return dx * dx + dz * dz;
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export class World {
  constructor(seed) {
    this.seed = seed;
    this.city = buildCity(seed);
    this.rng = makeRng(seed * 31 + 7);
    this.reset();
  }

  reset() {
    this.time = 0;
    this.clock = 8 * 60; // minutes since midnight; game starts 08:00
    this.player = {
      x: START.x, z: START.z, heading: START.heading, speed: 0,
      onFoot: true, car: null, health: 100, armour: 0,
      money: START.money, respect: 0, weapon: 0,
      ammo: [Infinity, 120, 240, 32], mag: [Infinity, 12, 30, 6],
      wanted: 0, lastCrime: -999, wantedTimer: 0, bustedTimer: 0,
      passenger: null, reloadT: 0, fireT: 0, walkPhase: 0,
      upgrades: { armour: false, engine: false, nitro: false },
      collected: new Set(), properties: new Set(),
      missionsDone: [], racesDone: [], kills: 0,
    };
    this.cars = [];
    this.peds = [];
    this.heli = { active: false, x: 0, z: 0, y: 34, rotor: 0 };
    this.roadblocks = [];
    this.messages = [];
    this.subtitle = null;
    this.subtitleUntil = 0;
    this.banner = null;
    this.bannerUntil = 0;
    this.tracers = [];
    this.fx = [];
    this.mission = { next: 0, active: null };
    this.race = { active: null };
    this.attract = false;
    this.attractCar = null;
    this.camSide = 0; // chase shots offset the camera to show the pursuit
    this.camYaw = Math.PI;
    this._spawnTraffic();
    this._spawnPeds();
    this._spawnParked();
    this.say('Welcome to Soluna Bay. Press J to start the first job.', 6);
  }

  hour() {
    return (this.clock / 60) % 24;
  }
  isNight() {
    const h = this.hour();
    return h < 6 || h >= 19;
  }
  district() {
    return districtAt(this.player.x, this.player.z);
  }

  say(text, seconds = 4) {
    this.messages.push({ text, until: this.time + seconds });
    if (this.messages.length > 4) this.messages.shift();
  }
  talk(text, seconds = 5) {
    this.subtitle = text;
    this.subtitleUntil = this.time + seconds;
  }
  showBanner(text, seconds = 3) {
    this.banner = text;
    this.bannerUntil = this.time + seconds;
  }

  // ---- spawning ----
  _randRoadPos() {
    const along = ROAD_CENTERS[this.rng.int(0, ROAD_CENTERS.length - 1)];
    const cross = ROAD_CENTERS[this.rng.int(0, ROAD_CENTERS.length - 1)];
    return this.rng.chance(0.5) ? { x: along, z: cross } : { x: cross, z: along };
  }
  _newCar(typeId, x, z, heading, kind) {
    const type = CAR_TYPES.find((t) => t.id === typeId);
    const car = {
      id: this.cars.length + 1, type, x, z, heading, speed: 0,
      color: typeId === 'cruiser' ? 0xf2f2f2 : CAR_COLORS[this.rng.int(0, CAR_COLORS.length - 1)],
      kind, hp: 100, driver: kind !== 'parked', parked: kind === 'parked',
      targetSpeed: this.rng.range(8, 13), turn: null, ai: kind === 'police' ? 'police' : 'traffic',
      stuck: 0, route: null, routeIdx: 0, flash: 0,
      crashT: 0, ramT: 0, bumpT: 0, // damage cooldowns (seconds)
    };
    this.cars.push(car);
    return car;
  }
  _spawnTraffic() {
    const types = ['clipper', 'sable', 'bison', 'mule', 'comet'];
    for (let i = 0; i < 15; i += 1) {
      const p = this._randRoadPos();
      const heading = (this.rng.int(0, 3) * Math.PI) / 2;
      const car = this._newCar(types[this.rng.int(0, types.length - 1)], p.x, p.z, heading, 'traffic');
      car.speed = car.targetSpeed;
    }
  }
  _spawnParked() {
    const types = ['clipper', 'sable', 'bison', 'mule', 'comet'];
    for (let i = 0; i < 9; i += 1) {
      const p = this._randRoadPos();
      const heading = (this.rng.int(0, 3) * Math.PI) / 2;
      const car = this._newCar(types[this.rng.int(0, types.length - 1)], p.x + 2.5, p.z, heading, 'parked');
      car.speed = 0;
    }
  }
  _spawnPeds() {
    const colors = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe8e8e8, 0x2b2b2b];
    for (let i = 0; i < 30; i += 1) {
      const p = this._randRoadPos();
      this.peds.push({
        x: p.x + this.rng.range(-3, 3), z: p.z + this.rng.range(-3, 3),
        heading: (this.rng.int(0, 3) * Math.PI) / 2, speed: this.rng.range(1.2, 2.0),
        color: colors[this.rng.int(0, colors.length - 1)],
        state: 'walk', hp: 40, shootT: 0, phase: this.rng.range(0, TAU),
      });
    }
  }
  _spawnPoliceNear() {
    const p = this.player;
    const a = this.rng.range(0, TAU);
    const x = p.x + Math.cos(a) * 65;
    const z = p.z + Math.sin(a) * 65;
    const c = clampCity(x, z);
    const heading = Math.atan2(p.x - c.x, p.z - c.z);
    const car = this._newCar('cruiser', nearestRoad(c.x), nearestRoad(c.z), heading, 'police');
    car.speed = 12;
    return car;
  }
  _spawnEnemy(x, z) {
    const e = {
      x: x + this.rng.range(-6, 6), z: z + this.rng.range(-6, 6),
      heading: this.rng.range(0, TAU), speed: 0, color: 0x1a1a1a,
      state: 'attack', hp: 60, shootT: 0, phase: 0,
    };
    this.peds.push(e);
    return e;
  }

  // ---- crimes and wanted ----
  addWanted(n, reason) {
    const p = this.player;
    p.wanted = Math.min(WANTED_MAX, p.wanted + n);
    p.lastCrime = this.time;
    if (reason) this.say(`SBPD dispatch: ${reason} — wanted level ${p.wanted}`, 4);
  }
  _policeTarget() {
    return Math.min(this.player.wanted + 1, 6);
  }

  // ---- main step ----
  step(input, actions, camYaw) {
    this.time += STEP;
    this.clock += STEP; // 1 real second = 1 game minute
    this.camYaw = camYaw;
    const p = this.player;
    if (p.reloadT > 0) p.reloadT -= STEP;
    if (p.fireT > 0) p.fireT -= STEP;
    for (const t of this.tracers) t.life -= STEP;
    this.tracers = this.tracers.filter((t) => t.life > 0);
    this.messages = this.messages.filter((m) => m.until > this.time);
    if (this.subtitle && this.time > this.subtitleUntil) this.subtitle = null;
    if (this.banner && this.time > this.bannerUntil) this.banner = null;

    if (this.attract) {
      this._stepAttract();
    } else if (p.onFoot) {
      this._stepOnFoot(input, actions);
    } else {
      this._stepDriving(input, actions);
    }
    this._stepTraffic();
    this._stepPeds();
    this._stepPolice();
    this._stepWanted();
    this._stepMission(actions);
    this._stepRace();
    this._stepCollectibles();
    this._stepInteractions(actions);
    this._updateHeli();
    this._checkBustedWasted();
  }

  // ---- player on foot ----
  _stepOnFoot(input, actions) {
    const p = this.player;
    const ax = input.axes();
    const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = run ? 9 : 5.5;
    let mx = 0;
    let mz = 0;
    if (ax.y !== 0 || ax.x !== 0) {
      const cy = this.camYaw;
      const fx = Math.sin(cy);
      const fz = Math.cos(cy);
      mx = fx * ax.y + fz * ax.x;
      mz = fz * ax.y - fx * ax.x;
      const l = Math.hypot(mx, mz) || 1;
      mx /= l;
      mz /= l;
      p.heading = Math.atan2(mx, mz);
      p.walkPhase += STEP * speed * 1.6;
    }
    const nx = p.x + mx * speed * STEP;
    const nz = p.z + mz * speed * STEP;
    const hit = this._buildingHit(nx, nz, 0.6);
    if (!hit) {
      p.x = nx;
      p.z = nz;
    } else if (!this._buildingHit(nx, p.z, 0.6)) {
      p.x = nx;
    } else if (!this._buildingHit(p.x, nz, 0.6)) {
      p.z = nz;
    }
    const c = clampCity(p.x, p.z);
    p.x = c.x;
    p.z = c.z;
    p.speed = (ax.y !== 0 || ax.x !== 0) ? speed : 0;
    if (actions & 16) this._fireWeapon(); // ACTION.SHOOT
    const slot = input.weaponSlot();
    if (slot >= 0 && slot < WEAPONS.length) {
      if (p.weapon !== slot) {
        p.weapon = slot;
        this.say(`${WEAPONS[slot].name} ready`, 2);
      }
    }
    if (actions & 32) this._reload(); // ACTION.RELOAD
  }

  // ---- driving ----
  _stepDriving(input, actions) {
    const p = this.player;
    const car = p.car;
    if (!car) { p.onFoot = true; return; }
    const ax = input.axes();
    const type = car.type;
    const top = type.top * (p.upgrades.engine ? 1.25 : 1);
    const accel = type.accel;
    if (ax.y > 0) car.speed += accel * STEP;
    else if (ax.y < 0) car.speed -= accel * 0.9 * STEP;
    else car.speed -= Math.sign(car.speed) * 3 * STEP;
    if (input.isDown('Space')) car.speed -= Math.sign(car.speed) * 14 * STEP;
    if (input.isDown('ShiftLeft') || input.isDown('ShiftRight')) {
      if (p.upgrades.nitro && car.speed > 4) car.speed += 10 * STEP;
    }
    car.speed = clamp(car.speed, -9, top);
    const steer = ax.x * clamp(Math.abs(car.speed) / 8, 0, 1) * 1.9;
    car.heading += steer * STEP * Math.sign(car.speed || 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * STEP;
    const nz = car.z + Math.cos(car.heading) * car.speed * STEP;
    if (car.crashT > 0) car.crashT -= STEP;
    const hit = this._buildingHit(nx, nz, 1.4);
    if (hit) {
      // A scrape, not a wreck: damage at most once per 0.6 s of contact.
      if (car.crashT <= 0) {
        car.crashT = 0.6;
        car.speed *= -0.25;
        car.hp -= 4;
        this.fx.push('crash');
        this.say('Ouch — bodywork damage', 2);
      } else {
        car.speed *= 1 - 2 * STEP;
      }
    } else {
      car.x = nx;
      car.z = nz;
      if (!onRoad(car.x, car.z)) car.speed *= 1 - 0.35 * STEP;
    }
    // Bumping other cars.
    if (car.bumpT > 0) car.bumpT -= STEP;
    for (const o of this.cars) {
      if (o === car || o.parked) continue;
      if (dist2(car.x, car.z, o.x, o.z) < 9) {
        const push = 3 * STEP;
        const a = Math.atan2(o.x - car.x, o.z - car.z);
        o.x += Math.sin(a) * push;
        o.z += Math.cos(a) * push;
        if (car.bumpT <= 0 && Math.abs(car.speed) > 4) {
          car.bumpT = 0.5;
          o.hp -= 2;
          car.hp -= 1;
          if (o.kind === 'target' && this.mission.active) this._hitTargetCar(o);
        }
      }
    }
    const c = clampCity(car.x, car.z);
    car.x = c.x;
    car.z = c.z;
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speed = Math.abs(car.speed);
    if (car.hp <= 0) {
      this.say('The car is wrecked.', 3);
      car.parked = true;
      car.driver = false;
      car.speed = 0;
      this._exitCar();
    }
    if (actions & 16) this._fireWeapon();
    const slot = input.weaponSlot();
    if (slot >= 0 && slot < WEAPONS.length) p.weapon = slot;
    if (actions & 32) this._reload();
  }

  _buildingHit(x, z, r) {
    for (const b of this.city.buildings) {
      if (Math.abs(x - b.x) < b.w / 2 + r && Math.abs(z - b.z) < b.d / 2 + r) return b;
    }
    return null;
  }

  _enterCar(car) {
    const p = this.player;
    if (car.driver === true) {
      // Pull the driver out; they flee on foot.
      this.peds.push({
        x: car.x + 2, z: car.z + 2, heading: this.rng.range(0, TAU), speed: 3.2,
        color: 0xd8c84a, state: 'flee', hp: 40, shootT: 0, phase: 0,
      });
      this.addWanted(car.kind === 'police' ? 2 : 1, car.kind === 'police' ? 'police cruiser stolen' : 'carjacking reported');
    }
    car.driver = false;
    car.parked = false;
    car.ai = 'player';
    p.car = car;
    p.onFoot = false;
    p.upgrades = { armour: false, engine: false, nitro: false };
    this.say(`Driving the ${car.type.name}`, 2);
    if (this.mission.active) this._missionCarEvent(car);
  }
  _exitCar() {
    const p = this.player;
    if (!p.car) return;
    const car = p.car;
    car.ai = car.kind === 'police' ? 'police' : 'traffic';
    car.driver = false;
    car.parked = true;
    p.x = car.x + Math.cos(car.heading) * 2.4;
    p.z = car.z - Math.sin(car.heading) * 2.4;
    p.car = null;
    p.onFoot = true;
    p.speed = 0;
  }
  _nearestCar(maxD) {
    const p = this.player;
    let best = null;
    let bd = maxD * maxD;
    for (const car of this.cars) {
      if (car === p.car) continue;
      const d = dist2(p.x, p.z, car.x, car.z);
      if (d < bd) { bd = d; best = car; }
    }
    return best;
  }

  // ---- traffic ----
  _stepTraffic() {
    for (const car of this.cars) {
      if (car.ai !== 'traffic' && car.ai !== 'courier' && car.ai !== 'target') continue;
      if (car.parked) continue;
      // Turn in progress: rotate toward the new heading.
      if (car.turn) {
        car.turn.t += STEP / 0.45;
        const t = Math.min(1, car.turn.t);
        car.heading = car.turn.from + angDiff(car.turn.to, car.turn.from) * t;
        car.speed = Math.max(4, car.speed * (1 - STEP));
        if (t >= 1) car.turn = null;
      } else {
        car.speed += clamp(car.targetSpeed - car.speed, -8 * STEP, 6 * STEP);
      }
      // Slow for a car ahead.
      for (const o of this.cars) {
        if (o === car || o.parked) continue;
        const dx = o.x - car.x;
        const dz = o.z - car.z;
        const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
        const side = Math.abs(dx * Math.cos(car.heading) - dz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.4) {
          car.speed = Math.max(0, car.speed - 14 * STEP);
        }
      }
      car.x += Math.sin(car.heading) * car.speed * STEP;
      car.z += Math.cos(car.heading) * car.speed * STEP;
      const c = clampCity(car.x, car.z);
      car.x = c.x;
      car.z = c.z;
      if (car.ai === 'courier') this._followRoute(car);
      else this._junctionTurn(car);
      if (car.ai === 'target') this._fleeFromPlayer(car);
    }
  }
  _junctionTurn(car) {
    const alongX = Math.abs(Math.sin(car.heading)) > 0.7;
    const along = alongX ? car.x : car.z;
    const road = alongX ? nearestRoad(car.z) : nearestRoad(car.x);
    // Next perpendicular centreline ahead.
    let next = null;
    for (const c of ROAD_CENTERS) {
      const d = c - along;
      if ((alongX && Math.sin(car.heading) > 0 && d > 0) || (alongX && Math.sin(car.heading) < 0 && d < 0)
        || (!alongX && Math.cos(car.heading) > 0 && d > 0) || (!alongX && Math.cos(car.heading) < 0 && d < 0)) {
        if (next === null || Math.abs(d) < Math.abs(next - along)) next = c;
      }
    }
    if (next === null) return;
    if (Math.abs(along - next) > 1.2) return;
    // At the junction: snap onto it and choose a way.
    if (alongX) car.x = next;
    else car.z = next;
    const r = this.rng.next();
    const left = this.rng.chance(0.5) ? 1 : -1;
    let to = car.heading;
    if (r < 0.55) to = car.heading; // straight
    else if (r < 0.78) to = car.heading + (Math.PI / 2) * left; // turn
    else to = car.heading - (Math.PI / 2) * left;
    if (to !== car.heading) car.turn = { from: car.heading, to, t: 0 };
    // Keep the car on its road after a turn.
    if (alongX) car.z = nearestRoad(car.z);
    else car.x = nearestRoad(car.x);
  }
  _followRoute(car) {
    if (!car.route) return;
    const wp = car.route[car.routeIdx];
    if (!wp) { car.speed = 0; return; }
    const d = Math.hypot(wp.x - car.x, wp.z - car.z);
    if (d < 8) {
      car.routeIdx += 1;
      return;
    }
    const want = Math.atan2(wp.x - car.x, wp.z - car.z);
    car.heading += clamp(angDiff(want, car.heading), -1.6 * STEP, 1.6 * STEP);
    car.speed = 11;
  }
  _fleeFromPlayer(car) {
    const p = this.player;
    const away = Math.atan2(car.x - p.x, car.z - p.z);
    car.heading += clamp(angDiff(away, car.heading), -2.2 * STEP, 2.2 * STEP);
    car.targetSpeed = 24;
  }

  // ---- pedestrians ----
  _stepPeds() {
    for (const ped of this.peds) {
      if (ped.state === 'dead') continue;
      if (ped.state === 'flee') {
        const p = this.player;
        const away = Math.atan2(ped.x - p.x, ped.z - p.z);
        ped.heading = away;
        ped.speed = 4.5;
      } else if (ped.state === 'attack') {
        const p = this.player;
        const d = Math.hypot(p.x - ped.x, p.z - ped.z);
        ped.heading = Math.atan2(p.x - ped.x, p.z - ped.z);
        if (d > 18) {
          ped.speed = 4;
        } else {
          ped.speed = 0;
          ped.shootT -= STEP;
          if (ped.shootT <= 0) {
            ped.shootT = 0.9;
            this._damagePlayer(6, 'shot by Vane\'s crew');
            this.tracers.push({ x1: ped.x, z1: ped.z, x2: p.x, z2: p.z, life: 0.08 });
          }
        }
      } else {
        // Wander: mostly straight, sometimes turn at a junction.
        if (this.rng.chance(0.004)) ped.heading += (this.rng.chance(0.5) ? 1 : -1) * Math.PI / 2;
      }
      ped.x += Math.sin(ped.heading) * ped.speed * STEP;
      ped.z += Math.cos(ped.heading) * ped.speed * STEP;
      const c = clampCity(ped.x, ped.z);
      ped.x = c.x;
      ped.z = c.z;
      ped.phase += STEP * ped.speed * 2;
      if (ped.state === 'flee' && Math.hypot(ped.x - this.player.x, ped.z - this.player.z) > 70) {
        ped.state = 'walk';
        ped.speed = 1.5;
      }
    }
    this.peds = this.peds.filter((ped) => ped.state !== 'dead' || this.time - (ped.deadAt || 0) < 8);
  }

  // ---- police ----
  _stepPolice() {
    const p = this.player;
    const police = this.cars.filter((c) => c.kind === 'police' && !c.parked);
    for (const cop of police) {
      cop.flash = (cop.flash + STEP * 6) % 2;
      if (cop.ai !== 'police') continue;
      // Chase: at each junction, turn toward the player.
      const alongX = Math.abs(Math.sin(cop.heading)) > 0.7;
      const along = alongX ? cop.x : cop.z;
      let next = null;
      for (const c of ROAD_CENTERS) {
        const d = c - along;
        const fwd = alongX ? Math.sin(cop.heading) : Math.cos(cop.heading);
        if ((fwd > 0 && d > 0) || (fwd < 0 && d < 0)) {
          if (next === null || Math.abs(d) < Math.abs(next - along)) next = c;
        }
      }
      if (next !== null && Math.abs(along - next) < 1.4 && !cop.turn) {
        if (alongX) cop.x = next;
        else cop.z = next;
        const dx = p.x - cop.x;
        const dz = p.z - cop.z;
        const want = Math.abs(dx) > Math.abs(dz)
          ? (dx > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (dz > 0 ? 0 : Math.PI);
        if (want !== cop.heading) cop.turn = { from: cop.heading, to: want, t: 0 };
      }
      if (cop.turn) {
        cop.turn.t += STEP / 0.4;
        const t = Math.min(1, cop.turn.t);
        cop.heading = cop.turn.from + angDiff(cop.turn.to, cop.turn.from) * t;
        if (t >= 1) cop.turn = null;
      }
      cop.targetSpeed = Math.min(33, 15 + p.wanted * 4.5);
      cop.speed += clamp(cop.targetSpeed - cop.speed, -10 * STEP, 9 * STEP);
      cop.x += Math.sin(cop.heading) * cop.speed * STEP;
      cop.z += Math.cos(cop.heading) * cop.speed * STEP;
      const c = clampCity(cop.x, cop.z);
      cop.x = c.x;
      cop.z = c.z;
      // Ramming the player — at most one hit per 0.7 s per cruiser.
      if (cop.ramT > 0) cop.ramT -= STEP;
      const d = Math.hypot(p.x - cop.x, p.z - cop.z);
      if (d < 3.4 && cop.ramT <= 0) {
        cop.ramT = 0.7;
        if (p.onFoot) {
          this._damagePlayer(10, 'rammed by SBPD');
          p.bustedTimer += STEP;
        } else if (p.car) {
          p.car.hp -= 6;
          cop.hp -= 3;
          this.fx.push('crash');
          const push = Math.atan2(p.x - cop.x, p.z - cop.z);
          p.car.x += Math.sin(push) * 0.6;
          p.car.z += Math.cos(push) * 0.6;
        }
      } else if (d >= 3.4) {
        p.bustedTimer = Math.max(0, p.bustedTimer - STEP);
      }
    }
    // Spawn / remove to match the wanted level.
    const want = this._policeTarget();
    if (p.wanted > 0) {
      if (police.length < want && this.rng.chance(0.03)) this._spawnPoliceNear();
    } else if (police.length > 0 && this.rng.chance(0.01)) {
      const cop = police[0];
      this.cars = this.cars.filter((c) => c !== cop);
    }
    // Roadblocks at 4+ stars, ahead of the player.
    if (p.wanted >= 4 && this.roadblocks.length === 0) {
      for (const d of [45, 75]) {
        const bx = p.x + Math.cos(p.heading) * d;
        const bz = p.z + Math.sin(p.heading) * d;
        const c = clampCity(bx, bz);
        const block = this._newCar('cruiser', nearestRoad(c.x), nearestRoad(c.z), p.heading + Math.PI / 2, 'police');
        block.parked = true;
        block.speed = 0;
        this.roadblocks.push(block);
      }
      this.say('SBPD dispatch: roadblock ahead!', 4);
    }
    if (p.wanted < 4 && this.roadblocks.length > 0) {
      for (const b of this.roadblocks) this.cars = this.cars.filter((c) => c !== b);
      this.roadblocks = [];
    }
  }
  _updateHeli() {
    const p = this.player;
    const want = p.wanted >= 3;
    if (want && !this.heli.active) {
      this.heli.active = true;
      this.heli.x = p.x;
      this.heli.z = p.z - 30;
      this.say('SBPD dispatch: air support is on you.', 4);
    }
    if (!want && this.heli.active) this.heli.active = false;
    if (this.heli.active) {
      this.heli.x += (p.x - this.heli.x) * 0.5 * STEP;
      this.heli.z += (p.z - this.heli.z) * 0.5 * STEP;
      this.heli.rotor += STEP * 22;
    }
  }
  _stepWanted() {
    const p = this.player;
    if (p.wanted === 0) return;
    const policeNear = this.cars.some((c) => c.kind === 'police' && !c.parked && dist2(p.x, p.z, c.x, c.z) < 45 * 45);
    if (this.time - p.lastCrime > 12 && !policeNear) {
      p.wantedTimer += STEP;
      if (p.wantedTimer > 9) {
        p.wantedTimer = 0;
        p.wanted -= 1;
        if (p.wanted === 0) this.say('You lost them. The heat is off.', 3);
      }
    } else {
      p.wantedTimer = 0;
    }
  }
  _damagePlayer(amount, cause) {
    const p = this.player;
    let rest = amount;
    if (p.armour > 0) {
      const absorbed = Math.min(p.armour, rest * 0.6);
      p.armour -= absorbed;
      rest -= absorbed;
    }
    p.health -= rest;
    if (p.health <= 0) {
      p.health = 0;
      this._wasted(cause);
    }
  }
  _checkBustedWasted() {
    const p = this.player;
    if (p.onFoot && p.bustedTimer > 2 && p.wanted > 0) {
      p.bustedTimer = 0;
      const fine = Math.floor(p.money * 0.15);
      p.money -= fine;
      p.wanted = 0;
      p.x = 40;
      p.z = 40;
      p.health = 100;
      this.fx.push('busted');
      this.showBanner(`BUSTED — SBPD took $${fine}`, 4);
      this.say('You were busted. The fine stings.', 4);
    }
  }
  _wasted(cause) {
    const p = this.player;
    const lost = Math.floor(p.money * 0.2);
    p.money -= lost;
    p.wanted = 0;
    p.health = 100;
    p.armour = 0;
    p.ammo = [Infinity, 60, 120, 16];
    p.mag = [Infinity, 12, 30, 6];
    if (p.car) this._exitCar();
    p.x = -40;
    p.z = -120;
    this.fx.push('busted');
    this.showBanner(`WASTED — ${cause}. Lost $${lost}`, 4);
    if (this.mission.active) this._failMission('You were wasted.');
    if (this.race.active) this.race.active = null;
  }

  // ---- combat ----
  _fireWeapon() {
    const p = this.player;
    if (p.fireT > 0 || p.reloadT > 0) return;
    const w = WEAPONS[p.weapon];
    p.fireT = w.rate;
    if (w.id === 'fists') {
      let best = null;
      let bd = w.range * w.range;
      for (const ped of this.peds) {
        if (ped.state === 'dead') continue;
        const d = dist2(p.x, p.z, ped.x, ped.z);
        if (d < bd) { bd = d; best = ped; }
      }
      if (best) this._hitPed(best, w.damage);
      return;
    }
    if (p.mag[p.weapon] <= 0) {
      this._reload();
      return;
    }
    p.mag[p.weapon] -= 1;
    this.fx.push('shoot');
    // The gun fires where the camera looks.
    const dirX = Math.sin(this.camYaw);
    const dirZ = Math.cos(this.camYaw);
    const ox = p.x;
    const oz = p.z;
    let best = null;
    let bd = w.range;
    let bestKind = null;
    const consider = (x, z, d, kind, ref) => {
      if (d > bd) return;
      const dx = x - ox;
      const dz = z - oz;
      const along = dx * dirX + dz * dirZ;
      if (along < 0) return;
      const side = Math.abs(-dx * dirZ + dz * dirX);
      if (side > 2.5 + along * 0.16) return;
      bd = d;
      best = ref;
      bestKind = kind;
    };
    for (const ped of this.peds) {
      if (ped.state === 'dead') continue;
      consider(ped.x, ped.z, Math.hypot(ped.x - ox, ped.z - oz), 'ped', ped);
    }
    for (const car of this.cars) {
      if (car === p.car) continue;
      consider(car.x, car.z, Math.hypot(car.x - ox, car.z - oz), 'car', car);
    }
    const ex = ox + dirX * (best ? bd : w.range);
    const ez = oz + dirZ * (best ? bd : w.range);
    this.tracers.push({ x1: ox, z1: oz, x2: ex, z2: ez, life: 0.07 });
    if (!best) return;
    if (bestKind === 'ped') this._hitPed(best, w.damage);
    else this._hitCar(best, w.damage);
  }
  _hitPed(ped, dmg) {
    ped.hp -= dmg;
    if (ped.hp <= 0) {
      ped.state = 'dead';
      ped.deadAt = this.time;
      this.player.kills += 1;
      this.player.respect += 5;
      this.addWanted(1, 'shots fired');
      this.say('Down. The Bay noticed.', 2);
    } else if (ped.state === 'walk') {
      ped.state = 'flee';
    }
  }
  _hitCar(car, dmg) {
    car.hp -= dmg;
    if (car.hp <= 0) {
      car.parked = true;
      car.speed = 0;
      car.driver = false;
      this.addWanted(1, 'vehicle destroyed');
    }
  }
  _hitTargetCar(car) {
    if (this.mission.active && car.kind === 'target') {
      car.hp -= 2;
      if (car.hp <= 40 && !car.smoking) {
        car.smoking = true;
        this.say('He is smoking — keep on him!', 3);
      }
    }
  }
  _reload() {
    const p = this.player;
    if (p.reloadT > 0) return;
    const w = WEAPONS[p.weapon];
    if (w.mag === Infinity || p.mag[p.weapon] >= w.mag) return;
    const need = w.mag - p.mag[p.weapon];
    const take = Math.min(need, p.ammo[p.weapon]);
    if (take <= 0) {
      this.say('Out of ammo — find more', 2);
      return;
    }
    p.mag[p.weapon] += take;
    p.ammo[p.weapon] -= take;
    p.reloadT = 0.9;
    this.say('Reloaded', 1.5);
  }

  // ---- collectibles, properties, garage ----
  _stepCollectibles() {
    const p = this.player;
    this.city.collectibles.forEach((c, i) => {
      if (c.taken || p.collected.has(i)) return;
      if (dist2(p.x, p.z, c.x, c.z) < 4) {
        c.taken = true;
        p.collected.add(i);
        p.money += 50;
        p.respect += 10;
        this.fx.push('pickup');
        this.say(`Shell ${p.collected.size} of ${COLLECTIBLE_COUNT} — +$50`, 2);
      }
    });
  }
  _stepInteractions(actions) {
    const p = this.player;
    // Enter / exit a car.
    if (actions & 2) { // ACTION.ENTER
      if (p.onFoot) {
        const car = this._nearestCar(4.5);
        if (car) this._enterCar(car);
      } else {
        this._exitCar();
      }
    }
    if (!p.onFoot) return;
    // Buy a property or save at one you own.
    for (const prop of PROPERTIES) {
      if (dist2(p.x, p.z, prop.x, prop.z) > 30) continue;
      if (!p.properties.has(prop.id)) {
        if (actions & 2 && p.money >= prop.price) {
          p.money -= prop.price;
          p.properties.add(prop.id);
          this.fx.push('pickup');
          this.showBanner(`Bought the ${prop.name} — $${prop.price}`, 3);
          this.say('You own a place in the Bay now. Press Q here to save.', 4);
        }
      }
    }
    // Garage upgrades (drive in, or walk in).
    if (dist2(p.x, p.z, GARAGE.x, GARAGE.z) < 30 && p.car) {
      // handled in the HUD menu; the world only exposes the spot
    }
  }
  buyUpgrade(id) {
    const p = this.player;
    const up = UPGRADES.find((u) => u.id === id);
    if (!up || !p.car) return false;
    if (p.money < up.price) {
      this.say('Not enough cash for that.', 2);
      return false;
    }
    if (id === 'repair') {
      p.car.hp = 100;
    } else if (id === 'respray') {
      p.car.color = CAR_COLORS[this.rng.int(0, CAR_COLORS.length - 1)];
    } else {
      p.upgrades[id] = true;
    }
    p.money -= up.price;
    this.fx.push('pickup');
    this.say(`Installed: ${up.name}`, 2);
    return true;
  }

  // ---- missions ----
  startMission() {
    if (this.mission.active) {
      this.say('A job is already running. Finish it or fail it first.', 3);
      return;
    }
    const def = MISSIONS[this.mission.next];
    if (!def) {
      this.say('That was the last job. The Bay is yours, Kingpin.', 5);
      return;
    }
    this.mission.active = { def, objIdx: 0, data: {}, closeTime: 0, violation: 0 };
    this.talk(def.intro[0], 5);
    for (const line of def.intro.slice(1)) this.say(line, 5);
    this.showBanner(`JOB: ${def.name}`, 3);
    this._setupObjective();
  }
  _setupObjective() {
    const m = this.mission.active;
    if (!m) return;
    const obj = m.def.objectives[m.objIdx];
    if (!obj) return;
    m.data = {};
    if (obj.kind === 'pickup') {
      const ped = {
        x: obj.x, z: obj.z, heading: 0, speed: 0, color: 0xe8b23a,
        state: 'walk', hp: 100, shootT: 0, phase: 0, waiting: true,
      };
      this.peds.push(ped);
      m.data.ped = ped;
    }
    if (obj.kind === 'collect') {
      m.data.gems = [];
      for (let i = 0; i < obj.count; i += 1) {
        m.data.gems.push({
          x: obj.x + this.rng.range(-8, 8), z: obj.z + this.rng.range(-8, 8), taken: false,
        });
      }
    }
    if (obj.kind === 'eliminate') {
      m.data.enemies = [];
      for (let i = 0; i < obj.count; i += 1) m.data.enemies.push(this._spawnEnemy(obj.x, obj.z));
    }
    if (obj.kind === 'chase') {
      const p = this.player;
      const a = this.rng.range(0, TAU);
      const car = this._newCar('comet', p.x + Math.cos(a) * 25, p.z + Math.sin(a) * 25, a, 'target');
      car.color = 0x1a1a1a;
      car.ai = 'target';
      car.speed = 16;
      m.data.car = car;
    }
    if (obj.kind === 'tail') {
      const car = this._newCar('sable', 160, 80, Math.PI, 'target');
      car.color = 0x3a3a3a;
      car.ai = 'courier';
      car.route = [
        { x: 120, z: 80 }, { x: 40, z: 80 }, { x: 0, z: 120 }, { x: -80, z: 160 }, { x: -160, z: 180 },
      ];
      car.routeIdx = 0;
      car.speed = 11;
      m.data.car = car;
    }
    if (obj.kind === 'race') {
      this.race.active = { points: obj.points, idx: 0, timeLeft: obj.timeLimit, mission: true };
    }
    if (m.def.id === 'm4' && obj.kind === 'escape') {
      this.addWanted(2, 'relays went dark — SBPD is hunting you');
    }
  }
  _missionTarget() {
    const m = this.mission.active;
    if (!m) return null;
    const obj = m.def.objectives[m.objIdx];
    if (!obj) return null;
    if (obj.kind === 'chase' || obj.kind === 'tail') return m.data.car || null;
    if (obj.kind === 'collect' && m.data.gems) {
      const g = m.data.gems.find((gem) => !gem.taken);
      return g ? { x: g.x, z: g.z } : { x: obj.x, z: obj.z };
    }
    if (obj.kind === 'race' && this.race.active) {
      const pt = this.race.active.points[this.race.active.idx];
      return pt ? { x: pt[0], z: pt[1] } : null;
    }
    return { x: obj.x, z: obj.z };
  }
  _missionCarEvent(car) {
    const m = this.mission.active;
    if (!m) return;
    const obj = m.def.objectives[m.objIdx];
    if (obj && obj.kind === 'steal' && car.type.id === obj.carType) this._nextObjective();
  }
  _nextObjective() {
    const m = this.mission.active;
    if (!m) return;
    m.objIdx += 1;
    m.closeTime = 0;
    m.violation = 0;
    if (m.objIdx >= m.def.objectives.length) {
      this._completeMission();
      return;
    }
    this._setupObjective();
    this.say(`Next: ${m.def.objectives[m.objIdx].label}`, 3);
  }
  _completeMission() {
    const m = this.mission.active;
    const p = this.player;
    p.money += m.def.reward.money;
    p.respect += m.def.reward.respect;
    p.missionsDone.push(m.def.id);
    this.mission.next += 1;
    this.fx.push('pickup');
    this.showBanner(`JOB DONE — ${m.def.name}  +$${m.def.reward.money}`, 4);
    this.say(`${m.def.name} complete. Respect grows in the Bay.`, 4);
    if (p.passenger) p.passenger = null;
    this.mission.active = null;
  }
  _failMission(why) {
    const m = this.mission.active;
    if (!m) return;
    this.showBanner(`JOB FAILED — ${why}`, 4);
    this.say(`${m.def.name} failed. Press J to try again.`, 4);
    if (m.data.car) {
      this.cars = this.cars.filter((c) => c !== m.data.car);
      m.data.car = null;
    }
    if (m.data.enemies) {
      for (const e of m.data.enemies) e.state = 'dead';
    }
    this.race.active = null;
    this.mission.active = null;
    this.player.passenger = null;
  }
  _stepMission(actions) {
    if (actions & 1) this.startMission(); // ACTION.MISSION
    const m = this.mission.active;
    if (!m) return;
    const obj = m.def.objectives[m.objIdx];
    if (!obj) return;
    const p = this.player;
    const near = (x, z, r) => dist2(p.x, p.z, x, z) < r * r;
    switch (obj.kind) {
      case 'goto':
        if (near(obj.x, obj.z, 12)) this._nextObjective();
        break;
      case 'pickup':
        if (m.data.ped && near(m.data.ped.x, m.data.ped.z, 3.5)) {
          const crew = CREW.find((c) => c.id === m.def.giver);
          p.passenger = crew ? crew.name : 'Dario Voss';
          this.peds = this.peds.filter((ped) => ped !== m.data.ped);
          this.say(`${p.passenger} is riding with you.`, 3);
          this._nextObjective();
        }
        break;
      case 'deliver':
        if (near(obj.x, obj.z, 11)) {
          if (p.passenger) {
            this.say(`${p.passenger}: "Good. That is done."`, 3);
            p.passenger = null;
          }
          this._nextObjective();
        }
        break;
      case 'collect': {
        let done = true;
        for (const g of m.data.gems || []) {
          if (!g.taken && near(g.x, g.z, 3.5)) {
            g.taken = true;
            this.fx.push('pickup');
          }
          if (!g.taken) done = false;
        }
        if (done) this._nextObjective();
        break;
      }
      case 'steal':
        // completed by _missionCarEvent when the player jacks the right car
        break;
      case 'escape':
        if (p.wanted === 0) this._nextObjective();
        break;
      case 'eliminate': {
        const alive = (m.data.enemies || []).filter((e) => e.state !== 'dead').length;
        if (alive === 0) this._nextObjective();
        break;
      }
      case 'chase': {
        const car = m.data.car;
        if (!car) { this._failMission('The target got away.'); break; }
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d < 20) {
          m.closeTime += STEP;
          if (m.closeTime >= obj.seconds) {
            car.ai = 'traffic';
            car.speed = 0;
            car.parked = true;
            // The ledger drops where the car stops; capture it before
            // _nextObjective rebuilds m.data for the next objective.
            const drop = { x: car.x, z: car.z };
            this.say('He is done. Take the ledger.', 3);
            this._nextObjective();
            const nm = this.mission.active;
            if (nm && nm.def.objectives[nm.objIdx] && nm.def.objectives[nm.objIdx].kind === 'collect') {
              nm.data.gems = [{ x: drop.x, z: drop.z, taken: false }];
            }
          }
        }
        break;
      }
      case 'tail': {
        const car = m.data.car;
        if (!car) { this._failMission('The courier vanished.'); break; }
        const d = Math.hypot(p.x - car.x, p.z - car.z);
        if (d >= 10 && d <= 30) {
          m.closeTime += STEP;
          m.violation = 0;
          if (m.closeTime >= obj.seconds) {
            this.say('He led you right to the Docks. Nice tail.', 3);
            this._nextObjective();
          }
        } else {
          m.violation += STEP;
          if (d < 10) this.say('Too close — he will spot you!', 1.5);
          if (d > 30) this.say('Too far — you are losing him!', 1.5);
          if (m.violation > 3) {
            this._failMission(d < 10 ? 'You were spotted.' : 'You lost the courier.');
          }
        }
        break;
      }
      case 'race':
        // The race step handles it; completing it advances the mission.
        if (!this.race.active && m.def.objectives[m.objIdx].kind === 'race') {
          // race finished (set by _stepRace)
          if (this._raceWon) {
            this._raceWon = false;
            this._nextObjective();
          }
        }
        break;
      default:
        break;
    }
  }

  // ---- races ----
  startRace(raceDef) {
    const p = this.player;
    if (p.money < raceDef.entry) {
      this.say('Entry fee is more than you have.', 2);
      return;
    }
    p.money -= raceDef.entry;
    this.race.active = { points: raceDef.points, idx: 0, timeLeft: raceDef.timeLimit, mission: false, def: raceDef };
    this.showBanner(`RACE: ${raceDef.name} — $${raceDef.entry} in`, 3);
  }
  _stepRace() {
    const r = this.race.active;
    if (!r) return;
    const p = this.player;
    r.timeLeft -= STEP;
    if (r.timeLeft <= 0) {
      const wasMission = r.mission;
      this.race.active = null;
      if (wasMission) this._failMission('Out of time.');
      else this.showBanner('RACE OVER — out of time', 3);
      return;
    }
    const pt = r.points[r.idx];
    if (!pt) return;
    if (dist2(p.x, p.z, pt[0], pt[1]) < 12 * 12) {
      r.idx += 1;
      this.fx.push('pickup');
      if (r.idx >= r.points.length) {
        const wasMission = r.mission;
        const def = r.def;
        this.race.active = null;
        if (wasMission) {
          this._raceWon = true;
        } else {
          p.money += def.reward;
          p.respect += 60;
          p.racesDone.push(def.id);
          this.showBanner(`RACE WON — ${def.name}  +$${def.reward}`, 4);
        }
      }
    }
  }

  // ---- attract mode ----
  _stepAttract() {
    if (!this.attractCar) {
      const car = this._newCar('comet', -40, 0, 0, 'traffic');
      car.ai = 'traffic';
      car.speed = 12;
      car.targetSpeed = 12;
      this.attractCar = car;
      this.player.car = car;
      this.player.onFoot = false;
    }
    const p = this.player;
    const car = this.attractCar;
    p.x = car.x;
    p.z = car.z;
    p.heading = car.heading;
    p.speed = Math.abs(car.speed);
  }

  // ---- progress ----
  progress() {
    const p = this.player;
    const got = p.missionsDone.length * 3 + p.racesDone.length + p.collected.size * 0.5 + p.properties.size * 2;
    const total = 8 * 3 + 3 + 40 * 0.5 + 3 * 2;
    return Math.min(100, Math.round((got / total) * 100));
  }
  snapshot() {
    const p = this.player;
    return {
      money: p.money, respect: p.respect, health: p.health, armour: p.armour,
      x: p.x, z: p.z, heading: p.heading,
      missionsDone: [...p.missionsDone], racesDone: [...p.racesDone],
      collected: [...p.collected], properties: [...p.properties],
      missionNext: this.mission.next, clock: this.clock,
      ammo: [...p.ammo], mag: [...p.mag], weapon: p.weapon,
    };
  }
  restore(s) {
    this.reset();
    const p = this.player;
    p.money = s.money;
    p.respect = s.respect;
    p.health = s.health;
    p.armour = s.armour;
    p.x = s.x;
    p.z = s.z;
    p.heading = s.heading;
    p.missionsDone = [...s.missionsDone];
    p.racesDone = [...s.racesDone];
    p.collected = new Set(s.collected);
    p.properties = new Set(s.properties);
    this.mission.next = s.missionNext;
    this.clock = s.clock;
    p.ammo = [...s.ammo];
    p.mag = [...s.mag];
    p.weapon = s.weapon;
    for (const i of p.collected) {
      if (this.city.collectibles[i]) this.city.collectibles[i].taken = true;
    }
  }
}
