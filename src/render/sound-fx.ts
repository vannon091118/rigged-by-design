/** Prozeduraler WebAudio-Synth: alle Effekte ohne Asset, mit getrennten Kanaelen und stillem Fallback. */
type SfxKind = 'coin' | 'reelStop' | 'pinHit' | 'cardFlip' | 'roulette' | 'brawl' | 'win';

/** Getrennte Kanaele: Spiele, Kampf und Bedienung lassen sich unabhaengig regeln. */
export type SoundChannel = 'game' | 'combat' | 'ui';

export const SOUND_CHANNELS: readonly { id: SoundChannel; label: string }[] = [
  { id: 'game', label: 'Spiele' },
  { id: 'combat', label: 'Kampf' },
  { id: 'ui', label: 'Bedienung' },
];

const SETTINGS_KEY = 'rbd.sfx.settings';
const MUTE_KEY = 'rbd.sfx.muted';
const DEFAULTS: Readonly<Record<SoundChannel, number>> = { game: 0.8, combat: 1, ui: 0.6 };

interface SoundSettings {
  master: number;
  channels: Record<SoundChannel, number>;
}

let context: AudioContext | null = null;
let muted = false;
const gains = new Map<SoundChannel, GainNode>();
const settings: SoundSettings = { master: 1, channels: { ...DEFAULTS } };

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

if (typeof window !== 'undefined') {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<SoundSettings>;
      settings.master = clamp01(saved.master ?? 1);
      for (const { id } of SOUND_CHANNELS) settings.channels[id] = clamp01(saved.channels?.[id] ?? DEFAULTS[id]);
    }
    muted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch { /* privater Modus */ }
}

/** Was die UI anzeigt: Master, Stummschaltung und die drei Kanaele. */
export function soundSettings(): { readonly master: number; readonly muted: boolean; readonly channels: Record<SoundChannel, number> } {
  return { master: settings.master, muted, channels: { ...settings.channels } };
}

function persist(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify({ master: settings.master, channels: settings.channels }));
    window.localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch { /* privater Modus */ }
}

/** Regelt die laufenden Gain-Knoten nach; ein neuer Kontext uebernimmt sie beim Anlegen. */
function applyGains(): void {
  for (const { id } of SOUND_CHANNELS) {
    const node = gains.get(id);
    if (node) node.gain.value = muted ? 0 : settings.master * settings.channels[id];
  }
}

export function setMasterVolume(next: number): void {
  settings.master = clamp01(next);
  persist();
  applyGains();
}

export function setChannelVolume(channel: SoundChannel, next: number): void {
  settings.channels[channel] = clamp01(next);
  persist();
  applyGains();
}

export function isMuted(): boolean {
  return muted;
}

/** Merkt die Stummschaltung im Browser, nicht im Spielstand: sie ist Geraeteeinstellung. */
export function setMuted(next: boolean): void {
  muted = next;
  persist();
  applyGains();
}

function channelGain(ctx: AudioContext, channel: SoundChannel): GainNode {
  let node = gains.get(channel);
  if (!node) {
    node = ctx.createGain();
    node.connect(ctx.destination);
    gains.set(channel, node);
  }
  node.gain.value = muted ? 0 : settings.master * settings.channels[channel];
  return node;
}

function audio(channel: SoundChannel): { ctx: AudioContext; out: GainNode } | null {
  if (typeof window === 'undefined' || muted) return null;
  if (!context) {
    const legacy = (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const Ctor = window.AudioContext ?? legacy;
    if (!Ctor) return null;
    context = new Ctor();
  }
  if (context.state === 'suspended') void context.resume();
  return { ctx: context, out: channelGain(context, channel) };
}

interface Tone {
  readonly at: number;
  readonly hz: number;
  readonly length: number;
  readonly type: OscillatorType;
  readonly gain: number;
  readonly slide?: number;
}

function tone(ctx: AudioContext, out: AudioNode, spec: Tone): void {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = spec.type;
  osc.frequency.setValueAtTime(spec.hz, spec.at);
  if (spec.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, spec.slide), spec.at + spec.length);
  amp.gain.setValueAtTime(0.0001, spec.at);
  amp.gain.exponentialRampToValueAtTime(spec.gain, spec.at + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, spec.at + spec.length);
  osc.connect(amp).connect(out);
  osc.start(spec.at);
  osc.stop(spec.at + spec.length + 0.02);
}

/** Rauschen fuer Karten, Muenzen und Pruegeleien; Filterform ersetzt jedes Sample. */
function noise(ctx: AudioContext, out: AudioNode, at: number, length: number, gain: number, cutoff: number, type: BiquadFilterType): void {
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
  source.connect(filter).connect(amp).connect(out);
  source.start(at);
}

/** Jeder Effekt gehoert genau einem Kanal; die Zuordnung ist die einzige Wahrheit. */
const CHANNEL_OF: Readonly<Record<SfxKind, SoundChannel>> = {
  coin: 'game', reelStop: 'game', pinHit: 'game', roulette: 'game',
  brawl: 'combat',
  cardFlip: 'ui', win: 'ui',
};

export function playSfx(kind: SfxKind): void {
  const wired = audio(CHANNEL_OF[kind]);
  if (!wired) return;
  const { ctx, out } = wired;
  const now = ctx.currentTime;
  if (kind === 'coin') {
    tone(ctx, out, { at: now, hz: 1980, length: 0.1, type: 'triangle', gain: 0.06 });
    tone(ctx, out, { at: now + 0.05, hz: 2640, length: 0.12, type: 'triangle', gain: 0.05 });
    noise(ctx, out, now, 0.05, 0.03, 5200, 'highpass');
  } else if (kind === 'reelStop') {
    tone(ctx, out, { at: now, hz: 180, length: 0.1, type: 'square', gain: 0.05, slide: 70 });
  } else if (kind === 'pinHit') {
    tone(ctx, out, { at: now, hz: 980, length: 0.05, type: 'triangle', gain: 0.035 });
  } else if (kind === 'cardFlip') {
    noise(ctx, out, now, 0.09, 0.05, 2400, 'bandpass');
  } else if (kind === 'roulette') {
    tone(ctx, out, { at: now, hz: 620, length: 0.55, type: 'sine', gain: 0.04, slide: 210 });
    for (let tick = 0; tick < 7; tick += 1) tone(ctx, out, { at: now + 0.06 * tick, hz: 1200 - tick * 90, length: 0.03, type: 'square', gain: 0.02 });
  } else if (kind === 'brawl') {
    noise(ctx, out, now, 0.25, 0.09, 420, 'lowpass');
    tone(ctx, out, { at: now, hz: 110, length: 0.2, type: 'sawtooth', gain: 0.05, slide: 60 });
  } else {
    [523, 659, 784].forEach((hz, index) => tone(ctx, out, { at: now + index * 0.07, hz, length: 0.16, type: 'triangle', gain: 0.05 }));
  }
}

/** Pin-Serie fuer den Plinko-Lauf: ein Ping je Reihe, die Bahn selbst bleibt im Kern. */
export function playPinRun(pins = 7): void {
  const wired = audio('game');
  if (!wired) return;
  const { ctx, out } = wired;
  const now = ctx.currentTime;
  for (let index = 0; index < pins; index += 1) {
    tone(ctx, out, { at: now + index * 0.055, hz: 760 + index * 85, length: 0.05, type: 'triangle', gain: 0.03 });
  }
}
