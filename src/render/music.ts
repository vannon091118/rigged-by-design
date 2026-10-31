/**
 * Musikschicht in der vorhandenen Audioarchitektur: eigene Lautstaerke, drei
 * Zustaende, Crossfade, Lazy Loading. Gestreamt statt dekodiert, weil die Tracks
 * minutenlang sind; kurze Effekte bleiben synthetisch in `sound-fx.ts`, beide
 * teilen sich nur den Master.
 */
import manifest from './assets/manifest.json';
import { soundSettings, subscribeSoundSettings } from './sound-fx';

type MusicState = 'SILENT' | 'FLOOR' | 'GAMES' | 'SLOT';

type AudibleState = Exclude<MusicState, 'SILENT'>;

const VOLUME_KEY = 'rbd.music.volume';
const FADE_MS = 1_200;
const TICK_MS = 50;
const DEFAULT_VOLUME = 0.55;

const TRACKS: Readonly<Record<AudibleState, string>> = {
  FLOOR: `${manifest.base}${manifest.music.floor}`,
  GAMES: `${manifest.base}${manifest.music.games}`,
  SLOT: `${manifest.base}${manifest.music.slot}`,
};

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

function loadVolume(): number {
  if (typeof window === 'undefined') return DEFAULT_VOLUME;
  try {
    const raw = window.localStorage.getItem(VOLUME_KEY);
    if (raw === null) return DEFAULT_VOLUME;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? clamp01(parsed) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

let volume = loadVolume();
let current: MusicState = 'SILENT';
/** Solange der Browser ohne Geste blockiert, holt die naechste Geste das ab. */
let unlockAttached = false;

interface Deck {
  readonly audio: HTMLAudioElement;
  /** Welcher Track auf diesem Element liegt; `null` solange nichts geladen ist. */
  track: string | null;
  gain: number; // 0..1 innerhalb des Crossfades
}

let decks: [Deck, Deck] | null = null;
let active = 0;
let fadeTimer: ReturnType<typeof setInterval> | null = null;


export function musicVolume(): number {
  return volume;
}

function effective(): number {
  const { master, muted } = soundSettings();
  return muted ? 0 : clamp01(master * volume);
}

function makeDeck(): Deck {
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0;
  return { audio, track: null, gain: 0 };
}

function decksFor(): [Deck, Deck] | null {
  if (typeof window === 'undefined' || typeof Audio === 'undefined') return null;
  decks ??= [makeDeck(), makeDeck()];
  return decks;
}

/** Schreibt die aktuell gueltige Lautstaerke auf beide Elemente. */
function applyVolumes(): void {
  if (!decks) return;
  const level = effective();
  for (const deck of decks) deck.audio.volume = clamp01(deck.gain * level);
}

function stopFade(): void {
  if (fadeTimer !== null) {
    clearInterval(fadeTimer);
    fadeTimer = null;
  }
}

/** Wechselt weich auf einen Track und gibt das alte Element danach frei. */
function fadeTo(state: AudibleState): void {
  const pair = decksFor();
  if (!pair) return;
  const url = TRACKS[state];
  const nextIndex = active === 0 ? 1 : 0;
  const next = pair[nextIndex]!;
  const previous = pair[active]!;

  // Ein frisches `src` startet ohnehin vorn; `currentTime` vor den Metadaten bricht nur den Abruf ab.
  if (next.track !== url) {
    next.audio.src = url;
    next.track = url;
  }
  next.gain = 0;
  // Ohne Nutzergeste lehnt der Browser ab; das ist kein Fehler, nur Stille.
  void next.audio.play().catch(() => undefined);

  const start = Date.now();
  const from = previous.gain;
  active = nextIndex;
  stopFade();
  fadeTimer = setInterval(() => {
    const progress = Math.min(1, (Date.now() - start) / FADE_MS);
    next.gain = progress;
    previous.gain = from * (1 - progress);
    applyVolumes();
    if (progress < 1) return;
    stopFade();
    previous.gain = 0;
    previous.audio.pause();
    previous.audio.removeAttribute('src');
    previous.audio.load();
    previous.track = null;
    applyVolumes();
  }, TICK_MS);
  applyVolumes();
}

export function setMusicState(state: MusicState): void {
  if (state === current) return;
  current = state;
  if (state === 'SILENT') fadeOut();
  else fadeTo(state);
}

function fadeOut(): void {
  if (!decks) return;
  const playing = decks[active]!;
  playing.gain = 0;
  playing.audio.pause();
  stopFade();
  applyVolumes();
}

export function setMusicVolume(next: number): void {
  volume = clamp01(next);
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch { /* privater Modus */ }
  }
  applyVolumes();
}

/**
 * Ohne Geste blockieren Browser `play()`. Der Zuhoerer bleibt deshalb, bis
 * wirklich etwas laeuft; ein abgelehnter Versuch bedeutet nicht fuer immer Stummsein.
 */
export function armMusic(): () => void {
  if (typeof window === 'undefined' || unlockAttached) return () => undefined;
  unlockAttached = true;
  const unlock = (): void => {
    if (!decks) { detach(); return; }
    const deck = decks[active]!;
    if (!deck.track) { detach(); return; }
    void deck.audio.play().then(detach, () => undefined);
  };
  const detach = (): void => {
    unlockAttached = false;
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  return detach;
}

subscribeSoundSettings(applyVolumes);
