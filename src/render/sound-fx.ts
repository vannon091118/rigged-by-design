/** Prozeduraler WebAudio-Synth: alle Effekte ohne Asset, mit stillem Fallback. */
type SfxKind = 'coin' | 'reelStop' | 'pinHit' | 'cardFlip' | 'roulette' | 'brawl' | 'win';

const STORAGE_KEY = 'rbd.sfx.muted';
let context: AudioContext | null = null;
let muted = false;

if (typeof window !== 'undefined') {
  try { muted = window.localStorage.getItem(STORAGE_KEY) === '1'; } catch { muted = false; }
}

export function isMuted(): boolean {
  return muted;
}

/** Merkt die Stummschaltung im Browser, nicht im Spielstand: sie ist Geraeteeinstellung. */
export function setMuted(next: boolean): void {
  muted = next;
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0'); } catch { /* privater Modus */ }
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || muted) return null;
  if (!context) {
    const legacy = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctor = window.AudioContext ?? legacy;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') void context.resume();
  return context;
}

interface Tone {
  readonly at: number;
  readonly hz: number;
  readonly length: number;
  readonly type: OscillatorType;
  readonly gain: number;
  readonly slide?: number;
}

function tone(ctx: AudioContext, spec: Tone): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.hz, spec.at);
  if (spec.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.slide), spec.at + spec.length);
  amp.gain.setValueAtTime(0.0001, spec.at);
  amp.gain.exponentialRampToValueAtTime(spec.gain, spec.at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, spec.at + spec.length);
  osc.connect(amp).connect(ctx.destination);
  osc.start(spec.at);
  osc.stop(spec.at + spec.length + 0.02);
}

/** Rauschen fuer Karten, Muenzen und Pruegeleien; Filterform ersetzt jedes Sample. */
function noise(ctx: AudioContext, at: number, length: number, gain: number, cutoff: number, type: BiquadFilterType): void {
  const frames = Math.max(1, Math.floor(ctx.sampleRate * length));
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let index = 0; index < frames; index += 1) data[index] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const amp = ctx.createGain();
  source.buffer = buffer;
  filter.type = type;
  filter.frequency.value = cutoff;
  amp.gain.setValueAtTime(gain, at);
  amp.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(amp).connect(ctx.destination);
  source.start(at);
}

export function playSfx(kind: SfxKind): void {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  if (kind === 'coin') {
    tone(ctx, { at: now, hz: 1980, length: 0.1, type: 'triangle', gain: 0.06 });
    tone(ctx, { at: now + 0.05, hz: 2640, length: 0.12, type: 'triangle', gain: 0.05 });
    noise(ctx, now, 0.05, 0.03, 5200, 'highpass');
  } else if (kind === 'reelStop') {
    tone(ctx, { at: now, hz: 180, length: 0.1, type: 'square', gain: 0.05, slide: 70 });
  } else if (kind === 'pinHit') {
    tone(ctx, { at: now, hz: 980, length: 0.05, type: 'triangle', gain: 0.035 });
  } else if (kind === 'cardFlip') {
    noise(ctx, now, 0.09, 0.05, 2400, 'bandpass');
  } else if (kind === 'roulette') {
    tone(ctx, { at: now, hz: 620, length: 0.55, type: 'sine', gain: 0.04, slide: 210 });
    for (let tick = 0; tick < 7; tick += 1) tone(ctx, { at: now + 0.06 * tick, hz: 1200 - tick * 90, length: 0.03, type: 'square', gain: 0.02 });
  } else if (kind === 'brawl') {
    noise(ctx, now, 0.25, 0.09, 420, 'lowpass');
    tone(ctx, { at: now, hz: 110, length: 0.2, type: 'sawtooth', gain: 0.05, slide: 60 });
  } else {
    [523, 659, 784].forEach((hz, index) => tone(ctx, { at: now + index * 0.07, hz, length: 0.16, type: 'triangle', gain: 0.05 }));
  }
}

/** Pin-Serie fuer den Plinko-Lauf: ein Ping je Reihe, die Bahn selbst bleibt im Kern. */
export function playPinRun(pins = 7): void {
  const ctx = audio();
  if (!ctx) return;
  const now = ctx.currentTime;
  for (let index = 0; index < pins; index += 1) {
    tone(ctx, { at: now + index * 0.055, hz: 760 + index * 85, length: 0.05, type: 'triangle', gain: 0.03 });
  }
}
