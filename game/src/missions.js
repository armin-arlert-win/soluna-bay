// The story of Soluna Bay: eight staged missions from Mara, Tito, Luz and
// Juno, plus three standalone street races. A mission is a list of stages;
// each stage is a job the player finishes by driving, stealing, shooting or
// escaping, and the tracker on the HUD always shows the current one.
// Dialogue is shown as subtitles so the story reads on screen.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { CREW } from './config.js';

const S = (x, z) => ({ x, z });

export const MISSIONS = [
  {
    id: 'm1', title: 'Gold Paint', giver: 'mara',
    briefing: [
      ['Mara Solis', 'Kai. A gold Meridian GT just rolled into Mira’s Boatyard. It belongs to a collector who owes me.'],
      ['Mara Solis', 'Take it to Luz at the garage. Try not to scratch the paint. Actually — scratch it. He deserves it.'],
    ],
    stages: [
      { type: 'goto', at: S(320, -160), text: 'Go to Mira’s Boatyard', radius: 10 },
      { type: 'steal', at: S(320, -160), text: 'Steal the gold Meridian GT', carModel: 'Meridian GT', carColor: [0.95, 0.8, 0.25] },
      { type: 'deliver', at: S(105, 245), text: 'Deliver the Meridian to Soluna Spray & Tune', radius: 10 },
    ],
    reward: { money: 800, respect: 120 },
    complete: ['Mara Solis', 'Clean work. Luz says the gold is real. You’re in, Kai.'],
  },
  {
    id: 'm2', title: 'Market Squeeze', giver: 'mara',
    briefing: [
      ['Mara Solis', 'Three stalls at the Night Market stopped paying protection. Remind them the market has a landlord.'],
      ['Mara Solis', 'Stand at each stall until they hand it over. The cops will hear about it — be ready to run.'],
    ],
    stages: [
      { type: 'collect', at: S(-35, 245), text: 'Collect from the Night Market stalls (0/3)', radius: 8, count: 3, spots: [S(-45, 235), S(-25, 255), S(-35, 225)] },
      { type: 'escape', text: 'Lose the heat', wanted: 0 },
    ],
    reward: { money: 1200, respect: 150 },
    complete: ['Mara Solis', 'The market pays again. Word travels fast, Kai.'],
  },
  {
    id: 'm3', title: 'Tide Runner', giver: 'tito',
    briefing: [
      ['Tito Rook', 'Coast road. Six gates, one timer. Beat 2:30 and the bay knows your name.'],
      ['Tito Rook', 'My money is on you. Don’t make me regret it.'],
    ],
    stages: [
      {
        type: 'race', text: 'Race the coast road — hit every gate', timeLimit: 150,
        gates: [S(-300, 360), S(-140, 360), S(0, 360), S(140, 360), S(300, 360), S(350, 200)],
      },
    ],
    reward: { money: 1500, respect: 180 },
    complete: ['Tito Rook', '2:30? You made it look easy. The bay is talking.'],
  },
  {
    id: 'm4', title: 'Dockside Ambush', giver: 'luz',
    briefing: [
      ['Luz Ferreira', 'The Old Port crew jacked my parts shipment. Five of them, guarding the crates.'],
      ['Luz Ferreira', 'Clear them out and the parts are yours. I already loaded you a spare SMG.'],
    ],
    stages: [
      { type: 'goto', at: S(-300, -60), text: 'Go to the Old Port Warehouses', radius: 12 },
      { type: 'shootout', at: S(-300, -60), text: 'Clear out the port crew', count: 5 },
    ],
    reward: { money: 1800, respect: 220 },
    complete: ['Luz Ferreira', 'Parts recovered. Your ride gets the good brakes now.'],
  },
  {
    id: 'm5', title: 'High Tide', giver: 'mara',
    briefing: [
      ['Mara Solis', 'A Calyx Sprint GT is parked outside the casino on the Strip. Its owner is inside losing everything.'],
      ['Mara Solis', 'Take it to the boatyard. The SBPD will be all over you — make them work for it.'],
    ],
    stages: [
      { type: 'steal', at: S(35, 175), text: 'Steal the Calyx Sprint GT on the Strip', carModel: 'Calyx Sprint GT', carColor: [0.9, 0.25, 0.55] },
      { type: 'escape', text: 'Lose the heat', wanted: 0 },
      { type: 'deliver', at: S(320, -160), text: 'Deliver the Calyx to Mira’s Boatyard', radius: 10 },
    ],
    reward: { money: 2500, respect: 260 },
    complete: ['Mara Solis', 'The casino’s loss is our gain. Beautiful.'],
  },
  {
    id: 'm6', title: 'Crown of Palms', giver: 'juno',
    briefing: [
      ['Juno Park', 'A courier case is sitting in a Vista Heights mansion. Cameras looped, gate code in your phone.'],
      ['Juno Park', 'Grab the case and vanish. If the alarms go off, don’t stop for anything.'],
    ],
    stages: [
      { type: 'goto', at: S(-300, 300), text: 'Reach the Vista Heights mansion', radius: 10 },
      { type: 'collect', at: S(-300, 300), text: 'Grab the courier case', radius: 6, count: 1, spots: [S(-300, 300)] },
      { type: 'escape', text: 'Lose the heat', wanted: 0 },
      { type: 'deliver', at: S(0, 0), text: 'Bring the case to Downtown Plaza', radius: 10 },
    ],
    reward: { money: 3200, respect: 320 },
    complete: ['Juno Park', 'Case cracked. The contents are worth more than the house.'],
  },
  {
    id: 'm7', title: 'Lantern Run', giver: 'tito',
    briefing: [
      ['Tito Rook', 'Night race. Downtown to the market, eight gates, no brakes, no mercy.'],
      ['Tito Rook', 'Win it and the street racers answer to you.'],
    ],
    stages: [
      {
        type: 'race', text: 'Night race — hit every gate', timeLimit: 170,
        gates: [S(0, 0), S(-140, 0), S(-140, 140), S(0, 140), S(0, 245), S(-35, 245), S(140, 175), S(140, 0)],
      },
    ],
    reward: { money: 2800, respect: 340 },
    complete: ['Tito Rook', 'Lantern Run champion. They’ll be telling that story for a year.'],
  },
  {
    id: 'm8', title: 'King of the Bay', giver: 'mara',
    briefing: [
      ['Mara Solis', 'Last job. An SBPD evidence convoy runs the coast road at dusk — three cars, six guards, one truck.'],
      ['Mara Solis', 'Hit the convoy, take the truck to the boatyard, and the bay is ours. No half measures, Kai.'],
    ],
    stages: [
      { type: 'goto', at: S(0, 360), text: 'Ambush the convoy on the coast road', radius: 14 },
      { type: 'shootout', at: S(0, 360), text: 'Take down the convoy guards', count: 6 },
      { type: 'steal', at: S(0, 360), text: 'Steal the evidence truck', carModel: 'Soluna Van', carColor: [0.1, 0.12, 0.16] },
      { type: 'deliver', at: S(320, -160), text: 'Deliver the truck to Mira’s Boatyard', radius: 12 },
    ],
    reward: { money: 6000, respect: 800 },
    complete: ['Mara Solis', 'It’s done. Soluna Bay has a new king — and it’s you, Kai.'],
  },
];

export const RACES = [
  {
    id: 'r1', name: 'Coast Sprint', timeLimit: 150,
    gates: [S(-300, 360), S(-140, 360), S(0, 360), S(140, 360), S(300, 360), S(350, 200)],
  },
  {
    id: 'r2', name: 'Downtown Loop', timeLimit: 160,
    gates: [S(0, 0), S(140, 0), S(140, 140), S(0, 140), S(-140, 140), S(-140, 0)],
  },
  {
    id: 'r3', name: 'Night Market Dash', timeLimit: 140,
    gates: [S(-35, 245), S(0, 245), S(140, 245), S(140, 175), S(0, 175), S(-35, 175)],
  },
];

export function createMissions(worldApi, playerApi) {
  const world = worldApi.world;
  const state = {
    available: 0, // index of the next mission to offer
    active: null, // { mission, stage, data, targetCar, enemiesLeft, gateIndex, timer, collectIndex, collectT }
    completed: [],
    dialogue: [], // { speaker, text, t }
    races: { active: null, best: {} },
  };

  function say(speaker, text, dur = 4.5) {
    state.dialogue.push({ speaker, text, t: dur });
    worldApi.emit('dialogue', { speaker, text });
  }

  function crewName(id) {
    return CREW[id] ? CREW[id].name : id;
  }

  function startMission(index) {
    const mission = MISSIONS[index];
    if (!mission || state.active) return false;
    state.active = {
      mission,
      stage: 0,
      data: {},
      gateIndex: 0,
      timer: 0,
      collectIndex: 0,
      collectT: 0,
      targetCar: null,
      enemiesLeft: 0,
    };
    for (const [speaker, text] of mission.briefing) say(speaker, text, 5);
    worldApi.emit('missionStart', { title: mission.title });
    enterStage();
    return true;
  }

  function enterStage() {
    const act = state.active;
    if (!act) return;
    const stage = act.mission.stages[act.stage];
    if (!stage) return;
    act.timer = 0;
    act.collectT = 0;
    if (stage.type === 'steal') {
      const model = {
        name: stage.carModel, maxSpeed: 34, accel: 14, len: 4.6,
        color: stage.carColor || [0.9, 0.8, 0.2], paint: stage.carColor || [0.9, 0.8, 0.2],
      };
      const car = worldApi.addCar('parked', stage.at.x + 4, stage.at.z, 0.3, model);
      car.driver = false;
      act.targetCar = car;
    } else if (stage.type === 'shootout') {
      act.enemiesLeft = stage.count;
      for (let i = 0; i < stage.count; i += 1) {
        const ang = (i / stage.count) * Math.PI * 2;
        worldApi.spawnEnemy(stage.at.x + Math.cos(ang) * 14, stage.at.z + Math.sin(ang) * 14, {
          health: 60 + i * 8,
          reward: 120,
        });
      }
    } else if (stage.type === 'race') {
      act.gateIndex = 0;
      act.timer = stage.timeLimit;
    } else if (stage.type === 'collect') {
      act.collectIndex = 0;
    }
  }

  function advanceStage() {
    const act = state.active;
    if (!act) return;
    act.stage += 1;
    if (act.stage >= act.mission.stages.length) {
      completeMission();
    } else {
      enterStage();
    }
  }

  function completeMission() {
    const act = state.active;
    const mission = act.mission;
    const player = playerApi.player;
    player.money += mission.reward.money;
    playerApi.addRespect(mission.reward.respect);
    state.completed.push(mission.id);
    state.available = Math.min(MISSIONS.length, state.available + 1);
    state.active = null;
    const [speaker, text] = mission.complete;
    say(speaker, text, 6);
    worldApi.emit('missionComplete', { title: mission.title, money: mission.reward.money });
  }

  function failMission(reason) {
    const act = state.active;
    if (!act) return;
    worldApi.emit('missionFailed', { title: act.mission.title, reason });
    say('Mara Solis', 'That went sideways. Come back when you’re ready to run it again.', 5);
    state.active = null;
  }

  function marker() {
    const act = state.active;
    if (!act) return null;
    const stage = act.mission.stages[act.stage];
    if (!stage) return null;
    if (stage.type === 'goto' || stage.type === 'deliver') return { x: stage.at.x, z: stage.at.z, label: stage.text };
    if (stage.type === 'steal') return { x: stage.at.x, z: stage.at.z, label: stage.text };
    if (stage.type === 'shootout') return { x: stage.at.x, z: stage.at.z, label: stage.text };
    if (stage.type === 'collect') {
      const spot = stage.spots[Math.min(act.collectIndex, stage.spots.length - 1)];
      return { x: spot.x, z: spot.z, label: stage.text };
    }
    if (stage.type === 'race') {
      const gate = stage.gates[Math.min(act.gateIndex, stage.gates.length - 1)];
      return { x: gate.x, z: gate.z, label: stage.text, race: true };
    }
    return null;
  }

  function trackerText() {
    const act = state.active;
    if (!act) {
      if (state.available < MISSIONS.length) {
        return `Next job: ${MISSIONS[state.available].title} — press J to start`;
      }
      return 'All jobs complete — you are the King of the Bay';
    }
    const stage = act.mission.stages[act.stage];
    let text = stage.text;
    if (stage.type === 'collect') text = stage.text.replace(/\(\d+\/\d+\)/, `(${act.collectIndex}/${stage.count})`);
    if (stage.type === 'shootout') text = `${stage.text} (${world.enemies.length} left)`;
    if (stage.type === 'race') text = `${stage.text} — gate ${act.gateIndex + 1}/${stage.gates.length} — ${Math.ceil(act.timer)}s`;
    return `${act.mission.title}: ${text}`;
  }

  function update(dt) {
    // Dialogue timers.
    for (const line of state.dialogue) line.t -= dt;
    state.dialogue = state.dialogue.filter((line) => line.t > 0);
    const player = playerApi.player;
    const act = state.active;
    if (!act) return;
    const stage = act.mission.stages[act.stage];
    if (!stage) return;
    const p = player;
    if (stage.type === 'goto' || stage.type === 'deliver') {
      if (Math.hypot(p.x - stage.at.x, p.z - stage.at.z) < (stage.radius || 8)) advanceStage();
    } else if (stage.type === 'steal') {
      if (act.targetCar && p.car === act.targetCar) {
        say(crewName(act.mission.giver), 'That’s the one. Now get it where it needs to go.', 4);
        advanceStage();
      } else if (act.targetCar && act.targetCar.dead) {
        failMission('the target car was destroyed');
      }
    } else if (stage.type === 'collect') {
      const spot = stage.spots[Math.min(act.collectIndex, stage.spots.length - 1)];
      if (Math.hypot(p.x - spot.x, p.z - spot.z) < stage.radius) {
        act.collectT += dt;
        if (act.collectT > 2.5) {
          act.collectIndex += 1;
          act.collectT = 0;
          player.money += 150;
          if (act.collectIndex >= stage.count) advanceStage();
        }
      } else {
        act.collectT = 0;
      }
      if (stage.count > 1 && act.collectIndex === 1 && !act.warned) {
        act.warned = true;
        worldApi.addWanted(2, 'market squeeze');
      }
    } else if (stage.type === 'shootout') {
      if (world.enemies.length === 0) advanceStage();
    } else if (stage.type === 'escape') {
      if (world.wanted.stars === 0) advanceStage();
    } else if (stage.type === 'race') {
      act.timer -= dt;
      const gate = stage.gates[act.gateIndex];
      const needCar = true;
      if (p.car && gate && Math.hypot(p.x - gate.x, p.z - gate.z) < 10) {
        act.gateIndex += 1;
        worldApi.emit('gate', { index: act.gateIndex, total: stage.gates.length });
        if (act.gateIndex >= stage.gates.length) advanceStage();
      } else if (!p.car && needCar) {
        // On foot during a race: warn once.
        if (!act.warnedFoot) {
          act.warnedFoot = true;
          say('Tito Rook', 'You need wheels for this, Kai. Get in a car!', 4);
        }
      }
      if (act.timer <= 0) failMission('out of time');
    }
  }

  // ---- Street races (free roam) ----
  function startRace(race) {
    if (state.active || state.races.active) return false;
    state.races.active = { race, gateIndex: 0, timer: race.timeLimit };
    say('Tito Rook', `${race.name} — ${race.gates.length} gates, ${race.timeLimit}s on the clock. Go!`, 4);
    return true;
  }

  function updateRace(dt) {
    const r = state.races.active;
    if (!r) return;
    const player = playerApi.player;
    r.timer -= dt;
    const gate = r.race.gates[r.gateIndex];
    if (player.car && gate && Math.hypot(player.x - gate.x, player.z - gate.z) < 10) {
      r.gateIndex += 1;
      worldApi.emit('gate', { index: r.gateIndex, total: r.race.gates.length });
      if (r.gateIndex >= r.race.gates.length) {
        const timeLeft = Math.ceil(r.timer);
        player.money += 1500;
        playerApi.addRespect(80);
        state.races.best[r.race.id] = Math.max(state.races.best[r.race.id] || 0, timeLeft);
        say('Tito Rook', `${r.race.name} won! $${1500} and ${timeLeft}s to spare.`, 5);
        state.races.active = null;
        worldApi.emit('raceWon', { name: r.race.name });
      }
    }
    if (r && r.timer <= 0) {
      say('Tito Rook', 'Out of time. Run it again when you’re ready.', 4);
      state.races.active = null;
    }
  }

  return {
    state,
    startMission,
    failMission,
    marker,
    trackerText,
    startRace,
    update(dt) {
      update(dt);
      updateRace(dt);
    },
  };
}
