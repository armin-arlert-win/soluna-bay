// SOLUNA BAY — story missions and street races. Data only; the engine in
// world.js steps the objectives. All people, places and lines are original.
import { GARAGE } from './config.js';

export const MISSIONS = [
  {
    id: 'm1', name: 'First Day on the Bay', giver: 'dario', reward: { money: 300, respect: 60 },
    intro: [
      'Dario Voss: "Soluna Bay, kid. Sun, sand, and everybody owes somebody."',
      'Dario Voss: "Meet me at Soluna Plaza. I have a job that pays."',
    ],
    objectives: [
      { kind: 'goto', x: 0, z: 0, label: 'Meet Dario at Soluna Plaza' },
      { kind: 'pickup', x: 0, z: 0, label: 'Pick up Dario (walk up to him)' },
      { kind: 'deliver', x: -160, z: 180, label: 'Drive Dario to The Docks' },
    ],
  },
  {
    id: 'm2', name: 'The Marina Drop', giver: 'dario', reward: { money: 450, respect: 80 },
    intro: [
      'Dario Voss: "Three packages at the Marina. Small, quiet, no questions."',
      'Dario Voss: "Get them to Northgate. The buyer does not wait."',
    ],
    objectives: [
      { kind: 'goto', x: -40, z: 180, label: 'Reach the Marina' },
      { kind: 'collect', x: -40, z: 180, label: 'Collect the 3 packages', count: 3 },
      { kind: 'deliver', x: 120, z: -180, label: 'Deliver to Northgate' },
    ],
  },
  {
    id: 'm3', name: 'Wheels for Nia', giver: 'nia', reward: { money: 500, respect: 90 },
    intro: [
      'Nia Calder: "I need a Comet for parts. A nice one. Do not scratch it."',
      'Nia Calder: "Borrow one off the street and bring it to my garage."',
    ],
    objectives: [
      { kind: 'steal', carType: 'comet', label: 'Take a Comet off the street (E to jack it)' },
      { kind: 'deliver', x: GARAGE.x, z: GARAGE.z, label: 'Deliver the Comet to Calder Auto Works' },
    ],
  },
  {
    id: 'm4', name: 'Static on the Line', giver: 'ivy', reward: { money: 650, respect: 110 },
    intro: [
      'Ivy Santoro: "Three relays keep the Bay deaf. I need them dark."',
      'Ivy Santoro: "Hit each relay, then lose the heat. They will notice."',
    ],
    objectives: [
      { kind: 'goto', x: 160, z: 80, label: 'Reach the Strip relay' },
      { kind: 'goto', x: -196, z: 96, label: 'Reach the Beachfront relay' },
      { kind: 'goto', x: 180, z: -160, label: 'Reach the Airfield relay' },
      { kind: 'escape', label: 'Lose the police (drop to 0 stars)' },
    ],
  },
  {
    id: 'm5', name: "Rex's Collection", giver: 'rex', reward: { money: 800, respect: 140 },
    intro: [
      'Rex Tallow: "Four of Vane\'s boys are holding my cash at the warehouse."',
      'Rex Tallow: "Handle them. Bring the bag home."',
    ],
    objectives: [
      { kind: 'goto', x: -120, z: 168, label: 'Reach the Marina Warehouse' },
      { kind: 'eliminate', x: -120, z: 168, label: 'Deal with Vane\'s crew (4)', count: 4 },
      { kind: 'collect', x: -120, z: 168, label: 'Collect the cash bag', count: 1 },
      { kind: 'deliver', x: 0, z: 0, label: 'Bring the bag to Soluna Plaza' },
    ],
  },
  {
    id: 'm6', name: 'The Long Way Round', giver: 'milo', reward: { money: 700, respect: 120 },
    intro: [
      'Milo Ferran: "You call that driving? Follow my line through the city."',
      'Milo Ferran: "Six gates, one clock. Beat it and I will respect you."',
    ],
    objectives: [
      {
        kind: 'race', label: 'Run the gates before the clock dies', timeLimit: 95,
        points: [[-160, 120], [-80, -120], [80, -160], [160, 40], [120, 160], [0, 0]],
      },
    ],
  },
  {
    id: 'm7', name: 'Tail the Courier', giver: 'ivy', reward: { money: 900, respect: 150 },
    intro: [
      'Ivy Santoro: "A courier is moving Vane\'s ledger from the Strip to the Docks."',
      'Ivy Santoro: "Stay on him. Close enough to see, far enough to stay invisible."',
    ],
    objectives: [
      { kind: 'goto', x: 160, z: 80, label: 'Find the courier on The Strip' },
      { kind: 'tail', label: 'Tail the courier to the Docks — stay 10 to 30 m back', seconds: 45 },
    ],
  },
  {
    id: 'm8', name: 'Kingpin of the Bay', giver: 'dario', reward: { money: 1500, respect: 300 },
    intro: [
      'Dario Voss: "Vane himself is running. His car, his ledger, his whole crew."',
      'Dario Voss: "Run him down, take the ledger, and the Bay is ours."',
    ],
    objectives: [
      { kind: 'chase', label: 'Run Vane down — stay on his bumper for 20 seconds', seconds: 20 },
      { kind: 'collect', x: 0, z: 0, label: 'Take the ledger', count: 1 },
      { kind: 'deliver', x: 0, z: 0, label: 'Bring the ledger to Soluna Plaza' },
    ],
  },
];

export const RACES = [
  {
    id: 'r1', name: 'Beachfront Sprint', start: { x: -196, z: 96 }, entry: 100, reward: 600, timeLimit: 70,
    points: [[-200, -80], [-160, -180], [-40, -200], [80, -160], [160, -120]],
  },
  {
    id: 'r2', name: 'Downtown Circuit', start: { x: 0, z: 0 }, entry: 150, reward: 900, timeLimit: 85,
    points: [[80, 0], [80, 120], [-40, 120], [-120, 0], [-80, -120], [0, -120]],
  },
  {
    id: 'r3', name: 'Docks Dash', start: { x: -160, z: 180 }, entry: 200, reward: 1200, timeLimit: 75,
    points: [[-40, 180], [80, 160], [160, 120], [120, 40], [-40, 40]],
  },
];
