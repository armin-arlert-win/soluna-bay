// SOLUNA BAY — the HUD: bars, stars, tracker, weapons, and the minimap.
// All DOM, no game logic; main.js tells it which screen is showing.
import { WEAPONS, UPGRADES, PROPERTIES, GARAGE, rankFor, districtAt } from './config.js';
import { MISSIONS, RACES } from './missions.js';

function el(id) {
  return document.getElementById(id);
}
function fmtMoney(n) {
  return `$${Math.floor(n).toLocaleString('en-US')}`;
}
function fmtClock(minutes) {
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const day = Math.floor(minutes / (24 * 60)) + 1;
  return `Day ${day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export class Hud {
  constructor() {
    this._lastText = {};
    this._weaponSlots = [];
    const box = el('weapons');
    if (box) {
      for (let i = 0; i < WEAPONS.length; i += 1) {
        const d = document.createElement('div');
        d.className = 'wslot';
        box.appendChild(d);
        this._weaponSlots.push(d);
      }
    }
  }
  _set(id, text) {
    if (this._lastText[id] === text) return;
    this._lastText[id] = text;
    const n = el(id);
    if (n) n.textContent = text;
  }
  update(world, screen) {
    const p = world.player;
    const hf = el('health-fill');
    if (hf) hf.style.width = `${p.health}%`;
    const af = el('armour-fill');
    if (af) af.style.width = `${p.armour}%`;
    this._set('money', fmtMoney(p.money));
    this._set('clock', fmtClock(world.clock));
    this._set('district', districtAt(p.x, p.z));
    this._set('rank', rankFor(p.respect));
    const stars = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
    this._set('wanted', stars);
    const wEl = el('wanted');
    if (wEl) wEl.classList.toggle('hot', p.wanted >= 3);
    // Mission tracker.
    const m = world.mission.active;
    if (m) {
      this._set('mission-title', `JOB — ${m.def.name}`);
      const obj = m.def.objectives[m.objIdx];
      this._set('mission-objective', obj ? obj.label : '');
    } else {
      const next = MISSIONS[world.mission.next];
      this._set('mission-title', next ? `Next job: ${next.name}` : 'All jobs done');
      this._set('mission-objective', next ? 'Press J to start' : 'The Bay is yours');
    }
    // Weapons.
    for (let i = 0; i < WEAPONS.length; i += 1) {
      const d = this._weaponSlots[i];
      if (!d) continue;
      const w = WEAPONS[i];
      const mag = p.mag[i] === Infinity ? '∞' : p.mag[i];
      const res = p.ammo[i] === Infinity ? '∞' : p.ammo[i];
      d.textContent = `${i + 1} ${w.name} ${mag}/${res}`;
      d.classList.toggle('active', p.weapon === i);
    }
    // Speed and car condition.
    const spd = p.onFoot ? p.speed * 3.6 : (p.car ? Math.abs(p.car.speed) * 3.6 : 0);
    this._set('speed', p.onFoot ? '' : `${Math.round(spd)} km/h`);
    const ch = el('car-hp');
    if (ch) {
      ch.style.display = p.onFoot ? 'none' : 'block';
      const f = el('car-hp-fill');
      if (f && p.car) f.style.width = `${Math.max(0, p.car.hp)}%`;
    }
    this._set('radio', world.audio ? world.audio.stationName() : '');
    // Passenger.
    this._set('passenger', p.passenger ? `Passenger: ${p.passenger}` : '');
    // Subtitle, banner, messages.
    const sub = el('subtitle');
    if (sub) sub.textContent = world.subtitle || '';
    const ban = el('banner');
    if (ban) ban.textContent = world.banner || '';
    const msgs = el('messages');
    if (msgs) {
      const text = world.messages.map((x) => x.text).join('\n');
      if (this._lastText.messages !== text) {
        this._lastText.messages = text;
        msgs.textContent = text;
      }
    }
    // Crosshair shows only when armed and on foot.
    const ch2 = el('crosshair');
    if (ch2) ch2.style.display = p.weapon > 0 && p.onFoot ? 'block' : 'none';
    // Contextual prompt.
    this._updatePrompt(world, screen);
    // Minimap.
    const mm = el('minimap');
    if (mm) this.drawMap(mm, world, 1);
    const big = el('bigmap');
    if (big && screen === 'map') this.drawMap(big, world, 3.2);
  }
  _updatePrompt(world, screen) {
    const p = world.player;
    let text = '';
    if (screen === 'play' && p.onFoot) {
      const car = world._nearestCar(4.5);
      if (car) text = `E — Drive the ${car.type.name}`;
      else {
        for (const prop of PROPERTIES) {
          const d = Math.hypot(p.x - prop.x, p.z - prop.z);
          if (d < 5.5) {
            text = p.properties.has(prop.id)
              ? 'Q — Save game here'
              : `E — Buy the ${prop.name} (${fmtMoney(prop.price)})`;
            break;
          }
        }
        if (!text) {
          for (const r of RACES) {
            if (Math.hypot(p.x - r.start.x, p.z - r.start.z) < 6 && !p.racesDone.includes(r.id)) {
              text = `E — Start ${r.name} ($${r.entry} entry)`;
              break;
            }
          }
        }
      }
    } else if (screen === 'play' && !p.onFoot) {
      if (Math.hypot(p.x - GARAGE.x, p.z - GARAGE.z) < 9) text = 'E — Calder Auto Works (upgrades)';
      else text = 'E — Get out';
    }
    this._set('prompt', text);
  }
  drawMap(canvas, world, scale) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const S = canvas.width;
    const half = 240;
    const px = (x) => ((x + half) / (half * 2)) * S;
    const pz = (z) => ((z + half) / (half * 2)) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#1d2b1a';
    ctx.fillRect(0, 0, S, S);
    // Ocean and beach on the west.
    ctx.fillStyle = '#14567e';
    ctx.fillRect(0, 0, px(-280), S);
    ctx.fillStyle = '#dcc78f';
    ctx.fillRect(px(-280), 0, px(-220) - px(-280), S);
    // Roads.
    ctx.strokeStyle = '#3a3f46';
    ctx.lineWidth = Math.max(2, 4 * scale);
    for (const c of [-200, -160, -120, -80, -40, 0, 40, 80, 120, 160, 200]) {
      ctx.beginPath();
      ctx.moveTo(px(c), 0);
      ctx.lineTo(px(c), S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pz(c));
      ctx.lineTo(S, pz(c));
      ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px(x), pz(z), r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Properties.
    for (const prop of PROPERTIES) {
      dot(prop.x, prop.z, 3.5, world.player.properties.has(prop.id) ? '#7dff9b' : '#e8b23a');
    }
    dot(GARAGE.x, GARAGE.z, 3.5, '#7fd4ff');
    // Collectibles still out there.
    world.city.collectibles.forEach((c, i) => {
      if (!c.taken && !world.player.collected.has(i)) dot(c.x, c.z, 1.6, '#ffe9a8');
    });
    // Mission target.
    const target = world._missionTarget();
    if (target && target.x !== undefined) {
      ctx.fillStyle = '#ffd23a';
      const x = px(target.x);
      const y = pz(target.z);
      ctx.beginPath();
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x + 6, y);
      ctx.lineTo(x, y + 7);
      ctx.lineTo(x - 6, y);
      ctx.closePath();
      ctx.fill();
    }
    // Race starts.
    for (const r of RACES) {
      if (!world.player.racesDone.includes(r.id)) dot(r.start.x, r.start.z, 3, '#ff7a5c');
    }
    // Police.
    for (const car of world.cars) {
      if (car.kind === 'police' && !car.parked) dot(car.x, car.z, 3, '#4a9fd8');
    }
    if (world.heli.active) dot(world.heli.x, world.heli.z, 4, '#ff5c5c');
    // Player arrow.
    const p = world.player;
    ctx.save();
    ctx.translate(px(p.x), pz(p.z));
    ctx.rotate(Math.PI - p.heading); // map north is -z; canvas rotation is clockwise
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  showTitle(slots) {
    const t = el('title');
    if (t) t.style.display = 'flex';
    const list = el('title-slots');
    if (list) {
      list.innerHTML = '';
      slots.forEach((s, i) => {
        const d = document.createElement('div');
        d.className = 'slot';
        d.textContent = s ? `Slot ${i + 1} — ${s.progress}% complete — Day ${s.day}` : `Slot ${i + 1} — empty`;
        list.appendChild(d);
      });
    }
  }
  hideTitle() {
    const t = el('title');
    if (t) t.style.display = 'none';
  }
  setOverlay(id, show) {
    const n = el(id);
    if (n) n.style.display = show ? 'flex' : 'none';
  }
  fillGarage(world) {
    const list = el('garage-list');
    if (!list) return;
    list.innerHTML = '';
    UPGRADES.forEach((u, i) => {
      const d = document.createElement('div');
      d.className = 'gitem';
      const owned = world.player.upgrades[u.id] && u.id !== 'repair' && u.id !== 'respray';
      d.textContent = `${i + 1}. ${u.name} — ${fmtMoney(u.price)}${owned ? ' (installed)' : ''} — ${u.desc}`;
      list.appendChild(d);
    });
  }
}
