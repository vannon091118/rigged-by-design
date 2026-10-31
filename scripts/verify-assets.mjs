#!/usr/bin/env node
/**
 * Asset-Pruefung: jede Referenz im Manifest zeigt auf eine vorhandene Datei,
 * jedes Slot-Symbol hat eine Zuordnung und im kuratierten Ordner liegt nichts,
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

/** Alle PNGs unterhalb eines Ordners, relativ zu ihm. */
function walk(dir, base = dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [relative(base, full).replaceAll('\\', '/')];
  });
}

const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const base = manifest.base ?? '/assets/casino/';
const files = manifest.slotSymbols ?? {};

if (!base.startsWith('/') || !base.endsWith('/')) fail(`base muss mit / beginnen und enden: ${base}`);

const referenced = new Set();

/** Eine Referenz pruefen: Pfad eindeutig, Datei vorhanden, Groesse im Rahmen. */
function check(label, id, file, maxBytes) {
  if (typeof file !== 'string' || file.length === 0) {
    fail(`${label} ${id} hat keinen Pfad`);
    return;
  }
  if (referenced.has(file)) fail(`Pfad ${file} ist mehrfach vergeben`);
  referenced.add(file);
  const full = join(PUBLIC_DIR, base, file);
  if (!existsSync(full)) fail(`${label} ${id} verweist auf fehlende Datei ${base}${file}`);
  else if (statSync(full).size > maxBytes) {
    fail(`${label} ${id} ist groesser als ${(maxBytes / 1024).toFixed(0)} KB (${base}${file})`);
  }
}

for (const [id, file] of Object.entries(files)) check('ID', id, file, 256 * 1024);
for (const [id, file] of Object.entries(manifest.music ?? {})) check('Musik', id, file, 6 * 1024 * 1024);

// Der Spielcode ist die Wahrheit darueber, welche Symbole es gibt.
const source = readFileSync(SYMBOL_SOURCE, 'utf8');
const match = /export const SLOT_SYMBOLS = \[([^\]]+)\]/.exec(source);
if (!match) fail('SLOT_SYMBOLS nicht in slot-paytable.ts gefunden');
else {
  const symbols = [...match[1].matchAll(/'([^']+)'/g)].map((entry) => entry[1]);
  for (const symbol of symbols) if (!(symbol in files)) fail(`Slot-Symbol ${symbol} hat keine Textur im Manifest`);
  for (const id of Object.keys(files)) if (!symbols.includes(id)) fail(`Manifest-ID ${id} ist kein Slot-Symbol`);
}

// Nichts Unbenutztes im kuratierten Ordner.
const assetRoot = join(PUBLIC_DIR, base);
for (const file of walk(assetRoot)) {
  if (!referenced.has(file)) fail(`Datei ${base}${file} wird von keiner ID benutzt`);
}

const used = [...referenced].filter((file) => existsSync(join(assetRoot, file)));
const bytes = used.reduce((sum, file) => sum + statSync(join(assetRoot, file)).size, 0);
if (process.exitCode) process.exit(process.exitCode);
console.log(`[assets] ${used.length} Datei(en), ${(bytes / 1024).toFixed(1)} KB, alle Referenzen aufgeloest`);
