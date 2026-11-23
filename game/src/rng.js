// Deterministic seeded random numbers. Same seed, same city, same frame.
export function makeRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
  return {
    next() {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    range(lo, hi) {
      return lo + this.next() * (hi - lo);
    },
    int(lo, hi) {
      return Math.floor(this.range(lo, hi + 1));
    },
    pick(list) {
      return list[Math.floor(this.next() * list.length)];
    },
    chance(p) {
      return this.next() < p;
    },
  };
}

// A tiny string hash, so a name or a seed word becomes a number.
export function hashSeed(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Smooth value noise in 2D, for gentle height and colour variation.
export function noise2(rng, x, z) {
  const xi = Math.floor(x);
  const zi = Math.floor(z);
  const xf = x - xi;
  const zf = z - zi;
  const s = (a, b) => {
    const r = makeRng(a * 374761393 + b * 668265263 + 0x5bf03635);
    return r.next();
  };
  const u = xf * xf * (3 - 2 * xf);
  const v = zf * zf * (3 - 2 * zf);
  const a = s(xi, zi);
  const b = s(xi + 1, zi);
  const c = s(xi, zi + 1);
  const d = s(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
