#!/usr/bin/env node
/**
 * Musik-Master zu Browser-Audio: die WAV-Dateien bleiben Master und liegen
 * ausserhalb des Repositories, ausgeliefert wird Opus in OGG.
 *
 * Quelle: RBD_AUDIO_SOURCE oder der Standardordner des Asset-Pakets.
 * Ziel:   public/assets/casino/music/
 *
 * Das Skript schreibt nur ins Ziel und meldet fuer jede Datei Quell- und
 * Zieldateigroesse, damit die Entscheidung messbar bleibt und nicht geschaetzt.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const ROOT = resolve(import.meta.dirname, '..');
const SOURCE = process.env.RBD_AUDIO_SOURCE
  ?? 'C:/Users/vanno/Downloads/casino_asset_sounds_prealpha/sounds';
const TARGET = join(ROOT, 'public/assets/casino/music');

/** Was im Spiel gebraucht wird; alles andere bleibt Master und wird nicht ausgeliefert. */
const TRACKS = [
  { id: 'floor', file: 'Atmosphäre_base.wav', bitrate: '96k' },
  { id: 'night', file: 'Atmosphäre_night_Prototyp.wav', bitrate: '80k' },
  { id: 'menu', file: 'Maintheme.wav', bitrate: '96k' },
  { id: 'background', file: 'background_loop.wav', bitrate: '96k' },
  { id: 'games', file: 'atmosphäre_base_fullcasino.wav', bitrate: '80k' },
  { id: 'slot', file: 'Slot1.wav', bitrate: '80k' },
];

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;

if (!ffmpegPath || !existsSync(ffmpegPath)) {
  console.error('[audio] ffmpeg fehlt: npm rebuild ffmpeg-static');
  process.exit(1);
}
if (!existsSync(SOURCE)) {
  console.error(`[audio] Quellordner fehlt: ${SOURCE}`);
  process.exit(1);
}
mkdirSync(TARGET, { recursive: true });

let sourceBytes = 0;
let targetBytes = 0;

for (const track of TRACKS) {
  const input = join(SOURCE, track.file);
  if (!existsSync(input)) {
    console.error(`[audio] Datei fehlt: ${track.file}`);
    process.exitCode = 1;
    continue;
  }
  const output = join(TARGET, `${track.id}.ogg`);
  execFileSync(ffmpegPath, [
    '-v', 'error', '-y',
    '-i', input,
    '-vn', '-ac', '2', '-ar', '48000',
    '-c:a', 'libopus', '-b:a', track.bitrate,
    output,
  ], { stdio: ['ignore', 'ignore', 'inherit'] });
  const before = statSync(input).size;
  const after = statSync(output).size;
  sourceBytes += before;
  targetBytes += after;
  const ratio = ((after / before) * 100).toFixed(1);
  console.log(`[audio] ${track.id.padEnd(6)} ${kb(before).padStart(8)} -> ${kb(after).padStart(7)} (${ratio} %)`);
}

// Kontrolllauf: eine kaputte Datei faellt hier auf, nicht erst im Browser.
execFileSync(ffmpegPath, ['-v', 'error', '-i', join(TARGET, 'floor.ogg'), '-f', 'null', '-'], { stdio: 'ignore' });
console.log(`[audio] gesamt ${kb(sourceBytes)} -> ${kb(targetBytes)} (${((targetBytes / sourceBytes) * 100).toFixed(1)} %)`);
console.log('[audio] Master unveraendert im Quellordner, ausgeliefert wird nur public/assets/casino/music');
