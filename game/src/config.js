// Shared constants for Soluna Bay: city layout, districts, prices, weapons,
// radio stations and the player/crew names. Nothing here is copied from any
// other game; every name is invented for this city.
export const CITY = {
  seed: 20261123,
  // Streets run on a grid; block size is the pitch between street centrelines.
  block: 70,
  streets: 11,
  roadHalf: 6,
  // The city spans x in [-385, 385], z in [-385, 385]; the beach and ocean
  // lie south of z = 385, and the marina cuts into the east edge.
  half: 385,
  coastZ: 385,
  oceanZ: 470,
};

export const DISTRICTS = [
  { name: 'Downtown Soluna', x0: -140, z0: -140, x1: 140, z1: 140, tall: true },
  { name: 'Marina Row', x0: 210, z0: -385, x1: 385, z1: 0, tall: false },
  { name: 'Old Port', x0: -385, z0: -385, x1: -210, z1: 140, tall: false },
  { name: 'Palm Court', x0: -140, z0: 210, x1: 210, z1: 385, tall: false },
  { name: 'Vista Heights', x0: -385, z0: 140, x1: -140, z1: 385, tall: false },
  { name: 'Coral Beach', x0: 210, z0: 210, x1: 385, z1: 385, tall: false },
  { name: 'The Strip', x0: -140, z0: 140, x1: 210, z1: 210, tall: false },
];

export function districtAt(x, z) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return d.name;
  }
  return 'Soluna Bay';
}

export const PLAYER = {
  name: 'Kai Maro',
  walkSpeed: 5.2,
  runSpeed: 8.5,
  radius: 0.55,
  maxHealth: 100,
  maxArmour: 100,
};

export const CREW = {
  luz: { name: 'Luz Ferreira', role: 'Mechanic — runs Soluna Spray & Tune' },
  tito: { name: "Tomas 'Tito' Rook", role: 'Wheelman' },
  mara: { name: 'Mara Solis', role: 'Fixer — finds the jobs' },
  juno: { name: 'Juno Park', role: 'Hacker — eyes on the city' },
};

export const WEAPONS = [
  { id: 'fists', name: 'Fists', damage: 12, range: 2.2, rate: 0.38, ammo: Infinity, mag: Infinity, auto: false, spread: 0 },
  { id: 'pistol', name: 'P9 Pistol', damage: 22, range: 42, rate: 0.22, ammo: 120, mag: 12, auto: false, spread: 0.012 },
  { id: 'smg', name: 'Kobra SMG', damage: 13, range: 38, rate: 0.085, ammo: 240, mag: 30, auto: true, spread: 0.035 },
  { id: 'shotgun', name: '12G Breacher', damage: 34, range: 20, rate: 0.85, ammo: 48, mag: 6, auto: false, spread: 0.09, pellets: 6 },
];

export const GARAGE = {
  repair: { name: 'Full Repair', price: 250 },
  respray: { name: 'Respray', price: 400 },
  armour: { name: 'Armour Plating', price: 3000 },
  engine: { name: 'Engine Tune', price: 4000 },
  nitro: { name: 'Nitro Kit', price: 5500 },
};

export const RADIO = [
  { name: 'SOLUNA FM 98.4', style: 'Island Pop', bpm: 96, root: 57, scale: [0, 3, 5, 7, 10], wave: 'triangle' },
  { name: 'BAY 107.1', style: 'Night Drive', bpm: 118, root: 45, scale: [0, 3, 5, 6, 10], wave: 'sawtooth' },
  { name: 'PALMA 91.3', style: 'Calle Beats', bpm: 104, root: 50, scale: [0, 2, 4, 7, 9], wave: 'square' },
];

export const WANTED_NAMES = {
  1: 'SBPD Patrol',
  2: 'SBPD Response',
  3: 'SBPD Tactical',
  4: 'SBPD Interceptor',
  5: 'SBPD Lockdown',
};

export const POLICE_UNITS = [
  'Mako-1', 'Mako-2', 'Heron-3', 'Gull-4', 'Tern-5', 'Osprey-6',
  'Bastion-7', 'Reef-8', 'Coral-9', 'Dune-10', 'Surf-11', 'Tide-12',
];

export const PRICES = {
  property: [
    { id: 'marina', name: 'Marina Loft', price: 12000, x: 300, z: -140 },
    { id: 'palm', name: 'Palm Court Flat', price: 18000, x: 0, z: 300 },
    { id: 'vista', name: 'Vista Heights House', price: 30000, x: -300, z: 300 },
  ],
  collectibleReward: 250,
  raceReward: 1500,
};

export const SAVE_KEY = 'soluna-bay-save-v1';
