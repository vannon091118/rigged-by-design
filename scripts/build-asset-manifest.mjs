#!/usr/bin/env node
/**
 * Baut `src/render/assets/manifest.json` aus dem kuratierten Paket unter
 * `public/assets/casino/`. Die Datei ist eingecheckt, damit der Build ohne
 * Quellordner reproduzierbar bleibt; dieses Skript ist der Weg dorthin.
 */
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { buildAtlasPages } from './lib/atlas-png.mjs';
import { encodeWebp } from './lib/atlas-webp.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const ASSET_ROOT = join(ROOT, 'public/assets/casino');
const TARGET = join(ROOT, 'src/render/assets/manifest.json');
const BASE = '/assets/casino/';
const ATLAS_FOLDERS = ['characters', 'decor', 'environment', 'machines'];
const ATLAS_SIZE = 1024;
// 0 Padding: Nearest-Sampling braucht keinen Saum; zwei 512er-Kacheln passen
// so nebeneinander, und der Produktionspfad bleibt bei zwei Atlasseiten.
const ATLAS_PADDING = 0;

const ENGINE_SYMBOLS = {
  BOOK: 'symbols/book.png',
  SCARAB: 'symbols/scarab.png',
  ANKH: 'symbols/ankh.png',
  EYE: 'symbols/eye-of-horus.png',
  URN: 'symbols/urn.png',
  A: 'symbols/rank-a.png',
  K: 'symbols/rank-k.png',
  Q: 'symbols/rank-q.png',
  J: 'symbols/rank-j.png',
};

const MUSIC = {
  floor: 'music/floor.ogg',
  night: 'music/night.ogg',
  menu: 'music/menu.ogg',
  background: 'music/background.ogg',
  games: 'music/games.ogg',
  slot: 'music/slot.ogg',
};

function walk(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full, base);
    return [relative(base, full).split(/[\\/]/).join('/')];
  });
}

// Generierte Atlasseiten sind Ausgabe, keine Quelle; verify-assets prueft sie
// separat ueber atlas.pages. Die Seiten liegen als WebP, weil PNG fuer denselben
// Sprite-Bestand rund 2,6x groesser ist.
const all = walk(ASSET_ROOT).filter((file) => !file.startsWith('atlas/')).sort();
const png = all.filter((file) => file.endsWith('.png'));
const json = all.filter((file) => file.endsWith('.json'));
const ogg = all.filter((file) => file.endsWith('.ogg'));

const byTop = (top) => png.filter((file) => file.startsWith(`${top}/`));
const asMap = (top) => Object.fromEntries(byTop(top).map((file) => [file, file]));

// Die Seiten werden aus denselben kuratierten Ordnern gebaut, die der
// Laufzeit-Fallback packt. Damit liegt der Shelf-Plan einmal im Build fest und
// die App laedt im Produktionspfad nur noch wenige Seiten statt 153 Bilder.
const atlasPages = buildAtlasPages({
  assetRoot: ASSET_ROOT,
  files: ATLAS_FOLDERS.flatMap(byTop),
  size: ATLAS_SIZE,
  padding: ATLAS_PADDING,
  outputDir: join(ASSET_ROOT, 'atlas'),
}).map((page) => {
  // 1.040.593 B PNG gegen 394.592 B WebP-q95; die Seiten sind der groesste
  // Einzelposten vor dem ersten Frame. Der Laufzeitpfad laedt nur die URL.
  const png = join(ASSET_ROOT, page.source);
  const webp = png.replace(/\.png$/, '.webp');
  encodeWebp(png, webp);
  rmSync(png);
  return { ...page, source: page.source.replace(/\.png$/, '.webp') };
});

const symbols = { ...ENGINE_SYMBOLS };
for (const file of byTop('symbols')) {
  const stem = file.slice('symbols/'.length, -'.png'.length);
  const key = stem.toUpperCase().replaceAll('-', '_');
  if (!Object.values(ENGINE_SYMBOLS).includes(file)) symbols[key] = file;
}

const animations = {};
const emitters = {};
for (const file of json) {
  const parsed = JSON.parse(readFileSync(join(ASSET_ROOT, file), 'utf8'));
  if (file.startsWith('fx/animations/')) {
    animations[parsed.id] = {
      source: file,
      frames: parsed.frames.map((frame) => `fx/${frame}`),
      fps: parsed.fps,
      loop: Boolean(parsed.loop),
    };
  } else if (file.startsWith('fx/emitters/')) {
    const textures = parsed.textures ?? (parsed.texture ? [parsed.texture] : []);
    emitters[parsed.id] = {
      ...parsed,
      source: file,
      textures: textures.map((texture) => `fx/${texture}`),
    };
    delete emitters[parsed.id].texture;
  }
}

const manifest = {
  version: 4,
  base: BASE,
  atlas: {
    size: ATLAS_SIZE,
    padding: ATLAS_PADDING,
    order: ATLAS_FOLDERS,
    frameCount: ATLAS_FOLDERS.reduce((sum, folder) => sum + byTop(folder).length, 0),
    folders: Object.fromEntries(ATLAS_FOLDERS.map((folder) => [folder, byTop(folder)])),
    pages: atlasPages,
  },
  symbols,
  machines: asMap('machines'),
  decor: asMap('decor'),
  plinko: asMap('plinko'),
  ui: asMap('ui'),
  characters: asMap('characters'),
  environment: asMap('environment'),
  fx: asMap('fx'),
  animations,
  emitters,
  music: MUSIC,
};

// Die Musik ist die einzige Kategorie, deren Dateien nicht im Asset-Baum
// gespiegelt werden; sie kommt aus dem Encode-Schritt.
for (const [id, file] of Object.entries(MUSIC)) {
  if (!ogg.includes(file)) throw new Error(`Musikdatei fehlt: ${id} -> ${file}`);
}

writeFileSync(TARGET, `${JSON.stringify(manifest, null, 2)}\n`);
const covered = new Set([
  ...Object.values(symbols), ...Object.values(manifest.machines), ...Object.values(manifest.decor),
  ...Object.values(manifest.plinko), ...Object.values(manifest.ui), ...Object.values(manifest.characters),
  ...Object.values(manifest.environment), ...Object.values(manifest.fx), ...Object.values(MUSIC),
  ...atlasPages.map((page) => page.source),
  ...Object.values(animations).flatMap((entry) => [entry.source, ...entry.frames]),
  ...Object.values(emitters).flatMap((entry) => [entry.source, ...entry.textures]),
]);
const missing = all.filter((file) => !covered.has(file) && !file.endsWith('.ogg'));
if (missing.length > 0) throw new Error(`Nicht im Manifest: ${missing.slice(0, 10).join(', ')}`);
console.log(`[manifest] ${covered.size} Referenzen, ${all.length} Dateien im Paket`);
