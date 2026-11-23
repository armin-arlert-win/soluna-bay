// The scene renderer for Soluna Bay: it builds the reusable entity meshes
// (cars, people, helicopter, beacons, gates, shells, particles) once, then
// paints the static city and every moving thing each frame, with a sky
// gradient, sun, fog and a day/night palette driven by the game clock.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { MeshBuilder } from './gl.js';
import { mat4Identity, mat4Multiply, mat4RotX, mat4Model, lerp } from './util.js';

function buildCarMesh(gl) {
  const b = new MeshBuilder();
  const body = [1, 1, 1];
  const dark = [0.12, 0.13, 0.15];
  // Lower body.
  b.box(0, 0.55, 0, 1.9, 0.6, 4.4, body);
  // Cabin with dark glass.
  b.box(0, 1.1, -0.3, 1.7, 0.55, 2.3, dark);
  // Hood and trunk lips.
  b.box(0, 0.82, 1.9, 1.8, 0.18, 0.7, body);
  b.box(0, 0.82, -1.95, 1.8, 0.18, 0.6, body);
  // Headlights and taillights.
  b.box(-0.6, 0.62, 2.21, 0.45, 0.16, 0.06, [1, 0.95, 0.75]);
  b.box(0.6, 0.62, 2.21, 0.45, 0.16, 0.06, [1, 0.95, 0.75]);
  b.box(-0.6, 0.62, -2.21, 0.45, 0.16, 0.06, [0.9, 0.1, 0.1]);
  b.box(0.6, 0.62, -2.21, 0.45, 0.16, 0.06, [0.9, 0.1, 0.1]);
  // Wheels.
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    b.box(wx, 0.35, wz, 0.3, 0.7, 0.7, [0.08, 0.08, 0.09]);
  }
  return b.build(gl);
}

function buildPoliceCarMesh(gl) {
  const b = new MeshBuilder();
  const body = [1, 1, 1];
  const dark = [0.12, 0.13, 0.15];
  b.box(0, 0.55, 0, 1.9, 0.6, 4.4, body);
  b.box(0, 1.1, -0.3, 1.7, 0.55, 2.3, dark);
  b.box(0, 0.82, 1.9, 1.8, 0.18, 0.7, body);
  b.box(0, 0.82, -1.95, 1.8, 0.18, 0.6, body);
  // Light bar: red and blue halves.
  b.box(-0.42, 1.48, -0.3, 0.8, 0.16, 0.5, [0.9, 0.1, 0.12]);
  b.box(0.42, 1.48, -0.3, 0.8, 0.16, 0.5, [0.15, 0.3, 0.95]);
  b.box(-0.6, 0.62, 2.21, 0.45, 0.16, 0.06, [1, 0.95, 0.75]);
  b.box(0.6, 0.62, 2.21, 0.45, 0.16, 0.06, [1, 0.95, 0.75]);
  for (const [wx, wz] of [[-0.85, 1.45], [0.85, 1.45], [-0.85, -1.45], [0.85, -1.45]]) {
    b.box(wx, 0.35, wz, 0.3, 0.7, 0.7, [0.08, 0.08, 0.09]);
  }
  return b.build(gl);
}

function buildPersonMesh(gl, shirt, pants, skin) {
  const b = new MeshBuilder();
  // Torso.
  b.box(0, 1.15, 0, 0.62, 0.7, 0.36, shirt);
  // Head.
  b.box(0, 1.68, 0, 0.34, 0.34, 0.34, skin);
  // Arms.
  b.box(-0.4, 1.15, 0, 0.16, 0.6, 0.16, shirt);
  b.box(0.4, 1.15, 0, 0.16, 0.6, 0.16, shirt);
  return { body: b.build(gl), pants };
}

function buildLegMesh(gl, pants) {
  const b = new MeshBuilder();
  b.box(0, -0.35, 0, 0.2, 0.7, 0.2, pants);
  return b.build(gl);
}

function buildHeliMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 2.2, 1.6, 4.2, [0.08, 0.1, 0.14]);
  b.box(0, 0.5, 0.4, 1.8, 0.8, 2.2, [0.1, 0.14, 0.2]);
  b.box(0, 0.1, -3.4, 0.5, 0.5, 3.2, [0.08, 0.1, 0.14]);
  b.box(0, 0.4, -4.9, 0.3, 1.2, 0.3, [0.08, 0.1, 0.14]);
  b.box(0, 1.0, 0, 0.6, 0.4, 0.6, [0.15, 0.15, 0.18]);
  return b.build(gl);
}

function buildRotorMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, 0, 0, 9.5, 0.08, 0.5, [0.1, 0.1, 0.12]);
  b.box(0, 0, 0, 0.5, 0.08, 9.5, [0.1, 0.1, 0.12]);
  return b.build(gl);
}

function buildBeaconMesh(gl) {
  const b = new MeshBuilder();
  for (let side = 0; side < 6; side += 1) {
    const a0 = (side / 6) * Math.PI * 2;
    const a1 = ((side + 1) / 6) * Math.PI * 2;
    const r = 0.7;
    b.quad(
      [Math.cos(a0) * r, 0, Math.sin(a0) * r],
      [Math.cos(a1) * r, 0, Math.sin(a1) * r],
      [Math.cos(a1) * r, 26, Math.sin(a1) * r],
      [Math.cos(a0) * r, 26, Math.sin(a0) * r],
      [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)],
      [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 0.85, 0.3],
    );
  }
  return b.build(gl);
}

function buildRingMesh(gl) {
  const b = new MeshBuilder();
  for (let side = 0; side < 16; side += 1) {
    const a0 = (side / 16) * Math.PI * 2;
    const a1 = ((side + 1) / 16) * Math.PI * 2;
    b.quad(
      [Math.cos(a0) * 3, 0.06, Math.sin(a0) * 3],
      [Math.cos(a1) * 3, 0.06, Math.sin(a1) * 3],
      [Math.cos(a1) * 2.4, 0.06, Math.sin(a1) * 2.4],
      [Math.cos(a0) * 2.4, 0.06, Math.sin(a0) * 2.4],
      [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 0.85, 0.3],
    );
  }
  return b.build(gl);
}

function buildGateMesh(gl) {
  const b = new MeshBuilder();
  b.box(-3.2, 2.2, 0, 0.35, 4.4, 0.35, [1, 0.85, 0.3]);
  b.box(3.2, 2.2, 0, 0.35, 4.4, 0.35, [1, 0.85, 0.3]);
  b.box(0, 4.3, 0, 6.8, 0.35, 0.35, [1, 0.85, 0.3]);
  return b.build(gl);
}

function buildShellMesh(gl) {
  const b = new MeshBuilder();
  b.box(0, 0.25, 0, 0.5, 0.5, 0.5, [1, 0.85, 0.3]);
  return b.build(gl);
}

function buildShadowMesh(gl) {
  const b = new MeshBuilder();
  for (let side = 0; side < 12; side += 1) {
    const a0 = (side / 12) * Math.PI * 2;
    const a1 = ((side + 1) / 12) * Math.PI * 2;
    b.quad(
      [0, 0, 0],
      [Math.cos(a0), 0, Math.sin(a0)],
      [Math.cos(a1), 0, Math.sin(a1)],
      [0, 0, 0],
      [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0, 0, 0],
    );
  }
  return b.build(gl);
}

function buildBoxMesh(gl, size, color) {
  const b = new MeshBuilder();
  b.box(0, 0, 0, size, size, size, color);
  return b.build(gl);
}

function buildConeMesh(gl) {
  const b = new MeshBuilder();
  for (let side = 0; side < 8; side += 1) {
    const a0 = (side / 8) * Math.PI * 2;
    const a1 = ((side + 1) / 8) * Math.PI * 2;
    b.quad(
      [0, 0, 0],
      [Math.cos(a0) * 6, -14, Math.sin(a0) * 6],
      [Math.cos(a1) * 6, -14, Math.sin(a1) * 6],
      [0, 0, 0],
      [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [1, 0.95, 0.75],
    );
  }
  return b.build(gl);
}

export function createMeshes(gl) {
  // One body mesh per shirt colour, so pedestrians, enemies and the player
  // each read in their own colours without a tint pass.
  const personBodies = new Map();
  const shirtColors = [
    [0.9, 0.7, 0.4], [0.5, 0.3, 0.7], [0.3, 0.6, 0.9], [0.9, 0.4, 0.3],
    [0.4, 0.8, 0.5], [0.8, 0.8, 0.85], [0.95, 0.6, 0.2], [0.6, 0.7, 0.3],
    [0.7, 0.15, 0.15], [0.2, 0.2, 0.22], [0.95, 0.55, 0.2],
  ];
  for (const shirt of shirtColors) {
    personBodies.set(shirt.join(','), buildPersonMesh(gl, shirt, [0.2, 0.22, 0.28], [0.85, 0.65, 0.45]).body);
  }
  return {
    car: buildCarMesh(gl),
    policeCar: buildPoliceCarMesh(gl),
    heli: buildHeliMesh(gl),
    rotor: buildRotorMesh(gl),
    beacon: buildBeaconMesh(gl),
    ring: buildRingMesh(gl),
    gate: buildGateMesh(gl),
    shell: buildShellMesh(gl),
    shadow: buildShadowMesh(gl),
    particle: buildBoxMesh(gl, 1, [1, 1, 1]),
    cone: buildConeMesh(gl),
    legDark: buildLegMesh(gl, [0.2, 0.22, 0.28]),
    personBodies,
    playerBody: personBodies.get([0.95, 0.55, 0.2].join(',')),
  };
}

/** The body mesh for a person, by their shirt colour. */
export function personMeshFor(meshes, person) {
  return meshes.personBodies.get(person.shirt.join(',')) || meshes.personBodies.get([0.8, 0.8, 0.85].join(','));
}

/** Day/night palette from the game clock (0..24h) and night factor 0..1. */
export function environmentFor(clock, night) {
  const day = {
    sunDir: [0.45, 0.75, 0.4],
    sunColor: [0.72, 0.68, 0.58],
    ambient: [0.45, 0.48, 0.54],
    fog: [0.72, 0.82, 0.92],
    skyTop: [0.32, 0.6, 0.9],
    skyHorizon: [0.82, 0.9, 0.97],
    fogNear: 130,
    fogFar: 720,
  };
  const dusk = {
    sunDir: [0.85, 0.22, 0.25],
    sunColor: [0.7, 0.4, 0.22],
    ambient: [0.38, 0.36, 0.4],
    fog: [0.82, 0.58, 0.42],
    skyTop: [0.22, 0.28, 0.52],
    skyHorizon: [0.98, 0.58, 0.32],
    fogNear: 110,
    fogFar: 620,
  };
  const nightEnv = {
    sunDir: [0.3, 0.65, -0.35],
    sunColor: [0.25, 0.32, 0.5],
    ambient: [0.18, 0.2, 0.28],
    fog: [0.05, 0.07, 0.12],
    skyTop: [0.02, 0.03, 0.08],
    skyHorizon: [0.09, 0.11, 0.19],
    fogNear: 90,
    fogFar: 520,
  };
  const hour = clock / 3600;
  const duskFactor = hour >= 17.5 && hour < 20 ? (hour - 17.5) / 2.5 : hour >= 6 && hour < 7.5 ? 1 - (hour - 6) / 1.5 : 0;
  const mix = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
  const base = {
    sunDir: mix(day.sunDir, dusk.sunDir, duskFactor),
    sunColor: mix(day.sunColor, dusk.sunColor, duskFactor),
    ambient: mix(day.ambient, dusk.ambient, duskFactor),
    fog: mix(day.fog, dusk.fog, duskFactor),
    skyTop: mix(day.skyTop, dusk.skyTop, duskFactor),
    skyHorizon: mix(day.skyHorizon, dusk.skyHorizon, duskFactor),
    fogNear: lerp(day.fogNear, dusk.fogNear, duskFactor),
    fogFar: lerp(day.fogFar, dusk.fogFar, duskFactor),
  };
  const out = {
    sunDir: mix(base.sunDir, nightEnv.sunDir, night),
    sunColor: mix(base.sunColor, nightEnv.sunColor, night),
    ambient: mix(base.ambient, nightEnv.ambient, night),
    fog: mix(base.fog, nightEnv.fog, night),
    skyTop: mix(base.skyTop, nightEnv.skyTop, night),
    skyHorizon: mix(base.skyHorizon, nightEnv.skyHorizon, night),
    fogNear: lerp(base.fogNear, nightEnv.fogNear, night),
    fogFar: lerp(base.fogFar, nightEnv.fogFar, night),
    night,
  };
  return out;
}

export function drawScene(renderer, meshes, city, world, player, camera, env, time) {
  const gl = renderer.gl;
  renderer.beginFrame(env);
  renderer.bindTextures(city.dayTex, city.nightTex);
  const identity = mat4Identity();
  // Static city.
  renderer.draw(city.mesh, identity, { textured: true });
  const r = renderer;

  function shadow(x, z, sx, sz, alpha = 0.32) {
    r.drawFlat(meshes.shadow, mat4Model(x, 0.06, z, 0, sx, 1, sz), [0, 0, 0], alpha);
  }

  // Sun shells (collectibles).
  for (const shell of city.collectibles) {
    if (shell.taken) continue;
    const bob = 0.3 + Math.sin(time * 2 + shell.x) * 0.12;
    r.draw(meshes.shell, mat4Model(shell.x, bob, shell.z, time * 1.2, 1, 1, 1), { emissive: 0.55 });
  }

  // Cars.
  for (const car of world.cars) {
    if (car.dead) continue;
    const mesh = car.kind === 'police' ? meshes.policeCar : meshes.car;
    const tint = car.model.color || [0.8, 0.8, 0.8];
    const model = mat4Model(car.x, 0, car.z, car.heading);
    r.draw(mesh, model, { tint });
    shadow(car.x, car.z, 2.6, 5.2);
    // Police light bar flash.
    if (car.kind === 'police' && world.wanted.stars > 0) {
      const flash = Math.floor(time * 4) % 2 === 0;
      r.draw(meshes.particle, mat4Model(car.x - 0.42 * Math.cos(car.heading), 1.55, car.z + 0.42 * Math.sin(car.heading), car.heading, 0.8, 0.3, 0.5),
        { tint: flash ? [1, 0.1, 0.1] : [0.15, 0.3, 1], emissive: 1 });
    }
  }

  // Pedestrians.
  for (const ped of world.peds) {
    const swing = Math.sin(ped.walkPhase) * 0.5;
    const legL = mat4Multiply(mat4Model(ped.x, 0.85, ped.z, ped.heading), mat4RotX(swing));
    const legR = mat4Multiply(mat4Model(ped.x, 0.85, ped.z, ped.heading), mat4RotX(-swing));
    r.draw(meshes.legDark, legL, {});
    r.draw(meshes.legDark, legR, {});
    const body = personMeshFor(meshes, ped);
    r.draw(body, mat4Model(ped.x, 0, ped.z, ped.heading), {});
    shadow(ped.x, ped.z, 1.1, 1.1, 0.28);
  }

  // Enemies.
  for (const e of world.enemies) {
    const swing = Math.sin(time * 6 + e.x) * 0.4;
    const legL = mat4Multiply(mat4Model(e.x, 0.85, e.z, e.heading), mat4RotX(swing));
    const legR = mat4Multiply(mat4Model(e.x, 0.85, e.z, e.heading), mat4RotX(-swing));
    r.draw(meshes.legDark, legL, {});
    r.draw(meshes.legDark, legR, {});
    const body = personMeshFor(meshes, e);
    r.draw(body, mat4Model(e.x, 0, e.z, e.heading), {});
    shadow(e.x, e.z, 1.1, 1.1, 0.28);
  }

  // Player on foot.
  if (player && !player.car) {
    const swing = player.speed > 0.5 ? Math.sin(time * 9) * 0.5 : 0;
    const legL = mat4Multiply(mat4Model(player.x, 0.85, player.z, player.heading), mat4RotX(swing));
    const legR = mat4Multiply(mat4Model(player.x, 0.85, player.z, player.heading), mat4RotX(-swing));
    r.draw(meshes.legDark, legL, {});
    r.draw(meshes.legDark, legR, {});
    r.draw(meshes.playerBody, mat4Model(player.x, 0, player.z, player.heading), {});
    if (player.weaponIndex > 0) {
      // A gun in the player's hands, pointing where he aims.
      r.draw(meshes.particle, mat4Model(
        player.x + Math.sin(player.camYaw) * 0.55, 1.25, player.z + Math.cos(player.camYaw) * 0.55,
        player.camYaw, 0.14, 0.14, 0.7,
      ), { tint: [0.12, 0.12, 0.13] });
    }
    if (player.muzzleT > 0) {
      r.draw(meshes.particle, mat4Model(
        player.x + Math.sin(player.camYaw) * 1.1, 1.4, player.z + Math.cos(player.camYaw) * 1.1,
        player.camYaw, 0.5, 0.5, 0.5,
      ), { tint: [1, 0.85, 0.3], emissive: 1 });
    }
    shadow(player.x, player.z, 1.2, 1.2, 0.3);
  }

  // Helicopter with searchlight.
  if (world.heli) {
    const h = world.heli;
    const model = mat4Model(h.x, h.y, h.z, h.heading);
    r.draw(meshes.heli, model, {});
    const rotor = mat4Multiply(model, mat4Model(0, 1.25, 0, h.rotor));
    r.draw(meshes.rotor, rotor, {});
    if (world.night > 0.4 || world.wanted.stars >= 3) {
      // Searchlight: a translucent cone from the heli to the player.
      const dx = h.searchX - h.x;
      const dz = h.searchZ - h.z;
      const dist = Math.hypot(dx, dz);
      const tilt = Math.atan2(dist, h.y);
      const coneModel = mat4Multiply(
        mat4Model(h.x, h.y - 1, h.z, Math.atan2(dx, dz)),
        mat4RotX(tilt),
      );
      r.drawFlat(meshes.cone, coneModel, [1, 0.95, 0.7], 0.13);
      // Lit ground circle under the searchlight.
      r.drawFlat(meshes.shadow, mat4Model(h.searchX, 0.08, h.searchZ, 0, 7, 1, 7), [1, 0.95, 0.7], 0.22);
    }
  }

  // Mission marker beacon and race gates.
  if (camera.marker) {
    const m = camera.marker;
    const pulse = 0.75 + Math.sin(time * 3) * 0.25;
    r.drawFlat(meshes.beacon, mat4Model(m.x, 0, m.z, 0), [1, 0.85, 0.3], 0.28 * pulse);
    r.draw(meshes.ring, mat4Model(m.x, 0, m.z, 0), { emissive: 0.5 });
  }
  if (camera.gates) {
    for (const gate of camera.gates) {
      r.draw(meshes.gate, mat4Model(gate.x, 0, gate.z, gate.heading || 0), { emissive: 0.55 });
    }
  }

  // Particles.
  for (const pt of world.particles) {
    const fade = 1 - pt.life / pt.ttl;
    r.draw(meshes.particle,
      mat4Model(pt.x, pt.y, pt.z, 0, pt.size, pt.size, pt.size),
      { tint: pt.color, emissive: 0.4, alpha: fade });
  }

  void gl;
}
