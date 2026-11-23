// Screenshot staging for Soluna Bay: each named scene sets the world to a
// lively moment, then plays it forward with a simple autopilot so the frame
// is what a short stretch of the real game looks like. The scenes are
// chosen by ?shot=chase|mission|night|map (with &seed=N for the world seed).
// The harness's own no-input screenshots use the attract mode instead.
import { clamp, angleDiff } from './util.js';

const STEP = 1 / 60;

/** Drive the player's car toward a point, arcade style. */
function driveToward(player, tx, tz) {
  const car = player.car;
  if (!car) return { forward: false, back: false, left: false, right: false, run: false, brake: false };
  const want = Math.atan2(tx - car.x, tz - car.z);
  const diff = angleDiff(car.heading, want);
  const speed = Math.abs(car.speed);
  return {
    forward: true,
    back: false,
    left: diff < -0.08,
    right: diff > 0.08,
    run: false,
    brake: speed > 26 && Math.abs(diff) > 0.5,
  };
}

/** Coast-road waypoints for the chase scene, west to east and back. */
const COAST = [
  { x: -340, z: 360 }, { x: -140, z: 360 }, { x: 60, z: 360 },
  { x: 300, z: 360 }, { x: 350, z: 200 }, { x: 350, z: 0 },
];

export function stageShot(name, game) {
  const { worldApi, playerApi, missionsApi, city } = game;
  const world = worldApi.world;
  const player = playerApi.player;
  const shots = {
    chase: { steps: 60 * 14, camera: 'chase' },
    mission: { steps: 60 * 10, camera: 'combat' },
    night: { steps: 60 * 16, camera: 'chase' },
    map: { steps: 0, camera: 'map' },
  };
  const shot = shots[name] || shots.chase;

  if (name === 'mission') {
    // Mission 4's shootout at the Old Port, mid-fight. The player is on
    // foot here — step out of the attract car first.
    if (player.car) playerApi.exitCar();
    player.health = 100;
    player.armour = 50;
    world.clock = 15 * 3600 + 40 * 60;
    player.x = -290;
    player.z = -40;
    player.heading = Math.PI;
    player.camYaw = Math.PI;
    player.weaponIndex = 2;
    player.weapons[2].magAmmo = 30;
    player.weapons[2].reserve = 210;
    missionsApi.startMission(3);
    // Step the mission in: walk to the port, then the shootout spawns.
    for (let i = 0; i < 60 * 6; i += 1) {
      const marker = missionsApi.marker();
      if (marker) {
        const dx = marker.x - player.x;
        const dz = marker.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d > 4) {
          player.x += (dx / d) * 5 * STEP;
          player.z += (dz / d) * 5 * STEP;
          player.heading = Math.atan2(dx, dz);
        }
      }
      worldApi.update(STEP);
      missionsApi.update(STEP);
    }
    // Fight for a short while: aim at the nearest enemy and fire, but
    // stop before the shootout is won — the frame should be mid-fight.
    for (let i = 0; i < 60 * 3 && world.enemies.length > 1; i += 1) {
      const enemies = world.enemies;
      if (enemies.length > 0) {
        const e = enemies[0];
        player.camYaw = Math.atan2(e.x - player.x, e.z - player.z);
        player.camPitch = 0.05;
        playerApi.update(STEP,
          { forward: false, back: false, left: false, right: false, run: false, brake: false },
          { dx: 0, dy: 0 }, {}, true, null);
      }
      worldApi.update(STEP);
      missionsApi.update(STEP);
    }
    player.health = 100;
    return shot;
  }

  if (name === 'night') {
    world.clock = 21 * 3600 + 30 * 60;
    world.night = 1;
  } else {
    world.clock = 16 * 3600 + 45 * 60;
  }

  // Put the player in a car on the coast road and drive it with the autopilot.
  const car = worldApi.addCar('player', -300, 358, Math.PI / 2, {
    name: 'Calyx Sprint GT', maxSpeed: 36, accel: 15, len: 4.4,
    color: [0.9, 0.25, 0.55], paint: [0.9, 0.25, 0.55],
  });
  playerApi.enterCar(car);
  player.money = 48250;
  playerApi.addRespect(2450);
  player.rank = 'Crew Boss';

  if (name === 'chase') {
    worldApi.addWanted(3, 'staged chase');
    // Two police cars already close behind, plus the helicopter.
    for (let i = 0; i < 2; i += 1) {
      const cop = worldApi.addCar('police', -300 - (i + 1) * 14, 358 + (i % 2) * 6, Math.PI / 2, {
        name: 'SBPD Interceptor', maxSpeed: 40, accel: 18, len: 4.6,
        color: [0.08, 0.1, 0.14], paint: [0.9, 0.92, 0.95],
      });
      cop.unitName = `SBPD ${['Mako', 'Heron'][i]}-${cop.id}`;
      cop.speed = 30;
    }
    world.heli = { x: -260, y: 52, z: 320, heading: 0, rotor: 0, searchX: -300, searchZ: 358 };
  }

  let wp = 0;
  const total = shot.steps;
  for (let i = 0; i < total; i += 1) {
    const target = COAST[wp];
    if (Math.hypot(target.x - car.x, target.z - car.z) < 24) wp = Math.min(wp + 1, COAST.length - 1);
    const move = driveToward(player, COAST[wp].x, COAST[wp].z);
    playerApi.update(STEP, move, { dx: 0, dy: 0 }, {}, false, null);
    worldApi.update(STEP);
    missionsApi.update(STEP);
    // Keep the chase hot: top the wanted level back up if it cools.
    if (name === 'chase' && world.wanted.stars < 3) world.wanted.stars = 3;
    if (name === 'chase') world.wanted.unseen = 0;
  }
  // The staged drive takes hits (police rams, traffic); the frame should
  // show a car worth chasing, not a wreck. A car whose health hit zero is
  // flagged dead and stops drawing, so clear that too.
  for (const c of world.cars) { c.health = 100; c.dead = false; }
  if (name === 'mission') player.health = 100;
  // Face the camera along the road for a good frame.
  player.camYaw = car.heading;
  return shot;
}

/** Attract-mode autopilot: drive the player's car around the city on its own. */
export function attractDrive(player, world) {
  const car = player.car;
  if (!car) return { forward: false, back: false, left: false, right: false, run: false, brake: false };
  const waypoints = [
    { x: -340, z: 360 }, { x: 340, z: 360 }, { x: 340, z: 0 },
    { x: 340, z: -340 }, { x: 0, z: -340 }, { x: -340, z: -340 },
    { x: -340, z: 0 }, { x: -340, z: 200 },
  ];
  const wp = world.attractWp || 0;
  const target = waypoints[wp];
  if (Math.hypot(target.x - car.x, target.z - car.z) < 26) {
    world.attractWp = (wp + 1) % waypoints.length;
  }
  const move = driveToward(player, target.x, target.z);
  move.forward = true;
  return move;
}

export function clamp01(v) {
  return clamp(v, 0, 1);
}
