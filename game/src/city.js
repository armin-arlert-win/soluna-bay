// SOLUNA BAY — the city itself: blocks, buildings, parks, beach, marina.
// Generated once from a seed. The renderer and the simulation both read this.
import { GRID, PITCH, BLOCK, HALF, ROAD_CENTERS, COLLECTIBLE_COUNT, PALETTE } from './config.js';
import { makeRng, noise2 } from './rng.js';

const BUILDING_COLORS = [0x8a6f5c, 0x7a6a8a, 0x9a8a7a, 0x6a7a8a, 0xb08a5a, 0x5c6a5a, 0xa88a8a, 0x7a7a7a];

function blockCenter(index) {
  return ROAD_CENTERS[index] + PITCH / 2;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const plazas = [];
  const parking = [];

  // 10x10 blocks between the 11 road lines.
  for (let bi = 0; bi < GRID - 1; bi += 1) {
    for (let bj = 0; bj < GRID - 1; bj += 1) {
      const cx = blockCenter(bi);
      const cz = blockCenter(bj);
      const downtown = Math.abs(cx) < 90 && Math.abs(cz) < 90;
      const south = cz > 120;
      const roll = rng.next();
      if (bi === 5 && bj === 5) {
        // Soluna Plaza, the downtown heart.
        plazas.push({ x: cx, z: cz, size: BLOCK });
        continue;
      }
      if (south && cx < -60 && roll < 0.55) {
        // Marina warehouses and docks.
        buildings.push({
          x: cx, z: cz, w: 24, d: 18, h: rng.range(7, 12),
          color: 0x7a5a4a, roof: 0x4a3a30, kind: 'warehouse',
        });
        continue;
      }
      if (roll < 0.12) {
        parks.push({ x: cx, z: cz, size: BLOCK });
        const n = rng.int(4, 8);
        for (let t = 0; t < n; t += 1) {
          trees.push({ x: cx + rng.range(-12, 12), z: cz + rng.range(-12, 12), h: rng.range(3, 5), palm: rng.chance(0.3) });
        }
        continue;
      }
      if (roll < 0.2) {
        parking.push({ x: cx, z: cz, size: BLOCK });
        continue;
      }
      // A built block: one tall slab or two smaller ones.
      const tall = downtown ? rng.range(22, 48) : rng.range(9, 26);
      if (rng.chance(0.55)) {
        buildings.push({
          x: cx + rng.range(-4, 4), z: cz + rng.range(-4, 4),
          w: rng.range(16, 24), d: rng.range(16, 24), h: tall,
          color: rng.pick(BUILDING_COLORS), roof: PALETTE.roof, kind: 'tower',
        });
      } else {
        buildings.push({
          x: cx - 7, z: cz, w: 13, d: 20, h: tall * rng.range(0.5, 0.8),
          color: rng.pick(BUILDING_COLORS), roof: PALETTE.roof, kind: 'house',
        });
        buildings.push({
          x: cx + 7, z: cz, w: 13, d: 20, h: tall * rng.range(0.6, 1.0),
          color: rng.pick(BUILDING_COLORS), roof: PALETTE.roof, kind: 'house',
        });
      }
      // A tree or two on the block corners.
      if (rng.chance(0.6)) {
        trees.push({ x: cx + rng.range(-13, 13), z: cz + rng.range(-13, 13), h: rng.range(3, 5), palm: rng.chance(0.5) });
      }
    }
  }

  // Street lamps at every other intersection.
  for (let i = 0; i < ROAD_CENTERS.length; i += 1) {
    for (let j = 0; j < ROAD_CENTERS.length; j += 1) {
      if ((i + j) % 2 === 0) lamps.push({ x: ROAD_CENTERS[i] + 6, z: ROAD_CENTERS[j] + 6 });
    }
  }
  // Palm-lined beachfront.
  for (let z = -200; z <= 200; z += 28) {
    trees.push({ x: -232 + rng.range(-4, 4), z: z + rng.range(-6, 6), h: rng.range(4, 6), palm: true });
  }

  // The pier reaches west into the bay; the lighthouse guards the point.
  const pier = { x0: -226, x1: -306, z: 40, width: 8 };
  const lighthouse = { x: -252, z: -176, h: 34 };

  // Collectibles: shells hidden around the city.
  const collectibles = [];
  const spots = [];
  for (let i = 0; i < 26; i += 1) spots.push({ x: rng.range(-270, -225), z: rng.range(-200, 200) }); // beach
  for (const p of parks) for (let i = 0; i < 3; i += 1) spots.push({ x: p.x + rng.range(-11, 11), z: p.z + rng.range(-11, 11) });
  for (const p of plazas) for (let i = 0; i < 4; i += 1) spots.push({ x: p.x + rng.range(-12, 12), z: p.z + rng.range(-12, 12) });
  for (let i = 0; i < 14; i += 1) {
    spots.push({ x: ROAD_CENTERS[rng.int(0, 10)] + rng.range(-4, 4), z: ROAD_CENTERS[rng.int(0, 10)] + rng.range(-4, 4) });
  }
  for (let i = 0; i < 6; i += 1) spots.push({ x: pier.x0 - 8 - i * 12, z: pier.z + rng.range(-2, 2) });
  for (let i = 0; i < COLLECTIBLE_COUNT && i < spots.length; i += 1) {
    collectibles.push({ x: spots[i].x, z: spots[i].z, taken: false, bob: rng.range(0, Math.PI * 2) });
  }

  // Named places the missions and side activities use.
  const markers = {
    plaza: { x: 0, z: 0, name: 'Soluna Plaza' },
    garage: { x: -120, z: 160, name: 'Calder Auto Works' },
    beachHouse: { x: -196, z: 96, name: 'Beach House' },
    loft: { x: 52, z: -28, name: 'Downtown Loft' },
    warehouse: { x: -120, z: 168, name: 'Marina Warehouse' },
    docks: { x: -160, z: 180, name: 'The Docks' },
    pierEnd: { x: -300, z: 40, name: 'Pier End' },
    lighthouse: { x: -252, z: -176, name: 'Lighthouse Point' },
    northgate: { x: 120, z: -180, name: 'Northgate' },
    marina: { x: -40, z: 180, name: 'The Marina' },
    strip: { x: 160, z: 80, name: 'The Strip' },
    airport: { x: 180, z: -160, name: 'Northgate Airfield' },
  };

  return {
    seed, buildings, trees, lamps, parks, plazas, parking,
    pier, lighthouse, collectibles, markers, half: HALF,
  };
}

// Nearest road centreline to a coordinate.
export function nearestRoad(v) {
  let best = ROAD_CENTERS[0];
  let bd = Infinity;
  for (const c of ROAD_CENTERS) {
    const d = Math.abs(v - c);
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// Is this point on a road (within the asphalt)?
export function onRoad(x, z) {
  const dx = Math.min(...ROAD_CENTERS.map((c) => Math.abs(x - c)));
  const dz = Math.min(...ROAD_CENTERS.map((c) => Math.abs(z - c)));
  return dx <= 5 || dz <= 5;
}

// Clamp a point inside the drivable city (roads stop at the edge).
export function clampCity(x, z) {
  return { x: Math.max(-HALF + 4, Math.min(HALF - 4, x)), z: Math.max(-HALF + 4, Math.min(HALF - 4, z)) };
}

// Ground height variation for the beach dunes (visual only).
export function groundBump(x, z) {
  if (x > -220) return 0;
  return Math.max(0, noise2(null, x * 0.05, z * 0.05) - 0.5) * 1.6;
}
