// The living world of Soluna Bay: traffic that drives the road graph,
// pedestrians on the sidewalks, the SBPD police response (cars, roadblocks,
// helicopter), the wanted system, and the particle effects. The player and
// the missions live in their own files and talk to this one.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { makeRandom, clamp, angleDiff, angleToward } from './util.js';
import { CITY } from './config.js';
import { collideBuildings, isOnRoad, nearestRoadPoint } from './city.js';

const CAR_COLORS = [
  [0.85, 0.15, 0.12], [0.15, 0.35, 0.85], [0.95, 0.85, 0.25], [0.25, 0.75, 0.3],
  [0.9, 0.5, 0.15], [0.75, 0.75, 0.78], [0.12, 0.12, 0.14], [0.85, 0.85, 0.85],
  [0.6, 0.2, 0.55], [0.2, 0.6, 0.65], [0.95, 0.55, 0.7], [0.35, 0.25, 0.15],
];
const PED_COLORS = [
  [0.9, 0.7, 0.4], [0.5, 0.3, 0.7], [0.3, 0.6, 0.9], [0.9, 0.4, 0.3],
  [0.4, 0.8, 0.5], [0.8, 0.8, 0.85], [0.95, 0.6, 0.2], [0.6, 0.7, 0.3],
];
const CAR_MODELS = [
  { name: 'Calyx Sprint GT', maxSpeed: 38, accel: 16, len: 4.4 },
  { name: 'Meridian GT', maxSpeed: 34, accel: 14, len: 4.6 },
  { name: 'Vireo GT', maxSpeed: 36, accel: 15, len: 4.3 },
  { name: 'Palma Cabrio', maxSpeed: 30, accel: 12, len: 4.2 },
  { name: 'Soluna Van', maxSpeed: 26, accel: 10, len: 5.0 },
  { name: 'Corza Brisa', maxSpeed: 33, accel: 13, len: 4.4 },
];

export function randomCarModel(rng) {
  const model = rng.pick(CAR_MODELS);
  return { ...model, color: rng.pick(CAR_COLORS), paint: rng.pick(CAR_COLORS) };
}

export function createWorld(city) {
  const rng = makeRandom(CITY.seed + 7);
  const world = {
    city,
    time: 0,
    clock: 9 * 3600 + 23 * 60, // 09:23 in the morning
    day: 1,
    night: 0, // 0 = day, 1 = deep night; eases between
    wanted: { stars: 0, heat: 0, unseen: 0, bustedTimer: 0 },
    cars: [],
    peds: [],
    enemies: [],
    heli: null,
    roadblocks: [],
    particles: [],
    events: [],
    player: null,
    trafficTarget: 16,
    pedTarget: 30,
    autopilot: null,
  };

  function emit(type, data) {
    world.events.push({ type, data });
  }

  // ---- Cars ----
  let carId = 0;
  function addCar(kind, x, z, heading, model) {
    const car = {
      id: carId += 1,
      kind, // 'traffic' | 'parked' | 'police' | 'player'
      x, z, heading,
      speed: 0,
      steer: 0,
      model: model || randomCarModel(rng),
      health: 100,
      armour: 0,
      nitro: false,
      driver: kind === 'traffic',
      node: -1,
      nextNode: -1,
      wait: 0,
      stuck: 0,
      unitName: '',
      roadblock: false,
      dead: false,
    };
    world.cars.push(car);
    return car;
  }

  function nearestNode(x, z) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < city.nodes.length; i += 1) {
      const n = city.nodes[i];
      const d = (n.x - x) ** 2 + (n.z - z) ** 2;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  function spawnTrafficCar() {
    const p = world.player;
    if (!p) return;
    // Pick a road point 60-220 m from the player.
    for (let tries = 0; tries < 12; tries += 1) {
      const ang = rng.next() * Math.PI * 2;
      const dist = rng.range(60, 220);
      const x = clamp(p.x + Math.cos(ang) * dist, -370, 370);
      const z = clamp(p.z + Math.sin(ang) * dist, -370, 370);
      if (!isOnRoad(x, z)) continue;
      const near = nearestRoadPoint(x, z);
      const node = nearestNode(near.x, near.z);
      if (node < 0) continue;
      const car = addCar('traffic', near.x, near.z, rng.next() * Math.PI * 2, null);
      car.node = node;
      car.nextNode = city.adjacency[node][Math.floor(rng.next() * city.adjacency[node].length)] ?? node;
      car.speed = rng.range(8, 13);
      return;
    }
  }

  function spawnParkedCars() {
    // A handful of stealable parked cars along the streets near the start.
    const spots = [
      { x: -140 + 8, z: 210, h: 0 }, { x: 70 - 8, z: -70, h: Math.PI },
      { x: 0, z: 140 + 8, h: Math.PI / 2 }, { x: -70, z: -140 - 8, h: -Math.PI / 2 },
      { x: 210 - 8, z: 70, h: 0 }, { x: -210, z: 280 + 8, h: Math.PI / 2 },
      { x: 140 + 8, z: -210, h: Math.PI }, { x: 280, z: 210 - 8, h: -Math.PI / 2 },
      { x: -35, z: 350 - 8, h: 0 }, { x: 105, z: 245 + 8, h: Math.PI / 2 },
    ];
    for (const s of spots) {
      const car = addCar('parked', s.x, s.z, s.h, null);
      car.driver = false;
    }
  }

  // ---- Pedestrians ----
  function spawnPed() {
    const p = world.player;
    if (!p) return;
    for (let tries = 0; tries < 10; tries += 1) {
      const ang = rng.next() * Math.PI * 2;
      const dist = rng.range(25, 170);
      const x = clamp(p.x + Math.cos(ang) * dist, -370, 370);
      const z = clamp(p.z + Math.sin(ang) * dist, -370, 370);
      const near = nearestRoadPoint(x, z);
      if (!near) continue;
      // Stand on the sidewalk next to the road.
      const side = rng.chance(0.5) ? 1 : -1;
      const alongStreet = Math.abs(x - near.x) < Math.abs(z - near.z);
      const px = alongStreet ? near.x + side * 8 : x;
      const pz = alongStreet ? z : near.z + side * 8;
      world.peds.push({
        x: px, z: pz,
        heading: rng.next() * Math.PI * 2,
        speed: rng.range(0.9, 1.5),
        color: rng.pick(PED_COLORS),
        shirt: rng.pick(PED_COLORS),
        state: 'walk',
        stateT: rng.range(2, 8),
        fleeX: 0, fleeZ: 0,
        walkPhase: rng.next() * Math.PI * 2,
      });
      return;
    }
  }

  // ---- Police ----
  function policeTargetCount() {
    return [0, 2, 3, 4, 5, 6][world.wanted.stars];
  }

  function spawnPoliceCar() {
    const p = world.player;
    if (!p) return null;
    for (let tries = 0; tries < 10; tries += 1) {
      const ang = rng.next() * Math.PI * 2;
      const dist = rng.range(70, 150);
      const x = clamp(p.x + Math.cos(ang) * dist, -370, 370);
      const z = clamp(p.z + Math.sin(ang) * dist, -370, 370);
      if (!isOnRoad(x, z)) continue;
      const near = nearestRoadPoint(x, z);
      const car = addCar('police', near.x, near.z, Math.atan2(p.x - near.x, p.z - near.z), {
        name: 'SBPD Interceptor', maxSpeed: 40, accel: 18, len: 4.6,
        color: [0.08, 0.1, 0.14], paint: [0.9, 0.92, 0.95],
      });
      car.unitName = `SBPD ${['Mako', 'Heron', 'Gull', 'Tern', 'Osprey', 'Bastion'][world.cars.filter((c) => c.kind === 'police').length % 6]}-${car.id}`;
      return car;
    }
    return null;
  }

  function spawnRoadblock() {
    const p = world.player;
    if (!p || !p.car) return;
    // Two police cars parked across the road ahead of the player's car.
    const h = p.car.heading;
    const fx = Math.sin(h);
    const fz = Math.cos(h);
    const ahead = 55;
    const cx = p.car.x + fx * ahead;
    const cz = p.car.z + fz * ahead;
    for (const side of [-1, 1]) {
      const car = addCar('police', cx - fz * side * 3, cz + fx * side * 3, h + Math.PI / 2, {
        name: 'SBPD Interceptor', maxSpeed: 0, accel: 0, len: 4.6,
        color: [0.08, 0.1, 0.14], paint: [0.9, 0.92, 0.95],
      });
      car.roadblock = true;
      car.unitName = `Roadblock ${side < 0 ? 'A' : 'B'}`;
      world.roadblocks.push(car);
    }
    emit('roadblock', { x: cx, z: cz });
  }

  function ensureHeli() {
    if (world.wanted.stars >= 3 && !world.heli) {
      const p = world.player;
      world.heli = {
        x: p.x + 60, y: 55, z: p.z - 60,
        heading: 0, rotor: 0, searchX: p.x, searchZ: p.z,
      };
      emit('heli', {});
    } else if (world.wanted.stars < 3 && world.heli) {
      world.heli = null;
    }
  }

  // ---- Particles ----
  function spawnParticles(x, y, z, opts) {
    const n = opts.count || 12;
    for (let i = 0; i < n; i += 1) {
      if (world.particles.length > 420) return;
      const a = rng.next() * Math.PI * 2;
      const sp = rng.range(0.3, 1) * (opts.speed || 6);
      world.particles.push({
        x, y, z,
        vx: Math.cos(a) * sp + (opts.vx || 0),
        vy: rng.range(0.2, 1) * (opts.up || 4),
        vz: Math.sin(a) * sp + (opts.vz || 0),
        life: 0,
        ttl: rng.range(0.4, 1) * (opts.ttl || 0.8),
        size: rng.range(0.5, 1) * (opts.size || 0.5),
        color: opts.color || [1, 0.6, 0.15],
        grav: opts.grav ?? -9,
      });
    }
  }

  function explosion(x, y, z) {
    spawnParticles(x, y + 0.5, z, { count: 42, speed: 10, up: 8, size: 1.1, ttl: 1.1, color: [1, 0.55, 0.1] });
    spawnParticles(x, y + 0.5, z, { count: 22, speed: 5, up: 6, size: 1.6, ttl: 1.6, color: [0.25, 0.22, 0.2], grav: -2 });
    emit('explosion', { x, z });
  }

  // ---- Wanted ----
  function addWanted(stars, reason) {
    const w = world.wanted;
    const before = w.stars;
    w.stars = clamp(w.stars + stars, 0, 5);
    w.heat = 1;
    w.unseen = 0;
    if (w.stars > before) {
      emit('wanted', { stars: w.stars, reason });
    }
  }

  function updateWanted(dt) {
    const w = world.wanted;
    const p = world.player;
    if (!p) return;
    const cops = world.cars.filter((c) => c.kind === 'police' && !c.dead);
    let seen = false;
    for (const c of cops) {
      const d = Math.hypot(c.x - p.x, c.z - p.z);
      if (d < 70) { seen = true; break; }
    }
    if (world.heli) {
      const d = Math.hypot(world.heli.x - p.x, world.heli.z - p.z);
      if (d < 90) seen = true;
    }
    if (w.stars > 0) {
      if (seen) {
        w.unseen = 0;
        w.heat = Math.min(1, w.heat + dt * 0.2);
      } else {
        w.unseen += dt;
        if (w.unseen > 10) {
          w.heat = Math.max(0, w.heat - dt * 0.12);
          if (w.heat <= 0 && w.unseen > 16) {
            w.stars -= 1;
            w.unseen = 0;
            w.heat = 0.4;
            emit('wanted', { stars: w.stars, reason: 'cooling off' });
          }
        }
      }
    }
    // Busted: on foot, a cop car sits on top of a slow player.
    if (w.stars > 0 && !p.car) {
      for (const c of cops) {
        const d = Math.hypot(c.x - p.x, c.z - p.z);
        if (d < 3.5 && p.speed < 1.5) {
          w.bustedTimer += dt;
          if (w.bustedTimer > 2) {
            w.bustedTimer = 0;
            emit('busted', {});
          }
          break;
        }
      }
    } else {
      w.bustedTimer = 0;
    }
    // Keep the police count matched to the wanted level.
    const target = policeTargetCount();
    const active = cops.filter((c) => !c.roadblock).length;
    if (active < target && Math.random() < dt * 0.8) spawnPoliceCar();
    if (w.stars >= 3 && world.roadblocks.length === 0 && p.car && Math.random() < dt * 0.15) spawnRoadblock();
    if (w.stars < 3) {
      for (const rb of world.roadblocks) rb.dead = true;
      world.roadblocks = [];
    }
    ensureHeli();
  }

  // ---- Traffic update ----
  function updateTraffic(dt) {
    const p = world.player;
    for (const car of world.cars) {
      if (car.kind !== 'traffic' || car.dead) continue;
      if (car.wait > 0) {
        car.wait -= dt;
        car.speed = Math.max(0, car.speed - 20 * dt);
        continue;
      }
      const node = city.nodes[car.nextNode];
      if (!node) continue;
      // Lane offset: right-hand side of the direction of travel.
      let dx = node.x - car.x;
      let dz = node.z - car.z;
      const dist = Math.hypot(dx, dz);
      dx /= dist || 1;
      dz /= dist || 1;
      const tx = node.x - dz * 3;
      const tz = node.z + dx * 3;
      const wantHeading = Math.atan2(tx - car.x, tz - car.z);
      car.heading = angleToward(car.heading, wantHeading, 2.4 * dt);
      // Brake if something is right ahead.
      let blocked = false;
      for (const other of world.cars) {
        if (other === car || other.dead) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 11 && side < 3.2) { blocked = true; break; }
      }
      if (!blocked && p) {
        const ox = p.x - car.x;
        const oz = p.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 9 && side < 2.6) blocked = true;
      }
      const targetSpeed = blocked ? 0 : 11;
      if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + 8 * dt);
      else car.speed = Math.max(targetSpeed, car.speed - 12 * dt);
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      if (dist < 9) {
        const options = city.adjacency[car.nextNode].filter((n) => n !== car.node);
        if (options.length === 0) {
          car.node = car.nextNode;
          car.nextNode = city.adjacency[car.node][0];
        } else {
          car.node = car.nextNode;
          car.nextNode = options[Math.floor(rng.next() * options.length)];
        }
        if (rng.chance(0.12)) car.wait = rng.range(0.8, 2.2);
      }
      // Keep traffic near the player: respawn far cars.
      if (p && Math.hypot(car.x - p.x, car.z - p.z) > 260) {
        car.dead = true;
      }
    }
    world.cars = world.cars.filter((c) => !c.dead || c.kind === 'player');
    const trafficCount = world.cars.filter((c) => c.kind === 'traffic').length;
    for (let i = trafficCount; i < world.trafficTarget; i += 1) spawnTrafficCar();
  }

  // ---- Police chase update ----
  function updatePolice(dt) {
    const p = world.player;
    if (!p) return;
    for (const car of world.cars) {
      if (car.kind !== 'police' || car.dead || car.roadblock) continue;
      const dx = p.x - car.x;
      const dz = p.z - car.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      const steer = clamp(angleDiff(car.heading, wantHeading) * 1.6, -1, 1);
      const targetSpeed = dist > 120 ? car.model.maxSpeed : car.model.maxSpeed * 0.92;
      if (car.speed < targetSpeed) car.speed = Math.min(targetSpeed, car.speed + car.model.accel * dt);
      else car.speed = Math.max(targetSpeed, car.speed - 20 * dt);
      car.heading += steer * clamp(car.speed / 12, 0, 1) * 1.9 * dt;
      car.x += Math.sin(car.heading) * car.speed * dt;
      car.z += Math.cos(car.heading) * car.speed * dt;
      // Ram the player: touch the player's car or the player on foot.
      const target = p.car || p;
      const td = Math.hypot(car.x - target.x, car.z - target.z);
      if (td < 3.4) {
        if (p.car) {
          p.car.health -= 14 * dt * 4;
          p.car.speed *= 0.94;
          emit('ram', { x: car.x, z: car.z });
        } else {
          p.health -= 26 * dt;
          emit('ram', { x: car.x, z: car.z });
        }
      }
      if (dist > 320) car.dead = true;
    }
    world.cars = world.cars.filter((c) => !c.dead || c.kind === 'player');
    // Helicopter follows from above.
    if (world.heli) {
      const h = world.heli;
      h.rotor += dt * 22;
      const dx = p.x - h.x;
      const dz = p.z - h.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      h.heading = angleToward(h.heading, want, 1.2 * dt);
      const speed = dist > 30 ? 16 : 8;
      h.x += Math.sin(h.heading) * speed * dt;
      h.z += Math.cos(h.heading) * speed * dt;
      h.y = 52 + Math.sin(world.time * 0.7) * 3;
      h.searchX = p.x;
      h.searchZ = p.z;
    }
  }

  // ---- Pedestrian update ----
  function updatePeds(dt) {
    const p = world.player;
    for (const ped of world.peds) {
      ped.walkPhase += dt * (ped.speed * 2.4);
      if (ped.state === 'flee') {
        ped.stateT -= dt;
        ped.x += Math.sin(ped.heading) * 3.6 * dt;
        ped.z += Math.cos(ped.heading) * 3.6 * dt;
        if (ped.stateT <= 0) ped.state = 'walk';
      } else {
        ped.stateT -= dt;
        ped.x += Math.sin(ped.heading) * ped.speed * dt;
        ped.z += Math.cos(ped.heading) * ped.speed * dt;
        if (ped.stateT <= 0) {
          // Turn at random: keep walking the sidewalks.
          const turn = rng.pick([-Math.PI / 2, Math.PI / 2, 0, Math.PI]);
          ped.heading += turn;
          ped.stateT = rng.range(3, 9);
          const near = nearestRoadPoint(ped.x, ped.z);
          if (near) {
            ped.x = near.x + (rng.chance(0.5) ? 8 : -8);
            ped.z = near.z;
          }
        }
      }
      [ped.x, ped.z] = collideBuildings(city.buildings, ped.x, ped.z, 0.5);
      ped.x = clamp(ped.x, -380, 380);
      ped.z = clamp(ped.z, -380, 380);
      // Flee gunfire or a speeding car.
      if (p && ped.state !== 'flee') {
        const d = Math.hypot(ped.x - p.x, ped.z - p.z);
        const danger = (p.firingRecently && d < 26) || (p.car && p.car.speed > 8 && d < 7);
        if (danger) {
          ped.state = 'flee';
          ped.stateT = rng.range(2, 4);
          ped.heading = Math.atan2(ped.x - p.x, ped.z - p.z);
          ped.speed = rng.range(1.2, 1.8);
        }
      }
    }
    // Keep pedestrians near the player.
    world.peds = world.peds.filter((ped) => !p || Math.hypot(ped.x - p.x, ped.z - p.z) < 220);
    for (let i = world.peds.length; i < world.pedTarget; i += 1) spawnPed();
  }

  // ---- Car-vs-car and car-vs-building collisions ----
  function collideCars(dt) {
    const cars = world.cars.filter((c) => !c.dead);
    for (let i = 0; i < cars.length; i += 1) {
      const a = cars[i];
      for (let j = i + 1; j < cars.length; j += 1) {
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = 3.4;
        if (d > 0.01 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const nz = dz / d;
          a.x -= nx * push;
          a.z -= nz * push;
          b.x += nx * push;
          b.z += nz * push;
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 4) {
            // Armour (garage upgrade) absorbs half the collision damage.
            a.health -= impact * 0.9 * (a.armour > 0 ? 0.5 : 1);
            b.health -= impact * 0.9 * (b.armour > 0 ? 0.5 : 1);
            spawnParticles((a.x + b.x) / 2, 0.8, (a.z + b.z) / 2, { count: 8, speed: 4, size: 0.3, color: [1, 0.8, 0.3], ttl: 0.5 });
            if ((a.kind === 'player' || b.kind === 'player') && impact > 9) emit('crash', {});
          }
          a.speed *= 0.86;
          b.speed *= 0.86;
        }
      }
      // Buildings.
      const before = [a.x, a.z];
      [a.x, a.z] = collideBuildings(city.buildings, a.x, a.z, 1.7);
      if ((a.x !== before[0] || a.z !== before[1]) && Math.abs(a.speed) > 6) {
        a.health -= Math.abs(a.speed) * 0.7 * (a.armour > 0 ? 0.5 : 1);
        a.speed *= 0.45;
        if (a.kind === 'player') emit('crash', {});
        spawnParticles(a.x, 0.8, a.z, { count: 6, speed: 3, size: 0.3, color: [1, 0.8, 0.3], ttl: 0.4 });
      }
      a.x = clamp(a.x, -380, 380);
      a.z = clamp(a.z, -380, 380);
      if (a.health <= 0 && !a.dead) {
        a.dead = true;
        explosion(a.x, 0, a.z);
        if (a.kind === 'player') emit('carDestroyed', { x: a.x, z: a.z });
      }
    }
    world.cars = world.cars.filter((c) => !c.dead || c.kind === 'player');
  }

  // ---- Enemies (mission shooters) ----
  function spawnEnemy(x, z, opts = {}) {
    const enemy = {
      x, z,
      heading: rng.next() * Math.PI * 2,
      health: opts.health || 60,
      speed: rng.range(2.2, 3.2),
      color: opts.color || [0.2, 0.2, 0.22],
      shirt: opts.shirt || [0.7, 0.15, 0.15],
      state: 'hunt',
      shootT: rng.range(0.5, 1.5),
      strafe: rng.chance(0.5) ? 1 : -1,
      strafeT: 2,
      dead: false,
      reward: opts.reward || 120,
    };
    world.enemies.push(enemy);
    return enemy;
  }

  function updateEnemies(dt) {
    const p = world.player;
    if (!p) return;
    for (const e of world.enemies) {
      if (e.dead) continue;
      const dx = p.x - e.x;
      const dz = p.z - e.z;
      const dist = Math.hypot(dx, dz);
      e.heading = Math.atan2(dx, dz);
      // Keep a shooting distance, strafe sideways.
      e.strafeT -= dt;
      if (e.strafeT <= 0) {
        e.strafe *= -1;
        e.strafeT = rng.range(1.5, 3);
      }
      const wantDist = 16;
      const toward = dist > wantDist + 3 ? 1 : dist < wantDist - 3 ? -0.6 : 0;
      e.x += (Math.sin(e.heading) * toward + Math.cos(e.heading) * e.strafe * 0.5) * e.speed * dt;
      e.z += (Math.cos(e.heading) * toward - Math.sin(e.heading) * e.strafe * 0.5) * e.speed * dt;
      [e.x, e.z] = collideBuildings(city.buildings, e.x, e.z, 0.5);
      e.shootT -= dt;
      if (e.shootT <= 0 && dist < 34) {
        e.shootT = rng.range(0.9, 1.7);
        const hitChance = clamp(0.34 - dist * 0.006, 0.08, 0.34);
        if (rng.next() < hitChance) {
          if (p.car) p.car.health -= 4;
          else if (p.armour > 0) { p.armour -= 8; p.health -= 4; }
          else p.health -= 11;
          emit('playerHit', { from: 'enemy' });
        }
        spawnParticles(e.x + Math.sin(e.heading) * 0.9, 1.35, e.z + Math.cos(e.heading) * 0.9,
          { count: 3, speed: 2, size: 0.35, color: [1, 0.85, 0.3], ttl: 0.15, grav: 0 });
        emit('enemyShot', { x: e.x, z: e.z });
      }
      if (e.health <= 0) {
        e.dead = true;
        spawnParticles(e.x, 1, e.z, { count: 14, speed: 3, size: 0.4, color: [0.7, 0.1, 0.1], ttl: 0.7 });
        emit('enemyDown', { x: e.x, z: e.z, reward: e.reward });
      }
    }
    world.enemies = world.enemies.filter((e) => !e.dead);
  }

  function updateParticles(dt) {
    for (const pt of world.particles) {
      pt.life += dt;
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.z += pt.vz * dt;
      if (pt.y < 0.05) {
        pt.y = 0.05;
        pt.vy *= -0.3;
        pt.vx *= 0.7;
        pt.vz *= 0.7;
      }
    }
    world.particles = world.particles.filter((pt) => pt.life < pt.ttl);
  }

  function updateClock(dt) {
    world.time += dt;
    world.clock += dt * 60; // 1 real second = 1 game minute
    if (world.clock >= 24 * 3600) {
      world.clock -= 24 * 3600;
      world.day += 1;
    }
    const hour = world.clock / 3600;
    // Night from 20:00 to 06:00; dusk/dawn blend over an hour.
    let night = 0;
    if (hour >= 20 || hour < 6) night = 1;
    else if (hour >= 19) night = (hour - 19) / 1;
    else if (hour < 7) night = 1 - (hour - 6) / 1;
    world.night = night;
  }

  // ---- Public API ----
  spawnParkedCars();

  return {
    world,
    addCar,
    spawnTrafficCar,
    spawnPoliceCar,
    spawnEnemy,
    spawnParticles,
    explosion,
    addWanted,
    emit,
    update(dt) {
      updateClock(dt);
      updateTraffic(dt);
      updatePolice(dt);
      updatePeds(dt);
      updateEnemies(dt);
      updateWanted(dt);
      collideCars(dt);
      updateParticles(dt);
    },
  };
}
