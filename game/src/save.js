// SOLUNA BAY — saves. Three slots in localStorage, each holding a snapshot
// of the player's progress. The title screen shows each slot's progress %.
const KEY = (slot) => `soluna-bay-save-${slot}`;

export function readSlots() {
  const out = [null, null, null];
  for (let i = 0; i < 3; i += 1) {
    try {
      const raw = window.localStorage.getItem(KEY(i + 1));
      if (raw) out[i] = JSON.parse(raw);
    } catch {
      out[i] = null;
    }
  }
  return out;
}

export function slotSummary(slot) {
  if (!slot) return null;
  const done = slot.missionsDone.length * 3 + slot.racesDone.length
    + slot.collected.length * 0.5 + slot.properties.length * 2;
  const total = 8 * 3 + 3 + 40 * 0.5 + 3 * 2;
  return {
    progress: Math.min(100, Math.round((done / total) * 100)),
    day: Math.floor(slot.clock / (24 * 60)) + 1,
    money: slot.money,
  };
}

export function saveSlot(slot, snapshot) {
  try {
    window.localStorage.setItem(KEY(slot), JSON.stringify({ ...snapshot, savedAt: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

export function loadSlot(slot) {
  try {
    const raw = window.localStorage.getItem(KEY(slot));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
