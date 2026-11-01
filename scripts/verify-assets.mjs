#!/usr/bin/env node
/**
 * Asset-Pruefung: jede Manifest-Referenz zeigt auf eine vorhandene Datei,
 * jedes Engine-Symbol hat eine Textur und im kuratierten Ordner liegt nichts,
 * was niemand benutzt.
 *
 * Der Grund fuer den letzten Punkt: ungenutzte Bilder landen sonst im
 * Production-Build, weil `public/` komplett mitkopiert wird.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const MANIFEST = join(ROOT, 'src/render/assets/manifest.json');
const PUBLIC_DIR = join(ROOT, 'public');
const SYMBOL_SOURCE = join(ROOT, 'src/core/games/engines/slot-paytable.ts');

const fail = (message) => {
  console.error(`[assets] ${message}`);
  process.exitCode = 1;
};

/** Alle Dateien unterhalb eines Ordners, relativ zu ihm. */
function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [relative(base, full).split(/[\\/]/).join('/')];
  });
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const base = manifest.base ?? '/assets/casino/';
if (!base.startsWith('/') || !base.endsWith('/')) fail(`base muss mit / beginnen und enden: ${base}`);

const assetRoot = join(PUBLIC_DIR, base);
const referenced = new Set();

/** Eine Referenz pruefen: Datei vorhanden, Groesse im Rahmen, als benutzt merken. */
function check(label, id, file, maxBytes = 256 * 1024) {
  if (typeof file !== 'string' || file.length === 0) {
    fail(`${label} ${id} hat keinen Pfad`);
    return;
  }
  referenced.add(file);
  const full = join(assetRoot, file);
  if (!existsSync(full)) fail(`${label} ${id} verweist auf fehlende Datei ${base}${file}`);
  else if (statSync(full).size > maxBytes) fail(`${label} ${id} ist groesser als ${(maxBytes / 1024).toFixed(0)} KB (${base}${file})`);
}

const imageCategories = ['symbols', 'machines', 'decor', 'plinko', 'ui', 'characters', 'environment', 'fx'];
for (const category of imageCategories) {
  const entries = manifest[category] ?? {};
  if (Object.keys(entries).length === 0) fail(`Kategorie ${category} ist leer`);
  for (const [id, file] of Object.entries(entries)) check(category, id, file);
}
for (const [id, file] of Object.entries(manifest.music ?? {})) check('Musik', id, file, 6 * 1024 * 1024);

for (const [id, animation] of Object.entries(manifest.animations ?? {})) {
  check('Animation', id, animation.source, 64 * 1024);
  if (!Array.isArray(animation.frames) || animation.frames.length === 0) fail(`Animation ${id} hat keine Frames`);
  for (const [index, frame] of (animation.frames ?? []).entries()) check('Frame', `${id}/${index}`, frame);
  if (!(animation.fps > 0)) fail(`Animation ${id} hat keine positive fps`);
}
for (const [id, emitter] of Object.entries(manifest.emitters ?? {})) {
  check('Emitter', id, emitter.source, 64 * 1024);
  for (const [index, texture] of (emitter.textures ?? []).entries()) check('Partikel', `${id}/${index}`, texture);
}

// Der Spielcode ist die Wahrheit darueber, welche Symbole die Engine zieht.
const source = readFileSync(SYMBOL_SOURCE, 'utf8');
const match = /export const SLOT_SYMBOLS = \[([^\]]+)\]/.exec(source);
if (!match) fail('SLOT_SYMBOLS nicht in slot-paytable.ts gefunden');
else {
  const symbols = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  for (const symbol of symbols) if (!(symbol in (manifest.symbols ?? {}))) fail(`Slot-Symbol ${symbol} hat keine Textur im Manifest`);
}

// Nichts Unbenutztes im kuratierten Ordner.
for (const file of walk(assetRoot)) {
  if (!referenced.has(file)) fail(`Datei ${base}${file} wird von keiner ID benutzt`);
}

const used = [...referenced].filter((file) => existsSync(join(assetRoot, file)));
const bytes = used.reduce((sum, file) => sum + statSync(join(assetRoot, file)).size, 0);
if (process.exitCode) process.exit(process.exitCode);
console.log(`[assets] ${used.length} Datei(en), ${(bytes / 1024 / 1024).toFixed(1)} MB, alle Referenzen aufgeloest`);
