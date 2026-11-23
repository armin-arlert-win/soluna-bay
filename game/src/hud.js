// The DOM overlay for Soluna Bay: the HUD (wanted stars, money, clock,
// health and armour, weapon slots, speed, radio, mission tracker), the live
// minimap canvas, subtitles, and the title / pause / map / garage screens.
// The 3D world is WebGL; everything the player reads is DOM so it stays
// crisp in screenshots.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { districtNameAt } from './city.js';
import { GARAGE, PRICES } from './config.js';

function el(tag, cls, parent, text) {
  const node = document.createElement(tag);
  if (cls) node.className = cls;
  if (text !== undefined) node.textContent = text;
  if (parent) parent.appendChild(node);
  return node;
}

export class HUD {
  constructor(root, callbacks) {
    this.cb = callbacks;
    this.root = root;
    this.hud = el('div', 'hud', root);
    // Wanted stars, top left.
    this.wantedBox = el('div', 'wanted', this.hud);
    this.stars = el('div', 'stars', this.wantedBox);
    this.dispatch = el('div', 'dispatch', this.wantedBox);
    // Money / clock / district, top right.
    this.infoBox = el('div', 'info', this.hud);
    this.money = el('div', 'money', this.infoBox, '$250');
    this.clock = el('div', 'clock', this.infoBox, '09:23  Day 1');
    this.district = el('div', 'district', this.infoBox, 'Marina Row');
    // Mission tracker, top centre.
    this.tracker = el('div', 'tracker', this.hud, 'SOLUNA BAY');
    // Vitals, bottom left above the minimap.
    this.vitals = el('div', 'vitals', this.hud);
    this.healthBar = el('div', 'bar health', this.vitals);
    this.healthFill = el('div', 'fill', this.healthBar);
    this.armourBar = el('div', 'bar armour', this.vitals);
    this.armourFill = el('div', 'fill', this.armourBar);
    this.rank = el('div', 'rank', this.vitals, 'Nobody');
    // Minimap.
    this.mapWrap = el('div', 'mapwrap', this.hud);
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.width = 210;
    this.mapCanvas.height = 210;
    this.mapCanvas.className = 'minimap';
    this.mapWrap.appendChild(this.mapCanvas);
    this.mapCtx = this.mapCanvas.getContext('2d');
    // Weapon slots, bottom centre.
    this.weapons = el('div', 'weapons', this.hud);
    this.weaponSlots = [];
    // Speed and radio, bottom right.
    this.drive = el('div', 'drive', this.hud);
    this.speed = el('div', 'speed', this.drive, '0');
    this.speedUnit = el('div', 'speedunit', this.drive, 'km/h');
    this.carHealth = el('div', 'carhealth', this.drive, '');
    this.radio = el('div', 'radio', this.drive, 'SOLUNA FM 98.4');
    // Subtitles, lower centre.
    this.subtitles = el('div', 'subtitles', this.hud);
    // Crosshair.
    this.crosshair = el('div', 'crosshair', this.hud);
    this.crosshair.innerHTML = '<span></span>';
    // Damage flash and mission flash.
    this.flash = el('div', 'flash', this.hud);
    this.banner = el('div', 'banner', this.hud);
    this.bannerTimer = 0;
    // Overlays.
    this.title = this.buildTitle();
    this.pause = this.buildPause();
    this.garage = this.buildGarage();
    this.howto = this.buildHowTo();
    this.endScreen = this.buildEndScreen();
    this.hideOverlays();
    this.last = {};
  }

  buildTitle() {
    const box = el('div', 'overlay title', this.root);
    el('div', 'logo', box, 'SOLUNA BAY');
    el('div', 'tagline', box, 'A sun-soaked open-world crime story');
    const menu = el('div', 'menu', box);
    const btnNew = el('button', '', menu, 'NEW GAME');
    const btnContinue = el('button', '', menu, 'CONTINUE');
    const btnHow = el('button', '', menu, 'HOW TO PLAY');
    btnNew.addEventListener('click', () => this.cb.onNewGame());
    btnContinue.addEventListener('click', () => this.cb.onContinue());
    btnHow.addEventListener('click', () => this.showHowTo());
    el('div', 'hint', box, 'Press ENTER to play — the city is alive behind this menu');
    el('div', 'credits', box, 'WASD move / drive · Mouse aim · E enter car · F steal · Click shoot · R reload · 1-4 weapons · Q radio · M map · Esc pause');
    this.titleContinue = btnContinue;
    return box;
  }

  buildPause() {
    const box = el('div', 'overlay pause', this.root);
    el('div', 'logo small', box, 'PAUSED — SOLUNA BAY');
    this.pauseMap = document.createElement('canvas');
    this.pauseMap.width = 560;
    this.pauseMap.height = 560;
    this.pauseMap.className = 'bigmap';
    box.appendChild(this.pauseMap);
    this.pauseMapCtx = this.pauseMap.getContext('2d');
    const row = el('div', 'menu row', box);
    const btnResume = el('button', '', row, 'RESUME');
    const btnSave = el('button', '', row, 'SAVE GAME');
    const btnQuit = el('button', '', row, 'QUIT TO TITLE');
    btnResume.addEventListener('click', () => this.cb.onResume());
    btnSave.addEventListener('click', () => this.cb.onSave());
    btnQuit.addEventListener('click', () => this.cb.onQuitToTitle());
    this.saveSlots = el('div', 'slots', box);
    this.saveMsg = el('div', 'savemsg', box, '');
    return box;
  }

  buildGarage() {
    const box = el('div', 'overlay garage', this.root);
    el('div', 'logo small', box, 'SOLUNA SPRAY & TUNE');
    el('div', 'tagline', box, 'Luz Ferreira — “Your ride leaves better than it came in.”');
    this.garageList = el('div', 'garagelist', box);
    const row = el('div', 'menu row', box);
    const btnLeave = el('button', '', row, 'LEAVE');
    btnLeave.addEventListener('click', () => this.cb.onLeaveGarage());
    this.garageMsg = el('div', 'savemsg', box, '');
    return box;
  }

  buildHowTo() {
    const box = el('div', 'overlay howto', this.root);
    el('div', 'logo small', box, 'HOW TO PLAY');
    const list = el('div', 'howlist', box);
    const lines = [
      'WASD — walk or drive. Mouse — look and aim. Click — shoot.',
      'E — get in a parked car. F — steal a driven car (the cops notice).',
      'Space — handbrake. Shift — run. R — reload. 1–4 — switch weapons.',
      'Q — change radio station. M — map and save. Esc — pause.',
      'Stars mean the SBPD is after you: lose them by breaking line of sight.',
      'J — start the next story job. Yellow markers are your objectives.',
      'Buy garages, properties and upgrades; collect all 40 sun shells.',
      'Getting busted or wasted costs you money. Stay sharp, Kai.',
    ];
    for (const line of lines) el('div', 'howline', list, line);
    const row = el('div', 'menu row', box);
    const btnBack = el('button', '', row, 'BACK');
    btnBack.addEventListener('click', () => this.cb.onCloseHowTo());
    return box;
  }

  buildEndScreen() {
    const box = el('div', 'overlay end', this.root);
    this.endTitle = el('div', 'logo small', box, 'BUSTED');
    this.endText = el('div', 'tagline', box, '');
    const row = el('div', 'menu row', box);
    const btnAgain = el('button', '', row, 'BACK ON THE STREET');
    btnAgain.addEventListener('click', () => this.cb.onRespawn());
    return box;
  }

  hideOverlays() {
    for (const o of [this.title, this.pause, this.garage, this.howto, this.endScreen]) {
      o.style.display = 'none';
    }
    this.hud.style.display = 'block';
  }

  showTitle(canContinue) {
    this.hideOverlays();
    this.title.style.display = 'flex';
    this.titleContinue.style.opacity = canContinue ? '1' : '0.4';
  }

  showPause() {
    this.hideOverlays();
    this.hud.style.display = 'none';
    this.pause.style.display = 'flex';
    this.renderSaveSlots();
  }

  showGarage() {
    this.hideOverlays();
    this.hud.style.display = 'none';
    this.garage.style.display = 'flex';
    this.renderGarage();
  }

  showHowTo() {
    this.hideOverlays();
    this.howto.style.display = 'flex';
  }

  showEnd(kind, fine) {
    this.hideOverlays();
    this.hud.style.display = 'none';
    this.endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    this.endText.textContent = kind === 'busted'
      ? `The SBPD took you in. Fine: $${fine}. Your car is impounded at the garage.`
      : `You got taken out. Hospital bill: $${fine}.`;
    this.endScreen.style.display = 'flex';
  }

  renderSaveSlots() {
    const slots = this.cb.onListSlots();
    this.saveSlots.innerHTML = '';
    slots.forEach((slot, i) => {
      const btn = document.createElement('button');
      btn.className = 'slot';
      btn.textContent = slot.empty
        ? `SLOT ${i + 1} — empty`
        : `SLOT ${i + 1} — ${slot.progress}% · $${slot.money} · ${slot.rank} · Day ${slot.day}`;
      btn.addEventListener('click', () => this.cb.onSaveSlot(i));
      this.saveSlots.appendChild(btn);
    });
  }

  renderGarage() {
    const money = this.cb.onMoney();
    const owned = this.cb.onGarageOwned();
    this.garageList.innerHTML = '';
    for (const [key, item] of Object.entries(GARAGE)) {
      const btn = document.createElement('button');
      btn.className = 'gitem';
      const isOwned = !!owned[key];
      btn.textContent = isOwned ? `${item.name} — OWNED` : `${item.name} — $${item.price}  (you have $${money})`;
      btn.disabled = isOwned || money < item.price;
      btn.addEventListener('click', () => this.cb.onBuyGarage(key));
      this.garageList.appendChild(btn);
    }
    const propRow = document.createElement('div');
    propRow.className = 'props';
    for (const prop of PRICES.property) {
      const btn = document.createElement('button');
      btn.className = 'gitem';
      const isOwned = this.cb.onProperties().includes(prop.id);
      btn.textContent = isOwned ? `${prop.name} — OWNED` : `${prop.name} — $${prop.price}`;
      btn.disabled = isOwned || money < prop.price;
      btn.addEventListener('click', () => this.cb.onBuyProperty(prop.id));
      propRow.appendChild(btn);
    }
    this.garageList.appendChild(propRow);
  }

  bannerText(text, ms = 2600) {
    this.banner.textContent = text;
    this.banner.style.opacity = '1';
    this.bannerTimer = ms / 1000;
  }

  setFlash(amount) {
    this.flash.style.opacity = String(Math.min(0.55, amount));
  }

  /** Refresh every HUD field from the live game state. */
  update(game, dt) {
    const p = game.playerApi.player;
    const w = game.worldApi.world;
    const stars = w.wanted.stars;
    if (this.last.stars !== stars) {
      this.last.stars = stars;
      let s = '';
      for (let i = 0; i < 5; i += 1) s += i < stars ? '★' : '☆';
      this.stars.textContent = s;
      this.stars.className = `stars wanted${stars}`;
      const names = ['No heat', 'SBPD Patrol', 'SBPD Response', 'SBPD Tactical', 'SBPD Interceptor', 'SBPD Lockdown'];
      this.dispatch.textContent = stars > 0 ? `${names[stars]} — ${w.cars.filter((c) => c.kind === 'police' && !c.dead).map((c) => c.unitName).filter(Boolean).slice(0, 4).join(' · ')}` : '';
    }
    const moneyText = `$${p.money.toLocaleString('en-US')}`;
    if (this.last.money !== moneyText) {
      this.last.money = moneyText;
      this.money.textContent = moneyText;
    }
    const hour = Math.floor(w.clock / 3600);
    const min = Math.floor((w.clock % 3600) / 60);
    const clockText = `${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}  Day ${w.day}`;
    if (this.last.clock !== clockText) {
      this.last.clock = clockText;
      this.clock.textContent = clockText;
    }
    const district = districtNameAt(p.x, p.z);
    if (this.last.district !== district) {
      this.last.district = district;
      this.district.textContent = district;
    }
    this.healthFill.style.width = `${Math.max(0, p.health)}%`;
    this.armourFill.style.width = `${Math.max(0, p.armour)}%`;
    const rankText = `${p.rank} · Respect ${p.respect}`;
    if (this.last.rank !== rankText) {
      this.last.rank = rankText;
      this.rank.textContent = rankText;
    }
    const tracker = game.missionsApi.trackerText();
    if (this.last.tracker !== tracker) {
      this.last.tracker = tracker;
      this.tracker.textContent = tracker;
    }
    // Weapon slots.
    if (this.weaponSlots.length === 0) {
      for (let i = 0; i < p.weapons.length; i += 1) {
        const slot = el('div', 'wslot', this.weapons);
        this.weaponSlots.push(slot);
      }
    }
    p.weapons.forEach((wpn, i) => {
      const ammo = wpn.mag === Infinity ? '∞' : `${wpn.magAmmo} / ${wpn.reserve}`;
      const text = `${i + 1} ${wpn.name}  ${ammo}`;
      if (this.weaponSlots[i].textContent !== text || this.weaponSlots[i].classList.contains('active') !== (i === p.weaponIndex)) {
        this.weaponSlots[i].textContent = text;
        this.weaponSlots[i].classList.toggle('active', i === p.weaponIndex);
      }
    });
    // Driving readout.
    if (p.car) {
      const kmh = Math.round(Math.abs(p.car.speed) * 3.6);
      this.speed.textContent = String(kmh);
      this.carHealth.textContent = `Condition ${Math.max(0, Math.round(p.car.health))}% · ${p.car.model.name}`;
      this.drive.classList.add('driving');
    } else {
      this.speed.textContent = '—';
      this.carHealth.textContent = 'On foot';
      this.drive.classList.remove('driving');
    }
    const radioText = game.audio.stationName();
    if (this.last.radio !== radioText) {
      this.last.radio = radioText;
      this.radio.textContent = radioText;
    }
    // Subtitles: newest dialogue line.
    const lines = game.missionsApi.state.dialogue;
    const line = lines.length > 0 ? lines[lines.length - 1] : null;
    const subText = line ? `${line.speaker}: “${line.text}”` : '';
    if (this.last.sub !== subText) {
      this.last.sub = subText;
      this.subtitles.textContent = subText;
    }
    // Crosshair only on foot with a gun.
    this.crosshair.style.display = !p.car && p.weaponIndex > 0 ? 'block' : 'none';
    // Banner fade.
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) this.banner.style.opacity = '0';
    }
    this.drawMinimap(game);
  }

  drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 210;
    const half = 395;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10, 18, 26, 0.82)';
    ctx.fillRect(0, 0, S, S);
    // Ocean and beach.
    ctx.fillStyle = '#1d5f8f';
    const [ox0, oz0] = toMap(-half, 470);
    const [ox1, oz1] = toMap(half, 900);
    ctx.fillRect(ox0, oz0, ox1 - ox0, S - oz0);
    ctx.fillStyle = '#c9ad72';
    const [bx0, bz0] = toMap(-half, 385);
    const [bx1, bz1] = toMap(half, 470);
    ctx.fillRect(bx0, bz0, bx1 - bx0, bz1 - bz0);
    // Streets.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 3;
    for (const s of game.city.streets) {
      const [x0, z0] = toMap(s, -385);
      const [x1, z1] = toMap(s, 385);
      ctx.beginPath(); ctx.moveTo(x0, z0); ctx.lineTo(x1, z1); ctx.stroke();
      const [hx0, hz0] = toMap(-385, s);
      const [hx1, hz1] = toMap(385, s);
      ctx.beginPath(); ctx.moveTo(hx0, hz0); ctx.lineTo(hx1, hz1); ctx.stroke();
    }
    const dot = (x, z, r, color) => {
      const [mx, my] = toMap(x, z);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(mx, my, r, 0, Math.PI * 2);
      ctx.fill();
    };
    // Garage and properties.
    dot(game.city.spots.garage.x, game.city.spots.garage.z, 4, '#37d67a');
    for (const prop of PRICES.property) {
      if (game.properties.includes(prop.id)) dot(prop.x, prop.z, 4, '#37d67a');
    }
    // Collectibles nearby.
    const p = game.playerApi.player;
    for (const shell of game.city.collectibles) {
      if (!shell.taken && Math.hypot(shell.x - p.x, shell.z - p.z) < 120) dot(shell.x, shell.z, 2, '#ffd94d');
    }
    // Traffic.
    for (const car of game.worldApi.world.cars) {
      if (car.kind === 'traffic') dot(car.x, car.z, 1.6, '#9aa4ae');
      else if (car.kind === 'police') dot(car.x, car.z, 2.4, Math.floor(performance.now() / 300) % 2 === 0 ? '#3b82f6' : '#ef4444');
    }
    // Mission marker.
    const marker = game.missionsApi.marker();
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      const pulse = 5 + Math.sin(performance.now() / 250) * 2;
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse * 0.7, my + pulse * 0.7);
      ctx.lineTo(mx - pulse * 0.7, my + pulse * 0.7);
      ctx.closePath();
      ctx.fill();
    }
    // Player arrow.
    const [px, py] = toMap(p.x, p.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(p.heading), Math.cos(p.heading)) + Math.PI);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // North marker.
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('N', 6, 14);
  }

  drawBigMap(game) {
    const ctx = this.pauseMapCtx;
    if (!ctx) return;
    const S = 560;
    const half = 395;
    const toMap = (x, z) => [(x + half) / (half * 2) * S, (z + half) / (half * 2) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#0e1a24';
    ctx.fillRect(0, 0, S, S);
    ctx.fillStyle = '#1d5f8f';
    const [, oz0] = toMap(0, 470);
    ctx.fillRect(0, oz0, S, S - oz0);
    ctx.fillStyle = '#c9ad72';
    const [, bz0] = toMap(0, 385);
    const [, bz1] = toMap(0, 470);
    ctx.fillRect(0, bz0, S, bz1 - bz0);
    ctx.strokeStyle = '#6a7078';
    ctx.lineWidth = 5;
    for (const s of game.city.streets) {
      const [x0, z0] = toMap(s, -385);
      const [x1, z1] = toMap(s, 385);
      ctx.beginPath(); ctx.moveTo(x0, z0); ctx.lineTo(x1, z1); ctx.stroke();
      const [hx0, hz0] = toMap(-385, s);
      const [hx1, hz1] = toMap(385, s);
      ctx.beginPath(); ctx.moveTo(hx0, hz0); ctx.lineTo(hx1, hz1); ctx.stroke();
    }
    ctx.font = 'bold 15px sans-serif';
    ctx.fillStyle = '#e8eef4';
    for (const d of ['Downtown Soluna', 'Marina Row', 'Old Port', 'Palm Court', 'Vista Heights', 'Coral Beach', 'The Strip']) {
      const spot = { 'Downtown Soluna': [0, 0], 'Marina Row': [300, -180], 'Old Port': [-300, -60], 'Palm Court': [40, 300], 'Vista Heights': [-300, 300], 'Coral Beach': [300, 420], 'The Strip': [35, 175] }[d];
      const [mx, my] = toMap(spot[0], spot[1]);
      ctx.fillText(d, mx - 40, my);
    }
    const p = game.playerApi.player;
    const [px, py] = toMap(p.x, p.z);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('YOU', px + 12, py + 5);
    const marker = game.missionsApi.marker();
    if (marker) {
      const [mx, my] = toMap(marker.x, marker.z);
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(mx, my - 12);
      ctx.lineTo(mx + 10, my + 8);
      ctx.lineTo(mx - 10, my + 8);
      ctx.closePath();
      ctx.fill();
    }
    // (Save slots are listed as buttons under the map, not drawn here.)
  }
}
