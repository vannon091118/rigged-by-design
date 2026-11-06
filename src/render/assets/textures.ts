/**
 * Texturen aus dem Pixel-Paket: erst der Laufzeit-Atlas, dann die Einzeldatei.
 * Ein Cache, Nearest-Sampling und ein stiller Rueckfall auf die gezeichnete
 * Grafik: fehlt eine Datei oder scheitert das Laden, zeichnet der Aufrufer wie
 * vorher. Deshalb gibt es hier keinen Wurf, sondern `null`.
 */
import { Assets, Texture } from 'pixi.js';
import manifest from './manifest.json';
import { atlasTexture, loadAtlas, type AtlasManifest } from './atlas';
import { RUNTIME_ART } from './keys';

const BASE = manifest.base;
const SLOT_SYMBOLS: Readonly<Record<string, string>> = manifest.symbols;
const ATLAS = (manifest.atlas ?? { size: 1024, padding: 2, order: [], folders: {} }) as AtlasManifest;
const ATLAS_FOLDERS = new Set(ATLAS.order);

/** Einmal geladene Texturen; der Schluessel ist der vollstaendige Pfad. */
const cache = new Map<string, Texture>();
/** Gescheiterte Pfade werden nicht bei jedem Frame erneut versucht. */
const failed = new Set<string>();
let atlasPending: Promise<void> | null = null;

function prepare(texture: Texture): Texture {
  // Pixel-Art wird ohne Glaettung skaliert, sonst verliert sie ihre Kanten.
  texture.source.scaleMode = 'nearest';
  return texture;
}

function ensureAtlas(): Promise<void> {
  atlasPending ??= loadAtlas(ATLAS, BASE).catch(() => undefined);
  return atlasPending;
}

/** Nur Pfade aus den vier Atlas-Ordnern warten auf den Packvorgang. */
function inAtlas(relative: string): boolean {
  const slash = relative.indexOf('/');
  return slash > 0 && ATLAS_FOLDERS.has(relative.slice(0, slash));
}

/** Datei des Slot-Symbols, falls das Paket eines dafuer hat. */
export function slotSymbolAsset(id: string): string | null {
  return SLOT_SYMBOLS[id] ?? null;
}

/** Bereits geladene Textur oder `null`; nie blockierend, nie werfend. */
export function textureFor(relative: string): Texture | null {
  const url = `${BASE}${relative}`;
  const atlas = atlasTexture(relative);
  if (atlas) {
    cache.set(url, atlas);
    return atlas;
  }
  const hit = cache.get(url);
  if (hit) return hit;
  if (failed.has(url)) return null;
  const loaded = Assets.get<Texture>(url);
  if (!loaded) return null;
  const ready = prepare(loaded);
  cache.set(url, ready);
  return ready;
}

/** Laedt eine Liste relativer Pfade; jeder Fehler bleibt lokal und still. */
async function preloadTextures(entries: Iterable<string>): Promise<void> {
  const unique = [...new Set(entries)];
  if (unique.some(inAtlas)) await ensureAtlas();
  await Promise.all(unique.map(async (relative) => {
    const url = `${BASE}${relative}`;
    if (cache.has(url) || failed.has(url)) return;
    const atlas = atlasTexture(relative);
    if (atlas) { cache.set(url, atlas); return; }
    try {
      const texture = await Assets.load<Texture>(url);
      cache.set(url, prepare(texture));
    } catch {
      failed.add(url);
    }
  }));
}

/** Nur die Atlasseiten; der erste Frame braucht keine Einzeltexturen. */
export async function preloadAtlas(): Promise<void> {
  await ensureAtlas();
}

/** Was die Slot-Buehne braucht, bevor sie Walzen baut. */
export async function preloadSlotSymbols(): Promise<void> {
  await preloadTextures(Object.values(SLOT_SYMBOLS));
}

/** Maschinen-Texturen als Backdrop vorladen. */
export async function preloadMachineTextures(): Promise<void> {
  await preloadTextures(Object.values(manifest.machines));
}

/** Deko-Texturen fuer den Boden; der Katalog laedt den Rest lazy. */
export async function preloadDecorTextures(): Promise<void> {
  await preloadTextures(Object.values(manifest.decor));
}

/** Pegs, Bumper und Auszahlungsfelder der Plinko-Buehne. */
export async function preloadPlinkoTextures(): Promise<void> {
  await preloadTextures(Object.values(manifest.plinko));
}

/** Figuren, Karten, Teppich und Partikel, die die Spielbuehnen sofort brauchen. */
export async function preloadRuntimeArt(): Promise<void> {
  await preloadTextures(RUNTIME_ART);
}
