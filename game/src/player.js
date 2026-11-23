// The player: Kai Maro, on foot and behind the wheel. On foot he walks and
// runs, aims with the mouse and shoots; in a car he drives with arcade
// physics, steals parked and driven cars, and takes damage through the car.
// Combat is a simple hitscan: a shot travels toward the crosshair, hits the
// first enemy, pedestrian or car in its path, and kicks up a tracer.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { clamp, angleDiff, angleToward } from './util.js';
import { PLAYER, WEAPONS } from './config.js';
import { collideBuildings, isOnRoad } from './city.js';

export function createPlayer(worldApi, city) {
  const world = worldApi.world;
  const player = {
    x: 300, z: -120,
    y: 0,
    heading: Math.PI,
    camYaw: Math.PI,
    camPitch: 0.32,
    speed: 0,
    health: PLAYER.maxHealth,
    armour: 0,
    money: 250,
    respect: 0,
    rank: 'Nobody',
    car: null,
    weaponIndex: 0,
    weapons: WEAPONS.map((w) => ({
      ...w,
      magAmmo: w.mag === Infinity ? Infinity : w.mag,
      reserve: w.ammo === Infinity ? Infinity : w.ammo,
    })),
    firingRecently: 0,
    shootCooldown: 0,
    reloadT: 0,
    muzzleT: 0,
    hurtT: 0,
    dead: false,
    lastSafeX: 300,
    lastSafeZ: -120,
  };
  world.player = player;

  const RANKS = [
    [0, 'Nobody'], [150, 'Runner'], [400, 'Driver'], [800, 'Hustler'],
    [1500, 'Shot Caller'], [2600, 'Crew Boss'], [4200, 'King of the Bay'],
  ];

  function updateRank() {
    let rank = RANKS[0][1];
    for (const [need, name] of RANKS) {
      if (player.respect >= need) rank = name;
    }
    player.rank = rank;
  }

  function addRespect(amount) {
    player.respect += amount;
    updateRank();
  }

  function currentWeapon() {
    return player.weapons[player.weaponIndex];
  }

  function cycleWeapon() {
    player.weaponIndex = (player.weaponIndex + 1) % player.weapons.length;
    player.reloadT = 0;
  }

  function reload() {
    const w = currentWeapon();
    if (w.mag === Infinity || player.reloadT > 0) return;
    if (w.magAmmo === w.mag || w.reserve === 0) return;
    player.reloadT = 1.1;
  }

  function finishReload() {
    const w = currentWeapon();
    const need = w.mag - w.magAmmo;
    const take = Math.min(need, w.reserve);
    w.magAmmo += take;
    w.reserve -= take;
  }

  /** The aim direction on foot: from the camera yaw and pitch. */
  function aimDirection() {
    return {
      x: Math.sin(player.camYaw) * Math.cos(player.camPitch),
      y: -Math.sin(player.camPitch),
      z: Math.cos(player.camYaw) * Math.cos(player.camPitch),
    };
  }

  /** Raycast a shot; returns the first thing hit, or null. */
  function raycast(origin, dir, maxDist) {
    let best = null;
    let bestT = maxDist;
    function testPoint(px, pz, radius, kind, ref) {
      const ox = px - origin.x;
      const oz = pz - origin.z;
      const along = ox * dir.x + oz * dir.z;
      if (along < 0 || along > bestT) return;
      const perp = Math.abs(ox * dir.z - oz * dir.x);
      if (perp > radius + 0.3) return;
      const t = along - Math.sqrt(Math.max(0, (radius + 0.3) ** 2 - perp * perp));
      if (t < bestT) {
        bestT = t;
        best = { kind, ref, t, x: origin.x + dir.x * t, z: origin.z + dir.z * t };
      }
    }
    for (const e of world.enemies) {
      if (!e.dead) testPoint(e.x, e.z, 0.7, 'enemy', e);
    }
    for (const ped of world.peds) {
      testPoint(ped.x, ped.z, 0.5, 'ped', ped);
    }
    for (const car of world.cars) {
      if (car.dead || car === player.car) continue;
      testPoint(car.x, car.z, 2.2, 'car', car);
    }
    // Buildings stop bullets: march along the ray in 1.5 m steps.
    for (let t = 0; t < bestT; t += 1.5) {
      const x = origin.x + dir.x * t;
      const z = origin.z + dir.z * t;
      for (const b of city.buildings) {
        if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) {
          if (t < bestT) {
            bestT = t;
            best = { kind: 'wall', ref: null, t, x, z };
          }
          break;
        }
      }
      if (best && best.kind === 'wall') break;
    }
    return best;
  }

  function shoot(audio) {
    const w = currentWeapon();
    if (player.reloadT > 0 || player.shootCooldown > 0) return;
    if (w.mag !== Infinity && w.magAmmo <= 0) {
      reload();
      return;
    }
    player.shootCooldown = w.rate;
    player.muzzleT = 0.07;
    player.firingRecently = 1.2;
    if (w.mag !== Infinity) w.magAmmo -= 1;
    const origin = { x: player.x, y: 1.45, z: player.z };
    const dir = aimDirection();
    const pellets = w.pellets || 1;
    let hitAny = false;
    for (let i = 0; i < pellets; i += 1) {
      const spread = w.spread;
      const dx = dir.x + (Math.random() - 0.5) * spread * 2;
      const dy = dir.y + (Math.random() - 0.5) * spread * 2;
      const dz = dir.z + (Math.random() - 0.5) * spread * 2;
      const len = Math.hypot(dx, dy, dz) || 1;
      const hit = raycast(origin, { x: dx / len, y: dy / len, z: dz / len }, w.range);
      const endX = hit ? hit.x : origin.x + (dx / len) * w.range;
      const endZ = hit ? hit.z : origin.z + (dz / len) * w.range;
      worldApi.spawnParticles(
        origin.x + dir.x * 0.9, 1.45, origin.z + dir.z * 0.9,
        { count: 2, speed: 1, size: 0.3, color: [1, 0.85, 0.3], ttl: 0.12, grav: 0 },
      );
      void endX;
      void endZ;
      if (hit) {
        hitAny = true;
        if (hit.kind === 'enemy') {
          hit.ref.health -= w.damage;
          worldApi.spawnParticles(hit.x, 1.1, hit.z, { count: 8, speed: 3, size: 0.35, color: [0.75, 0.1, 0.1], ttl: 0.5 });
        } else if (hit.kind === 'ped') {
          world.peds = world.peds.filter((p) => p !== hit.ref);
          worldApi.spawnParticles(hit.x, 1.1, hit.z, { count: 10, speed: 3, size: 0.35, color: [0.75, 0.1, 0.1], ttl: 0.6 });
          worldApi.addWanted(1, 'pedestrian down');
        } else if (hit.kind === 'car') {
          hit.ref.health -= w.damage * 0.7;
          worldApi.spawnParticles(hit.x, 0.9, hit.z, { count: 6, speed: 3, size: 0.3, color: [1, 0.8, 0.3], ttl: 0.4 });
          if (hit.ref.kind === 'police') worldApi.addWanted(1, 'shot at police');
        } else {
          worldApi.spawnParticles(hit.x, 1.2, hit.z, { count: 4, speed: 2, size: 0.25, color: [0.8, 0.75, 0.65], ttl: 0.3 });
        }
      }
    }
    if (audio) audio.gunshot();
    if (hitAny && world.wanted.stars === 0 && Math.random() < 0.5) {
      // A witness calls it in.
      worldApi.addWanted(1, 'shots fired');
    }
  }

  function nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of world.cars) {
      if (car.dead) continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function enterCar(car) {
    player.car = car;
    car.kind = 'player';
    car.driver = true;
    player.speed = 0;
    return true;
  }

  function exitCar() {
    if (!player.car) return;
    const car = player.car;
    car.kind = car.model.name === 'SBPD Interceptor' ? 'police' : 'parked';
    car.driver = false;
    // Step out to the side of the car.
    const side = Math.cos(car.heading);
    const sideZ = -Math.sin(car.heading);
    player.x = car.x + side * 2.2;
    player.z = car.z + sideZ * 2.2;
    [player.x, player.z] = collideBuildings(city.buildings, player.x, player.z, 0.6);
    player.heading = car.heading;
    player.camYaw = car.heading;
    player.car = null;
  }

  function stealCar(car) {
    const wasDriven = car.kind === 'traffic' || car.driver;
    const wasPolice = car.kind === 'police';
    enterCar(car);
    if (wasPolice) worldApi.addWanted(2, 'stole a police car');
    else if (wasDriven) worldApi.addWanted(1, 'carjacking');
    return { wasDriven, wasPolice };
  }

  // ---- Per-frame updates ----
  function updateOnFoot(dt, move, mouse, firing, audio) {
    player.camYaw -= mouse.dx * 0.0032;
    player.camPitch = clamp(player.camPitch + mouse.dy * 0.0024, -0.5, 0.7);
    const forward = { x: Math.sin(player.camYaw), z: Math.cos(player.camYaw) };
    const right = { x: Math.cos(player.camYaw), z: -Math.sin(player.camYaw) };
    let mx = 0;
    let mz = 0;
    if (move.forward) { mx += forward.x; mz += forward.z; }
    if (move.back) { mx -= forward.x; mz -= forward.z; }
    if (move.right) { mx += right.x; mz += right.z; }
    if (move.left) { mx -= right.x; mz -= right.z; }
    const len = Math.hypot(mx, mz);
    const speed = move.run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (len > 0) {
      mx /= len;
      mz /= len;
      player.heading = Math.atan2(mx, mz);
      player.x += mx * speed * dt;
      player.z += mz * speed * dt;
      player.speed = speed;
    } else {
      player.speed = 0;
    }
    [player.x, player.z] = collideBuildings(city.buildings, player.x, player.z, PLAYER.radius);
    player.x = clamp(player.x, -380, 380);
    player.z = clamp(player.z, -380, 380);
    if (firing) shoot(audio);
    // Pick up sun shells.
    for (const shell of city.collectibles) {
      if (!shell.taken && Math.hypot(shell.x - player.x, shell.z - player.z) < 1.6) {
        shell.taken = true;
        player.money += 250;
        addRespect(6);
        worldApi.emit('collectible', { count: city.collectibles.filter((s) => s.taken).length });
        if (audio) audio.blip(1180);
      }
    }
  }

  function updateDriving(dt, move, audio) {
    const car = player.car;
    if (!car) return;
    const model = car.model;
    const maxForward = model.maxSpeed * (car.nitro ? 1.35 : 1);
    const maxReverse = 9;
    if (move.forward) car.speed += model.accel * dt;
    if (move.back) {
      if (car.speed > 0.5) car.speed -= 26 * dt;
      else car.speed -= model.accel * 0.6 * dt;
    }
    if (move.brake) car.speed -= 34 * dt;
    if (!move.forward && !move.back) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    }
    car.speed = clamp(car.speed, -maxReverse, maxForward);
    const steerTarget = (move.left ? -1 : 0) + (move.right ? 1 : 0);
    const steerMax = 0.55 * (1 - Math.min(1, Math.abs(car.speed) / maxForward) * 0.55);
    car.steer += (steerTarget * steerMax - car.steer) * Math.min(1, dt * 9);
    const yawRate = car.steer * clamp(Math.abs(car.speed) / 8, 0, 1) * (car.speed >= 0 ? 1 : -1);
    car.heading += yawRate * 1.75 * dt * (move.brake ? 1.5 : 1);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    player.speed = Math.abs(car.speed);
    // Exhaust smoke when the car is badly hurt.
    if (car.health < 35 && Math.random() < dt * 8) {
      worldApi.spawnParticles(car.x, 1, car.z, { count: 1, speed: 0.5, up: 2.5, size: 0.9, color: [0.15, 0.14, 0.14], ttl: 1.4, grav: 1 });
    }
    if (audio) audio.setEngine(Math.abs(car.speed) / maxForward, true);
  }

  function update(dt, move, mouse, actions, firing, audio) {
    player.firingRecently = Math.max(0, player.firingRecently - dt);
    player.shootCooldown = Math.max(0, player.shootCooldown - dt);
    player.muzzleT = Math.max(0, player.muzzleT - dt);
    player.hurtT = Math.max(0, player.hurtT - dt);
    if (player.reloadT > 0) {
      player.reloadT -= dt;
      if (player.reloadT <= 0) finishReload();
    }
    // Slow health regen out of combat.
    if (player.firingRecently <= 0 && player.health > 0 && player.health < PLAYER.maxHealth) {
      player.health = Math.min(PLAYER.maxHealth, player.health + 2.2 * dt);
    }
    if (player.car) {
      updateDriving(dt, move, audio);
      if (actions.enter) exitCar();
    } else {
      updateOnFoot(dt, move, mouse, firing, audio);
      if (actions.enter || actions.steal) {
        const car = nearestCar(4.2);
        if (car) {
          if (car.kind === 'parked' || car.kind === 'player') {
            if (actions.enter) enterCar(car);
            else stealCar(car);
          } else if (car.kind === 'traffic') {
            stealCar(car);
          } else if (car.kind === 'police') {
            stealCar(car);
          }
          if (audio) audio.blip(660);
        }
      }
    }
    if (actions.reload) reload();
    if (actions.weaponNext) cycleWeapon();
    // Remember a safe spot for respawns.
    if (isOnRoad(player.x, player.z)) {
      player.lastSafeX = player.x;
      player.lastSafeZ = player.z;
    }
    if (player.health <= 0 && !player.dead) {
      player.dead = true;
      worldApi.emit('wasted', {});
    }
  }

  /** Respawn after wasted/busted: hospital, fine, car kept if it survived. */
  function respawn(fine) {
    player.health = PLAYER.maxHealth;
    player.armour = 0;
    player.money = Math.max(0, player.money - fine);
    player.dead = false;
    if (player.car) {
      player.car.kind = 'parked';
      player.car.driver = false;
      player.car.health = Math.max(25, player.car.health);
      player.car = null;
    }
    player.x = city.spots.hospital.x + 8;
    player.z = city.spots.hospital.z + 8;
    player.camYaw = Math.PI;
    world.wanted.stars = 0;
    world.wanted.heat = 0;
    world.wanted.unseen = 0;
    if (world.heli) world.heli = null;
    for (const car of world.cars) {
      if (car.kind === 'police') car.dead = true;
    }
    world.roadblocks = [];
  }

  return {
    player,
    update,
    enterCar,
    exitCar,
    stealCar,
    nearestCar,
    cycleWeapon,
    reload,
    addRespect,
    updateRank,
    respawn,
    currentWeapon,
  };
}
