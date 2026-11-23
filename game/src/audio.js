// Procedural audio for Soluna Bay: no audio files, everything is synthesised
// with WebAudio. Three radio stations play tiny chiptune loops (a bass line
// and an arpeggio from each station's scale), plus an engine hum that follows
// the car's speed, police sirens, gunshots and pickup blips. Audio starts
// only after the first user gesture; the attract mode stays silent.
// Rebuilt under the gta6-01 recording: re-written from the reference build.
import { RADIO } from './config.js';

function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.station = 0;
    this.musicOn = true;
    this.step = 0;
    this.nextStepTime = 0;
    this.timer = null;
    this.started = false;
  }

  /** Create the context on a user gesture. Safe to call repeatedly. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return;
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new Ctx();
    } catch {
      return;
    }
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.16;
    this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.5;
    this.sfxGain.connect(this.master);
    // Engine hum: two detuned saws through a low-pass filter.
    this.engineOsc = this.ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 50;
    const engineFilter = this.ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(engineFilter);
    engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    // Police siren: a triangle that wails between two notes.
    this.sirenOsc = this.ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 700;
    this.sirenGain = this.ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.started = true;
    this.startMusicLoop();
  }

  stationName() {
    return RADIO[this.station].name;
  }

  cycleStation() {
    this.station = (this.station + 1) % RADIO.length;
    this.step = 0;
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.musicGain) this.musicGain.gain.value = this.musicOn ? 0.16 : 0;
  }

  startMusicLoop() {
    if (this.timer) return;
    this.nextStepTime = this.ctx.currentTime + 0.1;
    this.timer = window.setInterval(() => this.scheduleSteps(), 40);
  }

  scheduleSteps() {
    if (!this.ctx || !this.musicOn) return;
    const station = RADIO[this.station];
    const stepDur = 60 / station.bpm / 2; // eighth notes
    while (this.nextStepTime < this.ctx.currentTime + 0.18) {
      this.playStep(station, this.step, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.step = (this.step + 1) % 32;
    }
  }

  playStep(station, step, when, stepDur) {
    const scale = station.scale;
    // Bass on beats 0, 4, 8, ... and a walking note on 14.
    if (step % 8 === 0 || step === 14 || step === 30) {
      const degree = [0, 0, 3, 2][Math.floor(step / 8) % 4];
      this.note(midiToFreq(station.root + scale[degree % scale.length] - 12), when, stepDur * 1.8, 'sine', 0.5);
    }
    // Arpeggio: a pentatonic walk that repeats every 16 steps.
    const arpNotes = [0, 2, 1, 3, 2, 4, 3, 1];
    if (step % 2 === 0) {
      const degree = arpNotes[(step / 2) % 8];
      const midi = station.root + 12 + scale[degree % scale.length];
      this.note(midiToFreq(midi), when, stepDur * 0.9, station.wave, 0.16);
    }
    // Hat tick on odd steps.
    if (step % 2 === 1) this.tick(when, 0.05);
  }

  note(freq, when, dur, type, vol) {
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(vol, when + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, when + dur);
    osc.connect(gain);
    gain.connect(this.musicGain);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  tick(when, vol) {
    const buffer = this.ctx.createBuffer(1, 2205, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 6000;
    const gain = this.ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);
    src.start(when);
  }

  /** Engine pitch/volume from speed (0..1) and whether the player drives. */
  setEngine(speed01, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.05 + speed01 * 0.09 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  /** Siren loudness from wanted level and whether a cop is near. */
  setSiren(on) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, now, 0.2);
    if (on) {
      const phase = (now % 1.6) < 0.8 ? 660 : 880;
      this.sirenOsc.frequency.setTargetAtTime(phase, now, 0.05);
    }
  }

  gunshot() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, 4410, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 2.2);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.5;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
  }

  blip(freq = 880) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, now + 0.09);
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  crash() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const buffer = this.ctx.createBuffer(1, 8820, 44100);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 1.4);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 700;
    const gain = this.ctx.createGain();
    gain.gain.value = 0.45;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    src.start(now);
  }
}
