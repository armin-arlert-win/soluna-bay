// Soluna Bay itself: a deterministic coastal grid city built from a seed.
// Bakes the whole static city (roads, sidewalks, buildings, beach, ocean,
// marina, palms, props) into one WebGL mesh plus two texture atlases
// (day and night facades), and hands the game the collision boxes, the road
// graph the traffic drives on, and the named spots the missions use.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { makeRandom, clamp } from './util.js';
import { MeshBuilder, makeCanvasTexture } from './gl.js';
import { CITY, DISTRICTS } from './config.js';

const STREETS = [];
for (let i = 0; i < CITY.streets; i += 1) STREETS.push(-350 + i * CITY.block);
const ROAD_HALF = CITY.roadHalf;
const WALK = 3; // sidewalk width
const ATLAS = 8; // atlas cells per side
const CELL = 1 / ATLAS;

// Atlas cells (col, row): facades 0..7 in rows 0-1, then road/sidewalk/sand.
const CELL_FACADE = [[0, 0], [1, 0], [2, 0], [3, 0], [0, 1], [1, 1], [2, 1], [3, 1]];
const CELL_ROOF = [4, 0];
const CELL_ROAD = [5, 0];
const CELL_WALK = [6, 0];
const CELL_SAND = [7, 0];
const CELL_GRASS = [4, 1];
const CELL_OCEAN = [5, 1];
const CELL_WOOD = [6, 1];
const CELL_PLAZA = [7, 1];

function cellUV(cell, u0, v0, u1, v1) {
  const inset = 0.012;
  const x0 = (cell[0] + inset) * CELL;
  const y0 = (cell[1] + inset) * CELL;
  const x1 = (cell[0] + 1 - inset) * CELL;
  const y1 = (cell[1] + 1 - inset) * CELL;
  return [
    [x0 + (x1 - x0) * u0, y0 + (y1 - y0) * v0],
    [x0 + (x1 - x0) * u1, y0 + (y1 - y0) * v0],
    [x0 + (x1 - x0) * u1, y0 + (y1 - y0) * v1],
    [x0 + (x1 - x0) * u0, y0 + (y1 - y0) * v1],
  ];
}

const FACADE_BASES = [
  ['#e8dcc8', '#b8c4c9', '#d9a06b', '#c9b8a3'],
  ['#f0e6d2', '#a8b8c4', '#e0b184', '#bfae94'],
  ['#e2cfc0', '#c2cdd4', '#d69a5e', '#cbb59a'],
  ['#ead9c2', '#b0bcc4', '#e3b47e', '#c4ad90'],
];

function drawFacade(ctx, cellX, cellY, night, variant) {
  const px = cellX * 128;
  const py = cellY * 128;
  const base = FACADE_BASES[variant % 4][Math.floor(variant / 4) % 4];
  ctx.fillStyle = night ? '#1c1a22' : base;
  ctx.fillRect(px, py, 128, 128);
  // Slight vertical shade so floors read.
  ctx.fillStyle = night ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.08)';
  ctx.fillRect(px, py + 64, 128, 64);
  // Window grid: 4 across, 4 up.
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const wx = px + 12 + col * 28;
      const wy = py + 12 + row * 28;
      const lit = ((variant * 7 + row * 4 + col) % 5) < 2;
      if (night) ctx.fillStyle = lit ? '#ffd98a' : '#101018';
      else ctx.fillStyle = ((variant + row + col) % 3 === 0) ? '#7fa8c4' : '#2c3a48';
      ctx.fillRect(wx, wy, 18, 20);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(wx, wy, 18, 3);
    }
  }
  // Top trim.
  ctx.fillStyle = night ? '#262230' : '#ffffff';
  ctx.globalAlpha = night ? 0.5 : 0.35;
  ctx.fillRect(px, py, 128, 6);
  ctx.globalAlpha = 1;
}

function drawAtlas(ctx, night) {
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 1024, 1024);
  for (let v = 0; v < 8; v += 1) {
    const [cx, cy] = CELL_FACADE[v];
    drawFacade(ctx, cx, cy, night, v);
  }
  // Roof: plain dark.
  ctx.fillStyle = night ? '#14121a' : '#4a4640';
  ctx.fillRect(CELL_ROOF[0] * 128, CELL_ROOF[1] * 128, 128, 128);
  ctx.fillStyle = night ? '#1e1c26' : '#5d584f';
  for (let i = 0; i < 6; i += 1) ctx.fillRect(CELL_ROOF[0] * 128 + 10 + i * 18, CELL_ROOF[1] * 128 + 20, 10, 10);
  // Road: asphalt with dashes along V.
  ctx.fillStyle = night ? '#17161c' : '#33363b';
  ctx.fillRect(CELL_ROAD[0] * 128, CELL_ROAD[1] * 128, 128, 128);
  ctx.fillStyle = night ? '#2a2830' : '#45484e';
  for (let i = 0; i < 40; i += 1) ctx.fillRect(CELL_ROAD[0] * 128 + ((i * 37) % 128), CELL_ROAD[1] * 128 + ((i * 91) % 128), 2, 2);
  ctx.fillStyle = night ? '#8a7f4d' : '#e8d44d';
  ctx.fillRect(CELL_ROAD[0] * 128 + 62, CELL_ROAD[1] * 128 + 8, 4, 40);
  ctx.fillRect(CELL_ROAD[0] * 128 + 62, CELL_ROAD[1] * 128 + 76, 4, 40);
  // Sidewalk: pale concrete with seams.
  ctx.fillStyle = night ? '#232228' : '#b9b3a6';
  ctx.fillRect(CELL_WALK[0] * 128, CELL_WALK[1] * 128, 128, 128);
  ctx.strokeStyle = night ? '#2e2d33' : '#8f887a';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(CELL_WALK[0] * 128, CELL_WALK[1] * 128 + i * 32);
    ctx.lineTo(CELL_WALK[0] * 128 + 128, CELL_WALK[1] * 128 + i * 32);
    ctx.stroke();
  }
  // Sand.
  ctx.fillStyle = night ? '#3a3230' : '#e3cf9e';
  ctx.fillRect(CELL_SAND[0] * 128, CELL_SAND[1] * 128, 128, 128);
  ctx.fillStyle = night ? '#463c38' : '#d4bd85';
  for (let i = 0; i < 60; i += 1) ctx.fillRect(CELL_SAND[0] * 128 + ((i * 53) % 128), CELL_SAND[1] * 128 + ((i * 29) % 128), 3, 2);
  // Grass.
  ctx.fillStyle = night ? '#1d2b1a' : '#6da24f';
  ctx.fillRect(CELL_GRASS[0] * 128, CELL_GRASS[1] * 128, 128, 128);
  ctx.fillStyle = night ? '#243620' : '#7fb35e';
  for (let i = 0; i < 50; i += 1) ctx.fillRect(CELL_GRASS[0] * 128 + ((i * 41) % 128), CELL_GRASS[1] * 128 + ((i * 67) % 128), 4, 2);
  // Ocean.
  ctx.fillStyle = night ? '#0a1a2e' : '#2e7fb8';
  ctx.fillRect(CELL_OCEAN[0] * 128, CELL_OCEAN[1] * 128, 128, 128);
  ctx.fillStyle = night ? '#12324e' : '#4a9fd4';
  for (let i = 0; i < 8; i += 1) ctx.fillRect(CELL_OCEAN[0] * 128 + 8, CELL_OCEAN[1] * 128 + 10 + i * 15, 112, 3);
  // Wood (pier/dock).
  ctx.fillStyle = night ? '#2a2019' : '#8a6b45';
  ctx.fillRect(CELL_WOOD[0] * 128, CELL_WOOD[1] * 128, 128, 128);
  ctx.strokeStyle = night ? '#3a2d22' : '#6b5133';
  ctx.lineWidth = 3;
  for (let i = 0; i <= 8; i += 1) {
    ctx.beginPath();
    ctx.moveTo(CELL_WOOD[0] * 128, CELL_WOOD[1] * 128 + i * 16);
    ctx.lineTo(CELL_WOOD[0] * 128 + 128, CELL_WOOD[1] * 128 + i * 16);
    ctx.stroke();
  }
  // Plaza tiles.
  ctx.fillStyle = night ? '#26242a' : '#c9bfa9';
  ctx.fillRect(CELL_PLAZA[0] * 128, CELL_PLAZA[1] * 128, 128, 128);
  ctx.strokeStyle = night ? '#35323a' : '#a89c80';
  ctx.lineWidth = 2;
  for (let i = 0; i <= 4; i += 1) {
    ctx.beginPath();
    ctx.moveTo(CELL_PLAZA[0] * 128 + i * 32, CELL_PLAZA[1] * 128);
    ctx.lineTo(CELL_PLAZA[0] * 128 + i * 32, CELL_PLAZA[1] * 128 + 128);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(CELL_PLAZA[0] * 128, CELL_PLAZA[1] * 128 + i * 32);
    ctx.lineTo(CELL_PLAZA[0] * 128 + 128, CELL_PLAZA[1] * 128 + i * 32);
    ctx.stroke();
  }
}

function facadeIndex(x, z) {
  return (Math.abs(Math.floor(x / 70) * 3 + Math.floor(z / 70) * 5) % 8);
}

export function buildCity(gl) {
  const rng = makeRandom(CITY.seed);
  const builder = new MeshBuilder();
  const buildings = [];
  const palms = [];
  const WHITE = [1, 1, 1];

  // ---- Ground base: grass/dirt under everything, then the city plate.
  builder.ground(-900, -900, 900, 900, -0.05, cellUV(CELL_GRASS, 0, 0, 24, 24), [0.9, 0.9, 0.9]);
  builder.ground(-CITY.half - 20, -CITY.half - 20, CITY.half + 20, CITY.oceanZ + 420, 0, cellUV(CELL_PLAZA, 0, 0, 24, 24), [0.92, 0.92, 0.92]);

  // ---- Roads and sidewalks along every street.
  for (const s of STREETS) {
    // North-south street.
    builder.ground(s - ROAD_HALF, -CITY.half, s + ROAD_HALF, CITY.coastZ, 0.02,
      cellUV(CELL_ROAD, 0, 0, 1, 60), WHITE);
    builder.ground(s - ROAD_HALF - WALK, -CITY.half, s - ROAD_HALF, CITY.coastZ, 0.03,
      cellUV(CELL_WALK, 0, 0, 1, 60), WHITE);
    builder.ground(s + ROAD_HALF, -CITY.half, s + ROAD_HALF + WALK, CITY.coastZ, 0.03,
      cellUV(CELL_WALK, 0, 0, 1, 60), WHITE);
    // East-west street.
    builder.ground(-CITY.half, s - ROAD_HALF, CITY.half, s + ROAD_HALF, 0.02,
      cellUV(CELL_ROAD, 0, 0, 60, 1), WHITE);
    builder.ground(-CITY.half, s - ROAD_HALF - WALK, CITY.half, s - ROAD_HALF, 0.03,
      cellUV(CELL_WALK, 0, 0, 60, 1), WHITE);
    builder.ground(-CITY.half, s + ROAD_HALF, CITY.half, s + ROAD_HALF + WALK, 0.03,
      cellUV(CELL_WALK, 0, 0, 60, 1), WHITE);
  }

  // ---- Beach and ocean south of the city.
  builder.ground(-CITY.half - 20, CITY.coastZ, CITY.half + 20, CITY.oceanZ, 0.04,
    cellUV(CELL_SAND, 0, 0, 24, 3), WHITE);
  builder.ground(-900, CITY.oceanZ, 900, 900, 0.02,
    cellUV(CELL_OCEAN, 0, 0, 24, 12), WHITE);
  // Foam strip at the waterline.
  builder.ground(-900, CITY.oceanZ - 2, 900, CITY.oceanZ + 1, 0.05,
    cellUV(CELL_SAND, 0, 0, 24, 0.2), [1, 1, 1]);
  // Coast road along the beach.
  builder.ground(-CITY.half, CITY.coastZ - 12, CITY.half, CITY.coastZ, 0.03,
    cellUV(CELL_ROAD, 0, 0, 60, 1), WHITE);

  // ---- Marina water inlet on the east edge.
  builder.ground(280, -385, 470, 0, 0.03, cellUV(CELL_OCEAN, 0, 0, 6, 12), WHITE);
  // Wooden docks.
  for (const dz of [-320, -240, -160, -80]) {
    builder.ground(300, dz - 2, 400, dz + 2, 0.12, cellUV(CELL_WOOD, 0, 0, 8, 0.4), WHITE);
  }
  builder.ground(288, -360, 296, -20, 0.12, cellUV(CELL_WOOD, 0, 0, 0.6, 24), WHITE);

  // ---- Buildings, one block at a time.
  function addBuilding(cx, cz, w, d, h, facade) {
    const cell = CELL_FACADE[facade];
    const uRep = Math.max(1, Math.round(w / 12));
    const vRep = Math.max(1, Math.round(h / 12));
    const sideUV = cellUV(cell, 0, 0, uRep, vRep);
    const sideUV2 = cellUV(cell, 0, 0, Math.max(1, Math.round(d / 12)), vRep);
    const roofUV = cellUV(CELL_ROOF, 0, 0, 1, 1);
    const x0 = cx - w / 2;
    const x1 = cx + w / 2;
    const z0 = cz - d / 2;
    const z1 = cz + d / 2;
    // +z, -z faces use width-based repeat; +x, -x use depth-based repeat.
    builder.quad([x0, 0, z1], [x1, 0, z1], [x1, h, z1], [x0, h, z1], [0, 0, 1], sideUV, WHITE);
    builder.quad([x1, 0, z0], [x0, 0, z0], [x0, h, z0], [x1, h, z0], [0, 0, -1], sideUV, WHITE);
    builder.quad([x1, 0, z1], [x1, 0, z0], [x1, h, z0], [x1, h, z1], [1, 0, 0], sideUV2, WHITE);
    builder.quad([x0, 0, z0], [x0, 0, z1], [x0, h, z1], [x0, h, z0], [-1, 0, 0], sideUV2, WHITE);
    builder.quad([x0, h, z1], [x1, h, z1], [x1, h, z0], [x0, h, z0], [0, 1, 0], roofUV, WHITE);
    // Rooftop box (AC unit) for silhouette.
    if (h > 10 && rng.chance(0.6)) {
      const bw = rng.range(2, 4);
      builder.box(cx + rng.range(-w / 5, w / 5), h + 0.7, cz + rng.range(-d / 5, d / 5), bw, 1.4, bw, [0.75, 0.75, 0.72]);
    }
    buildings.push({ x0, z0, x1, z1, h });
  }

  function downtown(x, z) {
    return Math.abs(x) < 140 && Math.abs(z) < 140;
  }

  for (let ix = 0; ix < STREETS.length - 1; ix += 1) {
    for (let iz = 0; iz < STREETS.length - 1; iz += 1) {
      const bx0 = STREETS[ix] + ROAD_HALF + WALK;
      const bx1 = STREETS[ix + 1] - ROAD_HALF - WALK;
      const bz0 = STREETS[iz] + ROAD_HALF + WALK;
      const bz1 = STREETS[iz + 1] - ROAD_HALF - WALK;
      const cx = (bx0 + bx1) / 2;
      const cz = (bz0 + bz1) / 2;
      // Marina blocks are water; beach blocks are sand.
      if (bx0 > 280 && bz1 < 0) continue;
      if (bz0 > CITY.coastZ - 12) continue;
      // Downtown plaza: one open block at the centre.
      if (ix === 5 && iz === 5) {
        builder.ground(bx0, bz0, bx1, bz1, 0.04, cellUV(CELL_PLAZA, 0, 0, 4, 4), WHITE);
        // Fountain ring in the middle.
        for (let a = 0; a < 8; a += 1) {
          const ang = (a / 8) * Math.PI * 2;
          builder.box(cx + Math.cos(ang) * 7, 0.5, cz + Math.sin(ang) * 7, 3, 1, 1.2, [0.85, 0.82, 0.75]);
        }
        builder.ground(cx - 5, cz - 5, cx + 5, cz + 5, 0.06, cellUV(CELL_OCEAN, 0, 0, 1, 1), WHITE);
        continue;
      }
      if (rng.chance(0.09)) {
        // Park block: grass, palms, a few benches.
        builder.ground(bx0, bz0, bx1, bz1, 0.04, cellUV(CELL_GRASS, 0, 0, 4, 4), WHITE);
        const n = rng.int(3, 6);
        for (let p = 0; p < n; p += 1) {
          palms.push({ x: rng.range(bx0 + 4, bx1 - 4), z: rng.range(bz0 + 4, bz1 - 4), s: rng.range(0.8, 1.2) });
        }
        continue;
      }
      const tall = downtown(cx, cz);
      const count = tall ? (rng.chance(0.55) ? 1 : 2) : rng.int(1, 2);
      for (let b = 0; b < count; b += 1) {
        const w = tall ? rng.range(26, 42) : rng.range(14, 30);
        const d = tall ? rng.range(26, 42) : rng.range(14, 30);
        const h = tall ? rng.range(28, 68) : rng.range(6, 16);
        const px = count === 1 ? cx : bx0 + w / 2 + 3 + b * ((bx1 - bx0 - w - 6) / Math.max(1, count - 1));
        const pz = count === 1 ? cz : cz + (b % 2 === 0 ? -6 : 6);
        addBuilding(
          clamp(px, bx0 + w / 2, bx1 - w / 2),
          clamp(pz, bz0 + d / 2, bz1 - d / 2),
          w, d, h, facadeIndex(cx, cz),
        );
      }
    }
  }

  // ---- Palms along the coast road and the Strip.
  for (let x = -360; x <= 360; x += 26) {
    if (rng.chance(0.85)) palms.push({ x: x + rng.range(-4, 4), z: CITY.coastZ - 16, s: rng.range(0.9, 1.3) });
  }
  for (let i = 0; i < 26; i += 1) {
    palms.push({ x: rng.range(-140, 210), z: 175 + rng.range(-3, 3), s: rng.range(0.8, 1.2) });
  }

  // ---- Palm meshes (trunk + fronds) baked into the static mesh.
  for (const p of palms) {
    const s = p.s;
    builder.box(p.x, 2.2 * s, p.z, 0.35 * s, 4.4 * s, 0.35 * s, [0.45, 0.32, 0.2]);
    for (let f = 0; f < 6; f += 1) {
      const ang = (f / 6) * Math.PI * 2 + 0.4;
      const dx = Math.cos(ang) * 1.6 * s;
      const dz = Math.sin(ang) * 1.6 * s;
      builder.quad(
        [p.x, 4.4 * s, p.z],
        [p.x + dx, 3.4 * s, p.z + dz],
        [p.x + dx * 0.7, 3.1 * s, p.z + dz * 0.7],
        [p.x, 4.2 * s, p.z],
        [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], [0.16, 0.5, 0.2],
      );
    }
  }

  // ---- Streetlights at every other intersection.
  for (let ix = 0; ix < STREETS.length; ix += 2) {
    for (let iz = 0; iz < STREETS.length; iz += 2) {
      const x = STREETS[ix] + ROAD_HALF + 1;
      const z = STREETS[iz] + ROAD_HALF + 1;
      if (x > 280 && z < 0) continue;
      builder.box(x, 2.6, z, 0.18, 5.2, 0.18, [0.25, 0.25, 0.28]);
      builder.box(x + 0.8, 5.1, z, 1.8, 0.18, 0.18, [0.25, 0.25, 0.28]);
      builder.box(x + 1.6, 5.0, z, 0.7, 0.25, 0.4, [1, 0.95, 0.7]);
    }
  }

  // ---- Lighthouse at the marina point.
  {
    const lx = 330;
    const lz = -380;
    for (let side = 0; side < 8; side += 1) {
      const a0 = (side / 8) * Math.PI * 2;
      const a1 = ((side + 1) / 8) * Math.PI * 2;
      const r0 = 4;
      const r1 = 3;
      const h = 34;
      const stripe = side % 2 === 0 ? [0.9, 0.25, 0.2] : [0.95, 0.95, 0.92];
      builder.quad(
        [lx + Math.cos(a0) * r0, 0, lz + Math.sin(a0) * r0],
        [lx + Math.cos(a1) * r0, 0, lz + Math.sin(a1) * r0],
        [lx + Math.cos(a1) * r1, h, lz + Math.sin(a1) * r1],
        [lx + Math.cos(a0) * r1, h, lz + Math.sin(a0) * r1],
        [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)],
        [[0, 0], [1, 0], [1, 1], [0, 1]], stripe,
      );
    }
    builder.box(lx, 35.5, lz, 7, 3, 7, [0.15, 0.15, 0.18]);
    builder.box(lx, 37.5, lz, 8.5, 1, 8.5, [0.9, 0.2, 0.15]);
  }

  // ---- Beach pier at Coral Beach.
  builder.ground(240, CITY.coastZ - 2, 248, CITY.oceanZ + 40, 0.14, cellUV(CELL_WOOD, 0, 0, 1, 10), WHITE);
  for (const pz of [CITY.oceanZ + 10, CITY.oceanZ + 30]) {
    builder.ground(232, pz - 4, 256, pz + 4, 0.14, cellUV(CELL_WOOD, 0, 0, 4, 1), WHITE);
  }

  // ---- Beach umbrellas.
  for (let i = 0; i < 8; i += 1) {
    const ux = -300 + i * 82 + rng.range(-10, 10);
    const uz = CITY.coastZ + 22 + rng.range(0, 30);
    builder.box(ux, 1.1, uz, 0.12, 2.2, 0.12, [0.9, 0.9, 0.9]);
    const cols = [[0.95, 0.3, 0.25], [0.25, 0.6, 0.9], [0.95, 0.8, 0.3], [0.3, 0.8, 0.5]];
    const c = cols[i % 4];
    builder.quad([ux - 2, 2.4, uz], [ux + 2, 2.4, uz], [ux, 3.4, uz], [ux, 2.4, uz], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]], c);
  }

  const mesh = builder.build(gl);
  const dayTex = makeCanvasTexture(gl, 1024, 1024, (ctx) => drawAtlas(ctx, false));
  const nightTex = makeCanvasTexture(gl, 1024, 1024, (ctx) => drawAtlas(ctx, true));

  // ---- Named spots the missions and the HUD use.
  const spots = {
    garage: { x: 105, z: 245, name: "Soluna Spray & Tune" },
    marina: { x: 320, z: -160, name: "Mira's Boatyard" },
    oldPort: { x: -300, z: -60, name: 'Old Port Warehouses' },
    plaza: { x: 0, z: 0, name: 'Downtown Plaza' },
    strip: { x: 35, z: 175, name: 'The Strip' },
    beach: { x: 300, z: 410, name: 'Coral Beach' },
    vista: { x: -300, z: 300, name: 'Vista Heights' },
    hospital: { x: -175, z: -175, name: 'Soluna General' },
    policeHQ: { x: 175, z: -175, name: 'SBPD Headquarters' },
    market: { x: -35, z: 245, name: 'Night Market' },
  };

  // ---- Road graph: intersections are nodes; streets are edges.
  const nodes = [];
  const nodeIndex = new Map();
  for (const x of STREETS) {
    for (const z of STREETS) {
      if (x > 280 && z < 0) continue; // marina water
      nodeIndex.set(`${x},${z}`, nodes.length);
      nodes.push({ x, z });
    }
  }
  const edges = [];
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    for (const [dx, dz] of [[CITY.block, 0], [-CITY.block, 0], [0, CITY.block], [0, -CITY.block]]) {
      const j = nodeIndex.get(`${n.x + dx},${n.z + dz}`);
      if (j !== undefined && j > i) edges.push([i, j]);
    }
  }
  const adjacency = nodes.map(() => []);
  for (const [a, b] of edges) {
    adjacency[a].push(b);
    adjacency[b].push(a);
  }

  // ---- Collectible sun shells on sidewalks.
  const collectibles = [];
  for (let i = 0; i < 40; i += 1) {
    const s = rng.pick(STREETS);
    const along = rng.range(-350, 350);
    const side = rng.chance(0.5) ? 1 : -1;
    if (rng.chance(0.5)) collectibles.push({ x: s + side * (ROAD_HALF + 1.5), z: along, taken: false });
    else collectibles.push({ x: along, z: s + side * (ROAD_HALF + 1.5), taken: false });
  }

  return {
    mesh, dayTex, nightTex, buildings, palms, spots, nodes, adjacency,
    collectibles,
    bounds: { min: -CITY.half - 10, max: CITY.half + 10 },
    streets: STREETS,
  };
}

/** True when (x, z) is on a road (street or coast road). */
export function isOnRoad(x, z) {
  for (const s of STREETS) {
    if (Math.abs(x - s) <= ROAD_HALF + 0.5 && z >= -CITY.half && z <= CITY.coastZ) return true;
    if (Math.abs(z - s) <= ROAD_HALF + 0.5 && x >= -CITY.half && x <= CITY.half) return true;
  }
  if (z >= CITY.coastZ - 12 && z <= CITY.coastZ && Math.abs(x) <= CITY.half) return true;
  return false;
}

/** The nearest street centreline point to (x, z), for snapping cars to roads. */
export function nearestRoadPoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const s of STREETS) {
    const cz = clamp(z, -CITY.half, CITY.coastZ);
    const d = Math.abs(x - s) + Math.abs(z - cz) * 0.001;
    if (d < bestD) { bestD = d; best = { x: s, z: cz }; }
    const cx = clamp(x, -CITY.half, CITY.half);
    const d2 = Math.abs(z - s) + Math.abs(x - cx) * 0.001;
    if (d2 < bestD) { bestD = d2; best = { x: cx, z: s }; }
  }
  return best;
}

/** Circle (x, z, r) pushed out of every building AABB it overlaps. Returns [x, z]. */
export function collideBuildings(buildings, x, z, r) {
  let nx = x;
  let nz = z;
  for (const b of buildings) {
    if (nx + r < b.x0 || nx - r > b.x1 || nz + r < b.z0 || nz - r > b.z1) continue;
    const dxLeft = nx + r - b.x0;
    const dxRight = b.x1 - (nx - r);
    const dzTop = nz + r - b.z0;
    const dzBottom = b.z1 - (nz - r);
    const m = Math.min(dxLeft, dxRight, dzTop, dzBottom);
    if (m === dxLeft) nx = b.x0 - r;
    else if (m === dxRight) nx = b.x1 + r;
    else if (m === dzTop) nz = b.z0 - r;
    else nz = b.z1 + r;
  }
  return [nx, nz];
}

export function districtNameAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Soluna Bay';
}
