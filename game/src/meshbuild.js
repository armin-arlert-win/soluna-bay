// SOLUNA BAY — turns the city data into one static WebGL mesh.
// Built once per seed; the frame loop only draws it.
import { GRID, PITCH, BLOCK, ROAD_CENTERS, PALETTE } from './config.js';
import { Mesh } from './gl.js';

function shade(hex, f) {
  const r = Math.min(255, Math.round(((hex >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((hex >> 8) & 255) * f));
  const b = Math.min(255, Math.round((hex & 255) * f));
  return (r << 16) | (g << 8) | b;
}

export function buildStaticMesh(city) {
  const m = new Mesh();
  const H = city.half;

  // Ground: grass base, ocean to the west, sand beach between.
  m.ground(-420, -H - 20, 240, H + 20, 0, PALETTE.grass);
  m.ground(-420, -H - 20, -280, H + 20, 0.12, PALETTE.waterDeep);
  m.ground(-420, -H - 20, -280, H + 20, 0.14, PALETTE.water);
  m.ground(-280, -H - 20, -220, H + 20, 0.06, PALETTE.sand);

  // Roads: asphalt strips both ways, with dashed centre lines.
  for (const c of ROAD_CENTERS) {
    m.ground(c - 5, -H, c + 5, H, 0.02, PALETTE.asphalt);
    m.ground(-H, c - 5, H, c + 5, 0.02, PALETTE.asphalt);
    for (let d = -H + 8; d < H - 8; d += 14) {
      m.ground(c - 0.18, d, c + 0.18, d + 5, 0.03, PALETTE.asphaltLine);
      m.ground(d, c - 0.18, d + 5, c + 0.18, 0.03, PALETTE.asphaltLine);
    }
  }

  // Blocks: sidewalks, then the block's own ground by kind.
  const kindAt = (cx, cz) => {
    for (const p of city.parks) if (p.x === cx && p.z === cz) return 'park';
    for (const p of city.plazas) if (p.x === cx && p.z === cz) return 'plaza';
    for (const p of city.parking) if (p.x === cx && p.z === cz) return 'parking';
    return 'built';
  };
  for (let bi = 0; bi < GRID - 1; bi += 1) {
    for (let bj = 0; bj < GRID - 1; bj += 1) {
      const cx = ROAD_CENTERS[bi] + PITCH / 2;
      const cz = ROAD_CENTERS[bj] + PITCH / 2;
      const kind = kindAt(cx, cz);
      m.ground(cx - 17, cz - 17, cx + 17, cz + 17, 0.01, PALETTE.sidewalk);
      if (kind === 'park') {
        m.ground(cx - 15, cz - 15, cx + 15, cz + 15, 0.015, PALETTE.grass);
      } else if (kind === 'plaza') {
        m.ground(cx - 15, cz - 15, cx + 15, cz + 15, 0.015, PALETTE.plaza);
        // Fountain in the middle of Soluna Plaza.
        m.prism(cx, 0.02, cz, 6, 0.9, 12, 0x9a938a, 0xb8b0a2);
        m.prism(cx, 0.7, cz, 5.2, 0.25, 12, 0x2e7fb8, 0x4a9fd8);
        m.prism(cx, 0.7, cz, 0.7, 3.2, 8, 0xcfc8b8, 0xe8e0d0);
        m.prism(cx, 3.8, cz, 1.6, 0.3, 8, 0x2e7fb8, 0x4a9fd8);
      } else if (kind === 'parking') {
        m.ground(cx - 15, cz - 15, cx + 15, cz + 15, 0.015, PALETTE.asphalt);
        // A few parked cars, plain grey.
        for (let i = 0; i < 4; i += 1) {
          const px = cx - 10 + (i % 2) * 20;
          const pz = cz - 7 + Math.floor(i / 2) * 14;
          m.box(px, 0.5, pz, 4.2, 0.9, 1.9, 0x8a8a92, 0x9a9aa2);
          m.box(px, 1.15, pz, 2.2, 0.6, 1.7, 0x6a6a72, 0x6a6a72);
        }
      }
    }
  }

  // Buildings: base, glass band on towers, roof cap.
  for (const b of city.buildings) {
    m.box(b.x, 0.75, b.z, b.w + 0.6, 1.5, b.d + 0.6, shade(b.color, 0.55));
    m.box(b.x, b.h / 2 + 1, b.z, b.w, b.h, b.d, b.color, b.roof);
    if (b.h > 18) {
      m.box(b.x, b.h * 0.62, b.z, b.w + 0.15, 1.4, b.d + 0.15, PALETTE.glass);
    }
    m.box(b.x, b.h + 1.4, b.z, b.w * 0.7, 0.8, b.d * 0.7, b.roof, b.roof);
  }

  // Trees and palms.
  for (const t of city.trees) {
    m.prism(t.x, 0, t.z, 0.28, t.h, 6, PALETTE.trunk);
    if (t.palm) {
      m.box(t.x, t.h + 0.4, t.z, 4.2, 0.35, 4.2, PALETTE.palmLeaf);
      m.box(t.x, t.h + 0.8, t.z, 2.6, 0.3, 2.6, shade(PALETTE.palmLeaf, 1.2));
    } else {
      m.box(t.x, t.h + 1.0, t.z, 2.6, 2.2, 2.6, PALETTE.leaf);
      m.box(t.x, t.h + 2.4, t.z, 1.7, 1.4, 1.7, shade(PALETTE.leaf, 1.25));
    }
  }

  // Street lamps.
  for (const l of city.lamps) {
    m.prism(l.x, 0, l.z, 0.12, 5.2, 6, PALETTE.lamp);
    m.box(l.x, 5.35, l.z, 1.0, 0.25, 0.4, 0xd8d8c8, 0xf8f4d8);
  }

  // The pier: deck, posts, end platform and a bait hut.
  const pier = city.pier;
  m.box((pier.x0 + pier.x1) / 2, 0.5, pier.z, pier.x0 - pier.x1, 0.8, pier.width, PALETTE.pier, shade(PALETTE.pier, 1.15));
  for (let x = pier.x0 - 6; x > pier.x1; x -= 12) {
    m.prism(x, -0.4, pier.z - 3.4, 0.35, 1.6, 6, PALETTE.trunk);
    m.prism(x, -0.4, pier.z + 3.4, 0.35, 1.6, 6, PALETTE.trunk);
  }
  m.box(pier.x1 + 4, 0.6, pier.z, 14, 1.0, 14, PALETTE.pier, shade(PALETTE.pier, 1.15));
  m.box(pier.x1 + 4, 2.2, pier.z - 3, 5, 3.2, 5, 0x7a5a44, 0x9a7a54);

  // The lighthouse: striped tower on the point.
  const lh = city.lighthouse;
  const bands = [0xf2ede2, 0xc23b2e, 0xf2ede2, 0xc23b2e, 0xf2ede2];
  const bandH = lh.h / bands.length;
  for (let i = 0; i < bands.length; i += 1) {
    const r = 4.2 - (i * 0.55);
    m.prism(lh.x, i * bandH, lh.z, r, bandH + 0.1, 10, bands[i], bands[i]);
  }
  m.prism(lh.x, lh.h, lh.z, 2.2, 2.6, 8, 0x2b2f36, 0x2b2f36);
  m.box(lh.x, lh.h + 3.4, lh.z, 2.4, 1.6, 2.4, 0xffe9a8, 0xfff6c8);

  // Boats moored off the pier, and beach umbrellas.
  const boats = [[-316, 96, 0.4], [-330, -58, -0.7], [-300, 168, 0.2]];
  for (const [bx, bz, rot] of boats) {
    m.rbox(bx, 0.5, bz, 7, 1.0, 2.6, rot, 0xe8e4da, 0xe8e4da);
    m.rbox(bx, 1.3, bz, 3.4, 1.0, 2.0, rot, 0x3a6a8a, 0x4a7a9a);
    m.prism(bx, 1.0, bz, 0.12, 4.5, 5, PALETTE.trunk);
  }
  for (const [ux, uz] of [[-238, 120], [-244, -40], [-236, -120]]) {
    m.prism(ux, 0, uz, 0.1, 2.2, 5, 0xd8d8d8);
    m.prism(ux, 2.2, uz, 2.0, 0.25, 8, 0xe07a2e, 0xe89a4a);
  }
  return m;
}
