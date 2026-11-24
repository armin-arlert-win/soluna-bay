// SOLUNA BAY — the HUD: bars, stars, tracker, weapons, and the minimap.
// All DOM, no game logic; main.js tells it which screen is showing.
import { WEAPONS, UPGRADES, PROPERTIES, GARAGE, CREW, RANKS, ROAD_CENTERS, BLOCK, rankFor, districtAt } from './config.js';
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
    this._crewRows = [];
    const box = el('weapons');
    if (box) {
      for (let i = 0; i < WEAPONS.length; i += 1) {
        const d = document.createElement('div');
        d.className = 'wslot';
        box.appendChild(d);
        this._weaponSlots.push(d);
      }
    }
    // Crew roster: built once from CREW; update() only toggles the
    // highlight for the passenger and the current job's giver.
    const crew = el('crew');
    if (crew) {
      const h = document.createElement('h3');
      h.textContent = 'CREW';
      crew.appendChild(h);
      for (const c of CREW) {
        const d = document.createElement('div');
        d.className = 'crow';
        const dot = document.createElement('span');
        dot.className = 'cdot';
        dot.style.background = c.color;
        const nm = document.createElement('b');
        nm.textContent = c.name;
        const rl = document.createElement('span');
        rl.textContent = ` · ${c.role}`;
        const sk = document.createElement('i');
        sk.textContent = c.skill;
        d.append(dot, nm, rl, sk);
        crew.appendChild(d);
        this._crewRows.push({ id: c.id, name: c.name, el: d });
      }
    }
    const ch = el('car-hp');
    this._carLabel = ch ? ch.querySelector('span') : null;
    this._missionBar = el('mission-bar');
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
    // Respect progress: how far to the next rank.
    let nextRank = null;
    for (const r of RANKS) {
      if (r.at > p.respect) { nextRank = r; break; }
    }
    this._set('rp', nextRank ? `RP ${p.respect} · next ${nextRank.name} at ${nextRank.at}` : `RP ${p.respect} · MAX RANK`);
    const stars = '★'.repeat(p.wanted) + '☆'.repeat(5 - p.wanted);
    this._set('wanted', stars);
    const wEl = el('wanted');
    if (wEl) wEl.classList.toggle('hot', p.wanted >= 3);
    // Mission tracker: staged progress while a job runs, and a pursuit
    // readout while the heat is on with no job — so the chase cover shows
    // the pursuit, never the generic "Next job" banner.
    const m = world.mission.active;
    const barFill = el('mission-bar-fill');
    if (m) {
      this._set('mission-title', `JOB — ${m.def.name}`);
      const obj = m.def.objectives[m.objIdx];
      this._set('mission-objective', obj ? obj.label : '');
      const total = m.def.objectives.length;
      const stage = Math.min(m.objIdx + 1, total);
      this._set('mission-stage', `STAGE ${stage}/${total} · $${m.def.reward.money} + ${m.def.reward.respect} RP`);
      if (barFill) barFill.style.width = `${Math.round((stage / total) * 100)}%`;
      if (this._missionBar) this._missionBar.style.display = 'block';
    } else if (p.wanted > 0) {
      const units = world.cars.filter((c) => c.kind === 'police').length + (world.heli.active ? 1 : 0);
      this._set('mission-title', 'PURSUIT — Lose the SBPD');
      this._set('mission-objective', `${stars} · ${units} unit${units === 1 ? '' : 's'} closing in — break line of sight`);
      this._set('mission-stage', world.heli.active ? 'AIR-1 overhead · roadblocks ahead' : 'Roadblocks ahead');
      if (barFill) barFill.style.width = '0%';
      if (this._missionBar) this._missionBar.style.display = 'none';
    } else {
      const next = MISSIONS[world.mission.next];
      this._set('mission-title', next ? `Next job: ${next.name}` : 'All jobs done');
      this._set('mission-objective', next ? 'Press J to start' : 'The Bay is yours');
      const giver = next ? CREW.find((c) => c.id === next.giver) : null;
      this._set('mission-stage', next ? `Giver: ${giver ? giver.name : next.giver} · $${next.reward.money} + ${next.reward.respect} RP` : '');
      if (barFill) barFill.style.width = '0%';
      if (this._missionBar) this._missionBar.style.display = 'none';
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
    // Speed and car condition: name the ride, not just its bar.
    const spd = p.onFoot ? p.speed * 3.6 : (p.car ? Math.abs(p.car.speed) * 3.6 : 0);
    this._set('speed', p.onFoot ? '' : `${Math.round(spd)} km/h`);
    const ch = el('car-hp');
    if (ch) {
      ch.style.display = p.onFoot ? 'none' : 'block';
      const f = el('car-hp-fill');
      if (f && p.car) f.style.width = `${Math.max(0, p.car.hp)}%`;
      if (this._carLabel) {
        this._carLabel.textContent = p.car
          ? `${p.car.type.name.toUpperCase()} — ${Math.max(0, Math.round(p.car.hp))}%`
          : 'CAR';
      }
    }
    this._set('radio', world.audio ? world.audio.stationName() : '');
    // Police dispatch and crew roster, live.
    this._updateDispatch(world);
    this._updateCrew(world);
    // Passenger.
    this._set('passenger', p.passenger ? `Passenger: ${p.passenger}` : '');
    // Subtitle, banner, messages. A spoken line ("Name: ...") gets a
    // portrait tile — the speaker's initial in their crew colour — the
    // low-poly equivalent of the leaders' character portraits next to
    // their dialogue. Plain lines render as before.
    const sub = el('subtitle');
    if (sub) {
      const text = world.subtitle || '';
      if (this._lastText.subtitle !== text) {
        this._lastText.subtitle = text;
        if (!text) {
          sub.textContent = '';
        } else {
          const m = text.match(/^([^:]+):\s*(.*)$/);
          const speaker = m ? CREW.find((c) => c.name === m[1]) : null;
          if (speaker && m) {
            sub.innerHTML = '';
            const tile = document.createElement('span');
            tile.className = 'portrait';
            tile.style.background = speaker.color;
            tile.textContent = speaker.name.charAt(0);
            const line = document.createElement('span');
            line.textContent = m[2];
            sub.append(tile, line);
          } else {
            sub.textContent = text;
          }
        }
      }
    }
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
  // SBPD dispatch: every police unit on the scene, nearest first, with a
  // role read off its position relative to the player — a parked cruiser
  // ahead is a roadblock, one closing from behind is in pursuit, one
  // alongside is flanking. The helicopter flies as AIR-1. When the heat
  // is off the panel says so, so it always reads as a live police radio.
  _updateDispatch(world) {
    const box = el('dispatch');
    if (!box) return;
    const p = world.player;
    const fx = Math.sin(p.heading);
    const fz = Math.cos(p.heading);
    const rx = Math.cos(p.heading);
    const rz = -Math.sin(p.heading);
    const cops = world.cars.filter((c) => c.kind === 'police');
    cops.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const total = cops.length + (world.heli.active ? 1 : 0);
    let html = `<h3>SBPD DISPATCH · ${total} ON SCENE</h3>`;
    if (total === 0) {
      html += '<div class="clear">All units clear — no pursuit</div>';
    } else {
      if (world.heli.active) {
        const d = Math.hypot(world.heli.x - p.x, world.heli.z - p.z);
        html += `<div class="drow"><span>AIR-1</span><span class="role">SPOTLIGHT</span><span class="dist">${Math.round(d)}m</span></div>`;
      }
      cops.slice(0, 4).forEach((car, i) => {
        const dx = car.x - p.x;
        const dz = car.z - p.z;
        const fwd = dx * fx + dz * fz;
        const side = dx * rx + dz * rz;
        const d = Math.hypot(dx, dz);
        let role;
        if (car.parked) role = 'ROADBLOCK';
        else if (fwd > 8) role = 'INTERCEPT';
        else if (fwd < -8) role = 'PURSUIT';
        else role = side >= 0 ? 'FLANK RIGHT' : 'FLANK LEFT';
        html += `<div class="drow"><span>UNIT ${i + 1}</span><span class="role">${role}</span><span class="dist">${Math.round(d)}m</span></div>`;
      });
    }
    if (this._lastText.dispatch !== html) {
      this._lastText.dispatch = html;
      box.innerHTML = html;
    }
  }
  // Crew roster highlight: the passenger riding along, and the giver of
  // the job currently running.
  _updateCrew(world) {
    if (this._crewRows.length === 0) return;
    const giver = world.mission.active ? world.mission.active.def.giver : null;
    for (const row of this._crewRows) {
      const on = world.player.passenger === row.name || giver === row.id;
      row.el.classList.toggle('active', !!on);
    }
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
    // City blocks: filled squares between the roads, so the map reads as
    // a street map with blocks — not a dark grid. Block centres sit
    // halfway between adjacent road centres (roads every 40 m, blocks
    // 30 m wide).
    ctx.fillStyle = '#2b3a26';
    const bs = (BLOCK / (half * 2)) * S;
    for (let i = 0; i < ROAD_CENTERS.length - 1; i += 1) {
      for (let j = 0; j < ROAD_CENTERS.length - 1; j += 1) {
        const cx = ROAD_CENTERS[i] + 20;
        const cz = ROAD_CENTERS[j] + 20;
        ctx.fillRect(px(cx) - bs / 2, pz(cz) - bs / 2, bs, bs);
      }
    }
    // Roads.
    ctx.strokeStyle = '#6a7076';
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
    // Traffic on the roads and people on the streets: the map should show
    // the city alive, not just the police and the player.
    for (const car of world.cars) {
      if (car.kind !== 'police' && !car.parked) dot(car.x, car.z, 2.2, '#f0f0f0');
    }
    for (const ped of world.peds) {
      if (ped.state !== 'dead') dot(ped.x, ped.z, 1.2, '#ff9a5c');
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
    // Compass: map north is up (-z).
    ctx.fillStyle = '#e8e8e8';
    ctx.font = `bold ${Math.max(11, Math.round(S * 0.07))}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('N', S / 2, Math.max(12, S * 0.08));
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
