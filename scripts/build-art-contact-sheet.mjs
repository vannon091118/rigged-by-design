#!/usr/bin/env node
/**
 * Kontaktbogen fuer den Art-Audit: Environment-Assets und repraesentative
 * Casino-PNGs in einer dunklen Uebersicht. Die Reihenfolge ist zeilenweise
 * und steht in `docs/art-needs.md`; das Bild ist der Sichtnachweis, keine
 * Laufzeittextur.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { decodePng, encodePng, readPng } from './lib/atlas-png.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'build-art-contact-sheet' });

const ROOT = resolve(import.meta.dirname, '..');
const ASSETS = join(ROOT, 'public/assets/casino');
const OUT = join(ROOT, 'docs/visual-rework/phase1/environment-contact-sheet.png');
const COLS = 5;
const CELL = 192;
const GAP = 16;

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [relative(base, full).split(/[\\/]/).join('/')];
  });
}

const environment = walk(join(ASSETS, 'environment'))
  .filter((file) => file.endsWith('.png') || file.endsWith('.svg'))
  .sort()
  .map((file) => `environment/${file}`);
const casino = [
  'characters/head-01-01.png',
  'characters/head-02-01.png',
  'machines/table-games/card-back.png',
  'machines/table-games/poker-chip-single.png',
  'machines/blackjack-table.png',
  'machines/cash-register.png',
  'machines/bar-bottle-amber.png',
];
const files = [...environment, ...casino.filter((file) => environment.includes(file) === false)];

function load(relativePath) {
  if (!relativePath.endsWith('.svg')) return readPng(join(ASSETS, relativePath));
  const rendered = new Resvg(readFileSync(join(ASSETS, relativePath)), { fitTo: { mode: 'original' } }).render();
  return decodePng(rendered.asPng(), relativePath);
}

function resizeNearest(source, maxWidth, maxHeight) {
  const scale = Math.min(maxWidth / source.width, maxHeight / source.height);
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor(y / scale));
    for (let x = 0; x < width; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor(x / scale));
      const from = (sourceY * source.width + sourceX) * 4;
      source.data.copy(data, (y * width + x) * 4, from, from + 4);
    }
  }
  return { width, height, data };
}

const rows = Math.ceil(files.length / COLS);
const width = COLS * CELL + GAP * (COLS + 1);
const height = rows * CELL + GAP * (rows + 1);
const sheet = Buffer.alloc(width * height * 4);
for (let i = 0; i < width * height; i += 1) {
  sheet[i * 4] = 0x0b;
  sheet[i * 4 + 1] = 0x07;
  sheet[i * 4 + 2] = 0x12;
  sheet[i * 4 + 3] = 255;
}

files.forEach((file, index) => {
  const image = resizeNearest(load(file), CELL - 16, CELL - 16);
  const cellX = GAP + (index % COLS) * (CELL + GAP);
  const cellY = GAP + Math.floor(index / COLS) * (CELL + GAP);
  const left = cellX + Math.floor((CELL - image.width) / 2);
  const top = cellY + Math.floor((CELL - image.height) / 2);
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      const from = (y * image.width + x) * 4;
      const to = ((top + y) * width + left + x) * 4;
      const alpha = image.data[from + 3] / 255;
      sheet[to] = Math.round(image.data[from] * alpha + sheet[to] * (1 - alpha));
      sheet[to + 1] = Math.round(image.data[from + 1] * alpha + sheet[to + 1] * (1 - alpha));
      sheet[to + 2] = Math.round(image.data[from + 2] * alpha + sheet[to + 2] * (1 - alpha));
    }
  }
});

mkdirSync(join(ROOT, 'docs/visual-rework/phase1'), { recursive: true });
writeFileSync(OUT, encodePng(width, height, sheet));
console.log(JSON.stringify({ output: relative(ROOT, OUT), width, height, files }, null, 2));
