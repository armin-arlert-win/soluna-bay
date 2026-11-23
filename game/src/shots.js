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
    // A three-star chase: the player floors a Clipper down a downtown avenue,
    // with a cruiser ahead to run down and two more closing in behind. The
    // Clipper is slower than the cruisers, so the pursuit stays on the bumper.
    // The camera sits off to one side so the pursuit behind is in frame.
    world.camSide = 0.55;
    putPlayerInCar(world, 'clipper', -80, 40, Math.PI / 2);
    world.player.wanted = 3;
    world.player.lastCrime = world.time;
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
    return { screen: 'play' };
  }
  if (name === 'mission') {
    // Mid-job: Dario is riding along to the Docks, tracker on screen.
    putPlayerInCar(world, 'clipper', 40, 120, Math.PI);
    world.player.passenger = 'Dario Voss';
    world.mission.active = {
      def: MISSIONS[0], objIdx: 2, data: {}, closeTime: 0, violation: 0,
    };
    world.mission.next = 0;
    world.talk('Dario Voss: "Keep it smooth. The Docks, and no heroes."', 6);
    stepWorld(world, drivePilot(world), 5);
    return { screen: 'play' };
  }
  if (name === 'night') {
    // Night on the Bay: lamps on, the player walking up to Soluna Plaza.
    world.clock = 22 * 60;
    world.player.x = 0;
    world.player.z = 24;
    world.player.heading = Math.PI;
    stepWorld(world, walkPilot(world), 6);
    return { screen: 'play' };
  }
  if (name === 'map') {
    // The map open over a live daytime city, a job waiting.
    putPlayerInCar(world, 'sable', -80, -40, 0);
    world.mission.active = {
      def: MISSIONS[0], objIdx: 0, data: {}, closeTime: 0, violation: 0,
    };
    world.mission.next = 0;
    stepWorld(world, drivePilot(world), 5);
    return { screen: 'map' };
  }
  // Default: the title scene, a few seconds into the attract drive.
  world.attract = true;
  stepWorld(world, drivePilot(world), 4);
  return { screen: 'title' };
}
