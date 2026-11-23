// SOLUNA BAY — procedural sound. Everything is synthesized with WebAudio:
// engine hum, three radio stations, sirens, gunshots. No audio files.
import { RADIO } from './config.js';
import { makeRng } from './rng.js';

function noteFreq(root, semitones) {
  return root * Math.pow(2, semitones / 12);
}

const SCALES = {
  major: [0, 2, 4, 7, 9, 12, 14, 16],
  minor: [0, 3, 5, 7, 10, 12, 15, 17],
};
const PROGRESSIONS = {
  major: [0, 5, 7, 5],
  minor: [0, -4, -2, 3],
};

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.radioOn = true;
    this.station = 0;
    this._radioTimer = null;
    this._step = 0;
    this._nextTime = 0;
    this._melody = [];
    this._buildMelodies();
  }
  _buildMelodies() {
    RADIO.forEach((st, si) => {
      const rng = makeRng(1000 + si * 77);
      const scale = SCALES[st.mood];
      const bars = [];
      for (let bar = 0; bar < 4; bar += 1) {
        const steps = [];
        for (let s = 0; s < 16; s += 1) {
          if (s % 2 === 0 && rng.chance(0.55)) steps.push(scale[rng.int(0, scale.length - 1)]);
          else steps.push(null);
        }
        bars.push(steps);
      }
      this._melody.push(bars);
    });
  }
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    // Engine: two detuned saws through a lowpass.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const sub = this.ctx.createOscillator();
    sub.type = 'sawtooth';
    sub.frequency.value = 55.5;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(lp);
    sub.connect(lp);
    lp.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    sub.start();
    this._sub = sub;
    // Siren: a square wave whose pitch wobbles.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 780;
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 0.55;
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 170;
    lfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    lfo.start();
    this._startRadio();
  }
  _tone(freq, time, dur, type, gain) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, time + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(time);
    o.stop(time + dur + 0.05);
  }
  _noise(time, dur, gain, freq) {
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(time);
  }
  _startRadio() {
    this._step = 0;
    this._nextTime = this.ctx.currentTime + 0.1;
    this._radioTimer = window.setInterval(() => this._scheduleRadio(), 90);
  }
  _scheduleRadio() {
    if (!this.ctx || !this.radioOn) return;
    const st = RADIO[this.station];
    const stepDur = 60 / st.bpm / 4;
    while (this._nextTime < this.ctx.currentTime + 0.35) {
      const bar = Math.floor(this._step / 16) % 4;
      const step = this._step % 16;
      const prog = PROGRESSIONS[st.mood][bar];
      const t = this._nextTime;
      if (step === 0 || step === 8) {
        this._tone(noteFreq(st.root, prog - 12), t, stepDur * 3.2, 'triangle', 0.16);
      }
      if (step % 4 === 0) {
        this._tone(noteFreq(st.root, prog + 12), t, stepDur * 0.9, 'square', 0.03);
        this._tone(noteFreq(st.root, prog + 19), t, stepDur * 0.9, 'square', 0.025);
      }
      const note = this._melody[this.station][bar][step];
      if (note !== null && note !== undefined) {
        this._tone(noteFreq(st.root, prog + note), t, stepDur * 1.8, 'sine', 0.09);
      }
      if (step % 4 === 2) this._noise(t, 0.05, 0.05, 6000);
      this._step += 1;
      this._nextTime += stepDur;
    }
  }
  setStation(i) {
    this.station = ((i % RADIO.length) + RADIO.length) % RADIO.length;
    this._step = 0;
    if (this.ctx) this._nextTime = this.ctx.currentTime + 0.05;
  }
  stationName() {
    return RADIO[this.station].name;
  }
  setEngine(speed, inCar) {
    if (!this.ctx) return;
    const target = inCar ? Math.min(0.09, 0.025 + speed * 0.0022) : 0.012;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.1);
    const f = 42 + speed * 3.2;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
    if (this._sub) this._sub.frequency.setTargetAtTime(f * 1.005, this.ctx.currentTime, 0.08);
  }
  setSiren(level) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(level > 0 ? 0.035 : 0, this.ctx.currentTime, 0.3);
  }
  shoot(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._noise(t, kind === 'shotgun' ? 0.22 : 0.12, 0.5, kind === 'smg' ? 3200 : 2200);
    this._tone(140, t, 0.08, 'square', 0.12);
  }
  pickup() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(660, t, 0.09, 'sine', 0.18);
    this._tone(990, t + 0.08, 0.12, 'sine', 0.18);
  }
  crash() {
    if (!this.ctx) return;
    this._noise(this.ctx.currentTime, 0.3, 0.4, 900);
  }
  click() {
    if (!this.ctx) return;
    this._tone(880, this.ctx.currentTime, 0.05, 'sine', 0.1);
  }
  busted() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this._tone(392, t, 0.25, 'triangle', 0.2);
    this._tone(311, t + 0.22, 0.4, 'triangle', 0.2);
  }
}
