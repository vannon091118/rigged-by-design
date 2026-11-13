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
import { loadNarrativeContent } from './lib/narrative-content.mjs';
import { POOL_MINIMUM, POOL_TARGET, poolIssues, poolReport, poolSlots, quotaTotal } from './lib/narrative-blocks.mjs';

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

// Der Laufzeit-Atlas braucht eine deterministische, vollstaendige Frame-Liste.
const atlas = manifest.atlas;
if (!atlas) fail('atlas-Sektion fehlt');
else {
  const folders = ['characters', 'decor', 'environment', 'machines'];
  if (!Array.isArray(atlas.order) || atlas.order.join(',') !== folders.join(',')) {
    fail(`atlas.order muss ${folders.join(',')} sein`);
  }
  if (!(atlas.size > 0) || !(atlas.padding >= 0)) fail('atlas.size/padding ist ungueltig');
  let frames = 0;
  let pageFrames = 0;
  const pagePaths = new Set();
  if (atlas.pages !== undefined) {
    if (!Array.isArray(atlas.pages) || atlas.pages.length === 0) fail('atlas.pages ist leer');
    for (const [index, page] of (atlas.pages ?? []).entries()) {
      if (!page || typeof page.source !== 'string') { fail(`atlas.pages[${index}] hat keine Quelle`); continue; }
      const full = join(assetRoot, page.source);
      if (!existsSync(full)) fail(`atlas.pages[${index}]: ${page.source} fehlt`);
      else if (statSync(full).size > 2 * 1024 * 1024) fail(`atlas.pages[${index}] ist groesser als 2 MB`);
      referenced.add(page.source);
      if (!Array.isArray(page.frames) || page.frames.length === 0) { fail(`atlas.pages[${index}] hat keine Frames`); continue; }
      for (const frame of page.frames) {
        pageFrames += 1;
        pagePaths.add(frame.path);
        if (!folders.some((folder) => frame.path.startsWith(`${folder}/`))) fail(`atlas.pages[${index}]: ${frame.path} liegt in keinem Atlas-Ordner`);
        if (frame.x < 0 || frame.y < 0 || frame.width <= 0 || frame.height <= 0
          || frame.x + frame.width > atlas.size || frame.y + frame.height > atlas.size) {
          fail(`atlas.pages[${index}]: ${frame.path} liegt ausserhalb der Seite`);
        }
      }
    }
    if (pageFrames !== atlas.frameCount) fail(`atlas.pages hat ${pageFrames} Frames, frameCount ist ${atlas.frameCount}`);
  }
  for (const folder of folders) {
    const list = atlas.folders?.[folder];
    if (!Array.isArray(list) || list.length === 0) { fail(`atlas.folders.${folder} ist leer`); continue; }
    const sorted = [...list].sort();
    if (list.some((file, index) => file !== sorted[index])) fail(`atlas.folders.${folder} ist nicht sortiert`);
    for (const file of list) {
      frames += 1;
      if (!file.startsWith(`${folder}/`)) fail(`atlas.folders.${folder}: ${file} liegt nicht im Ordner`);
      if (!existsSync(join(assetRoot, file))) fail(`atlas.folders.${folder}: ${file} fehlt`);
      referenced.add(file);
      if (atlas.pages !== undefined && !pagePaths.has(file)) fail(`atlas.pages: ${file} fehlt`);
    }
    if (new Set(list).size !== list.length) fail(`atlas.folders.${folder} enthaelt Duplikate`);
  }
  if (atlas.frameCount !== frames) fail(`atlas.frameCount ist ${atlas.frameCount}, gezaehlt ${frames}`);
}

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

// NAR-09/NAR-11: JSON- und Runtime-Registry sind Teil des bestehenden Assets-Gates.
const narrative = loadNarrativeContent(ROOT);
if (!narrative.ok) {
  for (const problem of narrative.issues) fail(`[ERR-4022] ${problem.path}: ${problem.message}`);
} else {
  console.log(`[assets] ${narrative.contributionCount} Narrative-Beitraege, ${narrative.turnCount} Turns, ${narrative.registryCount} Registry-Fragmente`);
  const pools = poolReport(narrative.compiled.fragments);
  const poolProblems = poolIssues({ ...pools, slots: poolSlots(narrative.vocabulary) });
  for (const problem of poolProblems) fail(`[ERR-4022] ${problem}`);
  if (poolProblems.length === 0) {
    console.log(`[assets] ${quotaTotal(pools.counts, pools.total)}/${POOL_TARGET} gewertete Textbausteine (${pools.total} gesamt), alle gewerteten Pools ab ${POOL_MINIMUM}`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(`[assets] ${used.length} Datei(en), ${(bytes / 1024 / 1024).toFixed(1)} MB, alle Referenzen aufgeloest`);
