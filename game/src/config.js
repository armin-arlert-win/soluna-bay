// SOLUNA BAY — shared constants. All names, places and numbers are original.
export const GRID = 11; // blocks per side
export const PITCH = 40; // block + road, in metres
export const BLOCK = 30; // block width
export const ROAD_HALF = 5; // half road width
export const HALF = 220; // city edge
export const SEA_EDGE = -280; // ocean begins west of here
export const ROAD_CENTERS = [-200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200];
export const STEP = 1 / 60; // fixed simulation step
export const DAY_SECONDS = 24 * 60; // one in-game day = 24 real minutes

export const START = { x: 6, z: 14, heading: Math.PI, money: 250, health: 100 };

// Districts, by quadrant and band. Order matters: first match wins.
export function districtAt(x, z) {
  if (x < -160) return 'Beachfront';
  if (z > 140) return 'The Docks';
  if (z < -140) return 'Northgate';
  if (x > 140) return 'Palm Heights';
  if (Math.abs(x) < 70 && Math.abs(z) < 70) return 'Downtown';
  if (x < 0 && z < 0) return 'Old Town';
  if (x >= 0 && z < 0) return 'Coral Row';
  if (x < 0) return 'The Marina';
  return 'The Strip';
}

export const CREW = [
  { id: 'dario', name: 'Dario Voss', role: 'Fixer', color: '#e8b23a', skill: 'Jobs & payouts' },
  { id: 'nia', name: 'Nia Calder', role: 'Mechanic', color: '#7fd4ff', skill: 'Tuned rides' },
  { id: 'rex', name: 'Rex Tallow', role: 'Muscle', color: '#ff7a5c', skill: 'Backup' },
  { id: 'ivy', name: 'Ivy Santoro', role: 'Hacker', color: '#b78cff', skill: 'Cams & relays' },
  { id: 'milo', name: 'Milo Ferran', role: 'Racer', color: '#7dff9b', skill: 'Getaway lines' },
];

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 14, range: 2.4, rate: 0.45, mag: Infinity, auto: false, slot: 1 },
  { id: 'pistol', name: 'P9 Pistol', damage: 26, range: 60, rate: 0.3, mag: 12, auto: false, slot: 2 },
  { id: 'smg', name: 'Vex SMG', damage: 15, range: 48, rate: 0.09, mag: 30, auto: true, slot: 3 },
  { id: 'shotgun', name: 'Riot Shotgun', damage: 60, range: 24, rate: 0.95, mag: 6, auto: false, slot: 4 },
];

export const CAR_TYPES = [
  { id: 'clipper', name: 'Clipper', top: 26, accel: 15, grip: 1.0, len: 4.4, wid: 1.9, price: 0 },
  { id: 'comet', name: 'Comet', top: 35, accel: 21, grip: 1.18, len: 4.2, wid: 1.9, price: 0 },
  { id: 'bison', name: 'Bison', top: 23, accel: 12, grip: 0.92, len: 5.2, wid: 2.1, price: 0 },
  { id: 'sable', name: 'Sable', top: 31, accel: 18, grip: 1.08, len: 4.5, wid: 1.9, price: 0 },
  { id: 'mule', name: 'Mule', top: 21, accel: 11, grip: 0.86, len: 4.8, wid: 2.0, price: 0 },
  { id: 'cruiser', name: 'SBPD Cruiser', top: 33, accel: 20, grip: 1.12, len: 4.6, wid: 2.0, price: 0 },
];

export const CAR_COLORS = [0xc23b2e, 0x2e6fc2, 0xe0a52e, 0x3aa655, 0x8a5fc2, 0xd8d8d8, 0x2b2b2b, 0xe07a2e];

export const UPGRADES = [
  { id: 'repair', name: 'Full repair', price: 100, desc: 'Bodywork back to 100%' },
  { id: 'respray', name: 'Respray', price: 150, desc: 'A fresh coat of paint' },
  { id: 'armour', name: 'Armour plating', price: 500, desc: 'Takes twice the beating' },
  { id: 'engine', name: 'Tuned engine', price: 800, desc: '+25% top speed and pull' },
  { id: 'nitro', name: 'Nitro kit', price: 600, desc: 'Hold Shift for a boost' },
];

export const PROPERTIES = [
  { id: 'beach', name: 'Beach House', price: 4000, x: -196, z: 96, desc: 'A shack with a view of the bay' },
  { id: 'loft', name: 'Downtown Loft', price: 9000, x: 52, z: -28, desc: 'Above the Coral Row arcades' },
  { id: 'warehouse', name: 'Marina Warehouse', price: 15000, x: -120, z: 168, desc: 'Room for the whole crew' },
];

export const GARAGE = { x: -120, z: 160, name: 'Calder Auto Works' };

export const RANKS = [
  { at: 0, name: 'Nobody' },
  { at: 150, name: 'Hustler' },
  { at: 400, name: 'Runner' },
  { at: 800, name: 'Lieutenant' },
  { at: 1500, name: 'Kingpin of the Bay' },
];

export function rankFor(respect) {
  let rank = RANKS[0];
  for (const r of RANKS) if (respect >= r.at) rank = r;
  return rank.name;
}

export const RADIO = [
  { id: 'sol', name: 'SOL 98.4 — Sunset FM', bpm: 96, root: 220, mood: 'major' },
  { id: 'tide', name: 'TIDE 101.1 — Night Drive', bpm: 76, root: 174, mood: 'minor' },
  { id: 'volt', name: 'VOLT 104.7 — Street Pulse', bpm: 128, root: 196, mood: 'minor' },
];

export const COLLECTIBLE_COUNT = 40;
export const WANTED_MAX = 5;

// Colours used by the renderer (0xRRGGBB).
export const PALETTE = {
  asphalt: 0x2e3138,
  asphaltLine: 0xd8d2a8,
  roadYellow: 0xd8b52e,
  sidewalk: 0x9a938a,
  grass: 0x4d8a3f,
  sand: 0xdcc78f,
  water: 0x1e6f9e,
  waterDeep: 0x14567e,
  plaza: 0xb8a88f,
  roof: 0x6b5a4a,
  glass: 0x7fb8d8,
  trunk: 0x6b4a2a,
  leaf: 0x3f7a34,
  palmLeaf: 0x4d9a3f,
  lamp: 0x3a3f46,
  pier: 0x8a6a44,
  heli: 0x20242a,
};
