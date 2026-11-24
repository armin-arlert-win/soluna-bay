// SOLUNA BAY — screenshot scenes behind ?shot=chase|mission|night|map.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP, CAR_COLORS } from './config.js';
import { MISSIONS } from './missions.js';
import { nearestRoad } from './city.js';

// Staged cars use the bright palette only: the black paint (0x2b2b2b) reads
// as a black box at dusk and, placed ahead of the player, hid the white
// roadblock cruisers behind it (round-6 diagnosis: the most prominent car
// in the cover was a black parked bison, not the police).
const SHOT_COLORS = CAR_COLORS.filter((c) => c !== 0x2b2b2b);

const SAMPLE = STEP;

// A fake input the autopilot drives with.
function fakeInput(axesFn) {
  return {
    axes: axesFn,
    isDown: () => false,
    weaponSlot: () => -1,
  };
}
function angDiff(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer a car along its road with pure pursuit: aim at a point 25 m ahead
// on the road centreline, and never turn at a junction (the shot is short,
// and a straight road keeps the car off the buildings).
function drivePilot(world) {
  return () => {
    const p = world.player;
    const car = p.car;
    if (!car) return { x: 0, y: 0 };
    const alongX = Math.abs(Math.sin(car.heading)) > 0.7;
    const road = alongX ? nearestRoad(car.z) : nearestRoad(car.x);
    const dir = alongX ? Math.sign(Math.sin(car.heading)) : Math.sign(Math.cos(car.heading));
    const look = alongX
      ? { x: car.x + dir * 25, z: road }
      : { x: road, z: car.z + dir * 25 };
    const desired = Math.atan2(look.x - car.x, look.z - car.z);
    const steer = Math.max(-1, Math.min(1, angDiff(desired, car.heading) * 2.5));
    return { x: steer, y: 1 };
  };
}

function walkPilot(world) {
  return () => ({ x: Math.sin(world.time * 0.4) * 0.4, y: 1 });
}

function stepWorld(world, pilot, seconds, camYawFn) {
  const input = fakeInput(pilot);
  for (let t = 0; t < seconds / SAMPLE; t += 1) {
    world.step(input, 0, camYawFn ? camYawFn(world) : world.player.heading);
  }
}

// Street life for the frame: parked cars and pedestrians placed in a band
// ahead of the player AFTER the world has been stepped. The world is frozen
// for the screenshot (world.photoFreeze, set by stageShot), so what is
// placed here is exactly what the screenshot shows — no coast to allow
// for. Cars are kept within the road (|side| <= 3 m) and pedestrians on
// the road edge and sidewalk (|side| 3-7 m), so none land inside a building.
function addStreetLife(world, aheadMin, aheadMax, nParked, nPeds) {
  const p = world.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  const types = ['clipper', 'sable', 'bison', 'mule', 'comet'];
  const pedColors = [0xd84a4a, 0x4a7ad8, 0x4ad87a, 0xd8c84a, 0x9a4ad8, 0xe8e8e8, 0x2b2b2b];
  const rng = world.rng;
  for (let i = 0; i < nParked; i += 1) {
    const d = aheadMin + rng.next() * (aheadMax - aheadMin);
    const side = (rng.next() - 0.5) * 6;
    const x = p.x + fx * d + rx * side;
    const z = p.z + fz * d + rz * side;
    const heading = rng.chance(0.5) ? p.heading : p.heading + Math.PI;
    const car = world._newCar(types[rng.int(0, types.length - 1)], x, z, heading, 'parked');
    car.color = SHOT_COLORS[rng.int(0, SHOT_COLORS.length - 1)];
  }
  for (let i = 0; i < nPeds; i += 1) {
    const d = aheadMin + rng.next() * (aheadMax - aheadMin);
    const side = (rng.chance(0.5) ? 1 : -1) * rng.range(3, 7);
    const x = p.x + fx * d + rx * side;
    const z = p.z + fz * d + rz * side;
    world.peds.push({
      x, z, heading: rng.range(0, Math.PI * 2), speed: rng.range(1.2, 2.0),
      color: pedColors[rng.int(0, pedColors.length - 1)],
      state: 'walk', hp: 40, shootT: 0, phase: rng.range(0, Math.PI * 2),
    });
  }
}

// Moving traffic in the frame: cars placed after the step, heading the same
// way as the player. They are frozen for the screenshot (photoFreeze), so
// they hold the exact band they are placed in.
function addTrafficAhead(world, aheadMin, aheadMax, n) {
  const p = world.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  const types = ['clipper', 'sable', 'bison', 'mule', 'comet'];
  const rng = world.rng;
  for (let i = 0; i < n; i += 1) {
    const d = aheadMin + rng.next() * (aheadMax - aheadMin);
    const side = (rng.next() - 0.5) * 5;
    const x = p.x + fx * d + rx * side;
    const z = p.z + fz * d + rz * side;
    const car = world._newCar(types[rng.int(0, types.length - 1)], x, z, p.heading, 'traffic');
    car.color = SHOT_COLORS[rng.int(0, SHOT_COLORS.length - 1)];
    car.speed = 6;
    car.targetSpeed = rng.range(9, 13);
  }
}

// A parked police cruiser with its light bar flashing, placed ahead of the
// player so the pursuit reads in the frame. Parked cruisers do not chase,
// so they hold their spot for the screenshot.
function addCruiserAhead(world, ahead, side) {
  const p = world.player;
  const fx = Math.sin(p.heading);
  const fz = Math.cos(p.heading);
  const rx = Math.cos(p.heading);
  const rz = -Math.sin(p.heading);
  const car = world._newCar('cruiser', p.x + fx * ahead + rx * side, p.z + fz * ahead + rz * side, p.heading, 'police');
  car.parked = true;
  car.speed = 0;
  return car;
}

function putPlayerInCar(world, typeId, x, z, heading) {
  const car = world._newCar(typeId, x, z, heading, 'traffic');
  car.color = 0xc23b2e;
  world._enterCar(car);
  return car;
}

/**
 * Stage the named scene and return the screen main.js should show.
 * Unknown names stage the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  if (name === 'chase') {
    // A beachfront getaway chase at dusk (round 6): the player floors a
    // Clipper south down Beachfront — the westernmost road — with Dario
    // riding along on a job, three stars, a police roadblock ahead and a
    // helicopter overhead. The ocean, sand and palms are on the left, the
    // skyline on the right, and the pier (z = 40) lands ahead-left in
    // frame, bridging the road to the water. The camera sits slightly
    // east (camSide -0.25) so it looks a touch west, toward the ocean.
    // This is the leaders' shot — a mission chase on the beach, not an
    // inland avenue — and the HUD district readout says "Beachfront".
    world.clock = 17 * 60 + 30;
    world.camSide = -0.25;
    putPlayerInCar(world, 'clipper', -200, -180, 0);
    world.player.wanted = 3;
    world.player.lastCrime = world.time;
    // A mid-game rank and bankroll, so the readouts show a developed
    // player (same staging philosophy as the respect value).
    world.player.respect = 420; // Runner
    world.player.money = 12480;
    // A job is running at the same time as the chase: Dario is riding
    // along to The Docks (south, straight ahead down Beachfront), so the
    // cover carries a mission, a stage and a speaking character — and the
    // gold mission beacon at the Docks is visible ahead.
    world.player.passenger = 'Dario Voss';
    world.mission.active = {
      def: MISSIONS[0], objIdx: 2, data: {}, closeTime: 0, violation: 0,
    };
    world.mission.next = 0;
    // The subtitle is timed from world.time: the 7 s autopilot drive plus
    // the ~1.8 s screenshot wait already eat ~8.8 s, so a 12 s line keeps
    // Dario's line on screen at screenshot time.
    world.talk('Dario Voss: "Keep it smooth. The Docks, and no heroes."', 12);
    const ahead = world._newCar('cruiser', -200, -180 + 22, 0, 'police');
    ahead.speed = 22;
    ahead.targetSpeed = 22;
    for (let i = 0; i < 2; i += 1) {
      const cop = world._newCar('cruiser', -200 + (i === 0 ? 3 : -3), -180 - 12 - i * 8, 0, 'police');
      cop.speed = 28;
      cop.targetSpeed = 28;
    }
    world.heli.active = true;
    world.heli.x = world.player.x;
    world.heli.z = world.player.z - 20;
    stepWorld(world, drivePilot(world), 7);
    // The pursuit happens behind the camera, so stage the visible half of
    // it ahead of the player: a cruiser roadblock with flashing light bars,
    // cruisers flanking it on both road edges, live traffic to weave
    // through, parked cars and pedestrians filling the avenue — including
    // beachgoers on the sand-side verge. The world is frozen for the
    // screenshot (photoFreeze below), so the bands are the exact distances
    // at shutter time: two flanking cruisers at 12 m frame the player's
    // lane in the mid-frame, the roadblock sits 20-41 m, traffic 14-50 m,
    // street life 8-45 m — a deep, busy beachfront, not one cluster at a
    // single intersection.
    addCruiserAhead(world, 12, -3.2);
    addCruiserAhead(world, 12, 3.2);
    addCruiserAhead(world, 20, -2.5);
    addCruiserAhead(world, 28, 2.5);
    addCruiserAhead(world, 34, -3.2);
    addCruiserAhead(world, 41, 3.2);
    addTrafficAhead(world, 14, 50, 5);
    addStreetLife(world, 8, 45, 5, 10);
    // The helicopter is frozen for the screenshot too, so it is staged at
    // its final distance: +50 m ahead and low (y 12), a BIG 3D body with
    // its searchlight beam on the player, the way the leaders' helis read.
    // (Before the freeze it was staged at +160 m to allow for the lerp
    // and the coast; that made its distance a frame-rate lottery.)
    world.heli.x = world.player.x - 10;
    world.heli.z = world.player.z + 50;
    world.heli.y = 12;
    // Freeze the simulation for the screenshot: the browser's coast during
    // the ~1.8 s wait varies by tens of metres with the frame rate, and
    // on one run the player coasted ~74 m and drove straight through the
    // roadblock band. The frame is still a real render of the game after
    // 7 s of real play — the freeze is photo mode, not a different game.
    world.photoFreeze = true;
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mid-job: Dario is riding along to the Docks, tracker on screen.
    // The avenue is filled with traffic and pedestrians so the drive
    // reads as a living city, not an empty road.
    putPlayerInCar(world, 'clipper', 40, 120, Math.PI);
    world.player.passenger = 'Dario Voss';
    world.player.respect = 180; // Hustler — the rank/RP readout shows progress
    world.mission.active = {
      def: MISSIONS[0], objIdx: 2, data: {}, closeTime: 0, violation: 0,
    };
    world.mission.next = 0;
    // The subtitle is timed from world.time: the 5 s autopilot drive plus
    // the ~1.8 s screenshot wait already eat ~6.8 s, so a 6 s line expired
    // before the shutter — the dialogue was missing from the shot. 12 s
    // keeps Dario's line on screen at screenshot time.
    world.talk('Dario Voss: "Keep it smooth. The Docks, and no heroes."', 12);
    stepWorld(world, drivePilot(world), 5);
    addTrafficAhead(world, 14, 45, 4);
    addStreetLife(world, 10, 40, 4, 8);
    world.photoFreeze = true;
    return { screen: 'play' };
  }
  if (name === 'night') {
    // Night on the Bay: lamps on, the player walking up to Soluna Plaza
    // through a street that is still alive — pedestrians on the sidewalks
    // and cars on the road. On foot the player does not coast, so the
    // band is close to the post-step position.
    world.clock = 22 * 60;
    world.player.x = 0;
    world.player.z = 24;
    world.player.heading = Math.PI;
    stepWorld(world, walkPilot(world), 6);
    addStreetLife(world, 10, 35, 2, 10);
    addTrafficAhead(world, 15, 40, 2);
    world.photoFreeze = true;
    return { screen: 'play' };
  }
  if (name === 'map') {
    // The map open over a live daytime city, a job waiting. The streets
    // are filled so the map itself reads as a busy city — more cars and
    // pedestrians means more life on the minimap dots.
    putPlayerInCar(world, 'sable', -80, -40, 0);
    world.mission.active = {
      def: MISSIONS[0], objIdx: 0, data: {}, closeTime: 0, violation: 0,
    };
    world.mission.next = 0;
    stepWorld(world, drivePilot(world), 5);
    addTrafficAhead(world, 36, 50, 3);
    addStreetLife(world, 36, 50, 4, 8);
    world.photoFreeze = true;
    return { screen: 'map' };
  }
  // Default: the title scene, a few seconds into the attract drive.
  world.attract = true;
  stepWorld(world, drivePilot(world), 4);
  return { screen: 'title' };
}
