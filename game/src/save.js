// Save slots for Soluna Bay: three slots in localStorage, each with a
// progress percentage so the title screen can show how far a run has come.
// Progress counts missions (70%), races (15%), sun shells (10%) and
// properties (5%).
import { SAVE_KEY } from './config.js';

function readAll() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return { slots: [null, null, null] };
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.slots)) return { slots: [null, null, null] };
    while (data.slots.length < 3) data.slots.push(null);
    return data;
  } catch {
    return { slots: [null, null, null] };
  }
}

function writeAll(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function progressPercent(save) {
  const missions = (save.missionsCompleted?.length || 0) * 8.75;
  const races = (save.racesWon?.length || 0) * 5;
  const shells = (save.shells || 0) * 0.25;
  const props = (save.properties?.length || 0) * (5 / 3);
  return Math.min(100, Math.round(missions + races + shells + props));
}

export function listSlots() {
  const data = readAll();
  return data.slots.map((slot, i) => {
    if (!slot) return { index: i, empty: true };
    return {
      index: i,
      empty: false,
      money: slot.money,
      rank: slot.rank,
      day: slot.day,
      progress: progressPercent(slot),
      savedAt: slot.savedAt,
    };
  });
}

export function saveToSlot(index, save) {
  const data = readAll();
  data.slots[index] = {
    ...save,
    savedAt: new Date().toISOString(),
  };
  return writeAll(data);
}

export function loadFromSlot(index) {
  const data = readAll();
  return data.slots[index] || null;
}

export function snapshotState(game) {
  const player = game.playerApi.player;
  const missions = game.missionsApi.state;
  return {
    money: player.money,
    respect: player.respect,
    rank: player.rank,
    health: player.health,
    armour: player.armour,
    missionsCompleted: [...missions.completed],
    missionAvailable: missions.available,
    racesWon: Object.keys(missions.races.best),
    shells: game.city.collectibles.filter((s) => s.taken).length,
    shellsTaken: game.city.collectibles.map((s) => (s.taken ? 1 : 0)),
    properties: [...game.properties],
    garage: { ...game.garageUpgrades },
    weapons: player.weapons.map((w) => ({ id: w.id, magAmmo: w.magAmmo, reserve: w.reserve })),
    x: player.x,
    z: player.z,
    day: game.worldApi.world.day,
    clock: game.worldApi.world.clock,
  };
}

export function applySnapshot(game, save) {
  const player = game.playerApi.player;
  player.money = save.money;
  player.respect = save.respect;
  playerApiRank(game, save.rank);
  player.health = save.health ?? 100;
  player.armour = save.armour ?? 0;
  player.x = save.x ?? 300;
  player.z = save.z ?? -120;
  const missions = game.missionsApi.state;
  missions.completed = [...(save.missionsCompleted || [])];
  missions.available = save.missionAvailable ?? missions.completed.length;
  missions.races.best = {};
  for (const id of save.racesWon || []) missions.races.best[id] = 30;
  game.city.collectibles.forEach((shell, i) => {
    shell.taken = !!(save.shellsTaken && save.shellsTaken[i]);
  });
  game.properties = [...(save.properties || [])];
  game.garageUpgrades = { ...(save.garage || {}) };
  if (save.weapons) {
    for (const saved of save.weapons) {
      const w = player.weapons.find((x) => x.id === saved.id);
      if (w) {
        w.magAmmo = saved.magAmmo;
        w.reserve = saved.reserve;
      }
    }
  }
  game.worldApi.world.day = save.day ?? 1;
  game.worldApi.world.clock = save.clock ?? (9 * 3600 + 23 * 60);
}

function playerApiRank(game, rank) {
  game.playerApi.player.rank = rank || 'Nobody';
}
