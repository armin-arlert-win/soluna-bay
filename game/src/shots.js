// SOLUNA BAY — screenshot scenes behind ?shot=chase|mission|night|map.
// Each one plays the real rules forward from a fresh world for a fixed
// number of steps, steered by a simple autopilot, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { MISSIONS } from './missions.js';
import { nearestRoad } from './city.js';

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
// ahead of the player AFTER the world has been stepped, so what is placed
// here is what the screenshot shows. Parked cars do not move and
// pedestrians barely move, so they hold the frame during the screenshot
// wait — while the player coasts ~30 m forward in that wait, which is why
// the band starts well ahead of the post-step position. Cars are kept
// within the road (|side| <= 3 m) and pedestrians on the road edge and
// sidewalk (|side| 3-7 m), so none land inside a building.
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
    world._newCar(types[rng.int(0, types.length - 1)], x, z, heading, 'parked');
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
// way as the player so they stay ahead of it while it coasts. They start
// from rest and pull away, so they read as live traffic, not parked cars.
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
    // A three-star chase at dusk: the player floors a Clipper down a
    // downtown avenue toward a police roadblock, cruisers flanking and a
    // helicopter overhead. The camera sits nearly behind the player so the
    // roadblock and traffic ahead are centred in the frame. Dusk (17:30)
    // gives the warm sunset light.
    world.clock = 17 * 60 + 30;
    world.camSide = 0.25;
    putPlayerInCar(world, 'clipper', -80, 40, Math.PI / 2);
    world.player.wanted = 3;
    world.player.lastCrime = world.time;
    // A mid-game rank, so the rank/RP readout shows a developed player.
    world.player.respect = 420; // Runner
    const ahead = world._newCar('cruiser', -80 + 22, 40, Math.PI / 2, 'police');
    ahead.speed = 22;
    ahead.targetSpeed = 22;
    for (let i = 0; i < 2; i += 1) {
      const cop = world._newCar('cruiser', -80 - 12 - i * 8, 40 + (i === 0 ? 3 : -3), Math.PI / 2, 'police');
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
    // through, parked cars and pedestrians filling the avenue. The band is
    // LONG (36-80 m) this round, not one tight clump: the browser coasts
    // ~24-30 m during the screenshot wait, so the cars land 6-56 m ahead —
    // spread along the whole visible avenue instead of bunched at one
    // intersection.
    addCruiserAhead(world, 40, -2.5);
    addCruiserAhead(world, 48, 2.5);
    addCruiserAhead(world, 56, -3.2);
    addCruiserAhead(world, 62, 3.2);
    addTrafficAhead(world, 36, 80, 5);
    addStreetLife(world, 36, 80, 5, 10);
    // The helicopter lerps toward the player and would end up behind the
    // camera, so it is staged far ahead and low: after the lerp it sits
    // ~35 m ahead at y 12, inside the camera cone instead of above it —
    // closer and lower than round 4, so the 3D body reads bigger.
    world.heli.x = world.player.x + 120;
    world.heli.z = world.player.z - 8;
    world.heli.y = 12;
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
    addTrafficAhead(world, 36, 50, 4);
    addStreetLife(world, 36, 50, 4, 8);
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
    return { screen: 'map' };
  }
  // Default: the title scene, a few seconds into the attract drive.
  world.attract = true;
  stepWorld(world, drivePilot(world), 4);
  return { screen: 'title' };
}
