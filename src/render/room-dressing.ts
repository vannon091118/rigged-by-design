/**
 * Raumausstattung ueber dem Bodenbelag: das, was einen Raum wiedererkennbar macht,
 * ohne Laufwege zu blockieren. Alles statisch und an die Zone gebunden.
 */
import { Graphics, Sprite, type Container } from 'pixi.js';
import { LIGHT, ROLE, SHADOW, WORLD_FLATTEN, type FloorMaterial, type LightState } from './art-tokens';
import { textureFor } from './assets/textures';
import { clipRect, fillBand } from './floor-surface';

interface Rect { x: number; y: number; w: number; h: number }
interface ZoneLike { kind: string; x: number; y: number; w: number; h: number }

/** Drei Requisiten je Zone, deterministisch aus dem Zonenrechteck gesetzt. */
const DRESSING: Readonly<Record<string, readonly (readonly [string, number, number, number, number])[]>> = {
  BAR: [
    ['decor/bar-back-shelf.png', 0.18, 0.2, 54, 20],
    ['decor/bar-counter-stools.png', 0.66, 0.46, 40, 24],
    ['decor/cocktail-neon-sign.png', 0.84, 0.16, 26, 14],
  ],
  EXCHANGE: [
    ['machines/cash-register.png', 0.24, 0.34, 20, 20],
    ['machines/card-payment-terminal.png', 0.44, 0.36, 14, 18],
    ['decor/wall-sconce.png', 0.8, 0.16, 16, 20],
  ],
  GAMING: [
    ['decor/casino-column.png', 0.18, 0.24, 22, 44],
    ['decor/potted-palm.png', 0.82, 0.7, 24, 34],
    ['decor/neon-column.png', 0.62, 0.22, 14, 38],
  ],
  STORAGE: [
    ['machines/storage-shelves.png', 0.26, 0.22, 46, 22],
    ['decor/wall-sconce.png', 0.72, 0.14, 14, 18],
    ['decor/casino-side-table.png', 0.78, 0.72, 22, 18],
  ],
};

/** Requisiten in den Chunk legen: ein Sprite je Objekt, gebacken mit dem Raum. */
function placeDressing(deco: Container | undefined, rect: Rect, kind: string, clip?: Rect): void {
  if (!deco) return;
  for (const [key, fx, fy, w, h] of DRESSING[kind] ?? []) {
    const texture = textureFor(key);
    if (!texture) continue;
    const x = rect.x + rect.w * fx;
    const y = rect.y + rect.h * fy;
    // Ein Requisit gehoert genau einem Chunk; ausserhalb waere es ein Duplikat.
    if (clip && (x < clip.x || y < clip.y || x > clip.x + clip.w || y > clip.y + clip.h)) continue;
    // Fussanker statt Mitte: die Requisite steht auf dem Boden, sie schwebt nicht
    // ueber der Kachel. Der Schatten liegt als eigene Flaeche darunter.
    const shadow = new Graphics();
    shadow.ellipse(x, y, w * 0.4, Math.max(2, h * 0.11)).fill({ color: 0x000000, alpha: SHADOW.base * 0.7 });
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 1);
    sprite.width = w;
    sprite.height = h * WORLD_FLATTEN;
    sprite.position.set(x, y);
    sprite.alpha = 0.94;
    deco.addChild(shadow, sprite);
  }
}

/** Rueckwand der Bar: Regalbretter mit Flaschen, damit die Bar eine Bar ist. */
function backBar(g: Graphics, rect: Rect, zone: ZoneLike, clip?: Rect): void {
  const left = Math.max(rect.x + 14, zone.x * 26 + 14);
  const right = Math.min(rect.x + rect.w - 14, (zone.x + zone.w) * 26 - 14);
  if (right - left < 24) return;
  // Eine Rueckwandnische mit zwei Brettern und wenigen Flaschen: ruhig statt Konfetti.
  fillBand(g, { x: left, y: rect.y + 8, w: right - left, h: 12 }, 0x000000, 0.16, clip);
  fillBand(g, { x: left, y: rect.y + 8, w: right - left, h: 1 }, ROLE.warning, 0.28, clip);
  fillBand(g, { x: left, y: rect.y + 19, w: right - left, h: 1 }, 0x000000, 0.3, clip);
  for (let x = left + 10; x < right - 12; x += 34) fillBand(g, { x, y: rect.y + 13, w: 3, h: 6 }, ROLE.value, 0.32, clip);
}

/** Fliesen-Sockel im Klo: halbe Wandhoehe, damit der Raum nach Nassbereich aussieht. */
function wainscot(g: Graphics, rect: Rect, tile: number, clip?: Rect): void {
  const band = Math.min(rect.h * 0.4, tile * 2.2);
  const y = rect.y + rect.h - band;
  fillBand(g, { x: rect.x, y, w: rect.w, h: band }, LIGHT.cool, 0.05, clip);
  fillBand(g, { x: rect.x, y, w: rect.w, h: 1 }, LIGHT.cool, 0.22, clip);
  for (let x = rect.x + tile; x < rect.x + rect.w; x += tile) fillBand(g, { x, y, w: 1, h: band }, LIGHT.cool, 0.1, clip);
}

/** Neon-Pilaster im Spielsaal: zwei Lichtachsen, die den Saal gliedern. */
function pilasters(g: Graphics, rect: Rect, zone: ZoneLike, tile: number, light: LightState, clip?: Rect): void {
  for (const share of [0.32, 0.68]) {
    const x = Math.round((zone.x + zone.w * share) * tile);
    if (x < rect.x + 4 || x > rect.x + rect.w - 6) continue;
    fillBand(g, { x, y: rect.y, w: 2, h: rect.h }, ROLE.identity, 0.1 * light.intensity, clip);
    fillBand(g, { x: x - 1, y: rect.y + 2, w: 4, h: 8 }, ROLE.identity, 0.32 * light.intensity, clip);
  }
}

/** Lager: Bodenmarkierung, damit der Raum als Wirtschaftsflaeche liest. */
function marking(g: Graphics, rect: Rect, clip?: Rect): void {
  const y = Math.round(rect.y + rect.h * 0.58);
  for (let x = rect.x + 8; x < rect.x + rect.w - 8; x += 20) fillBand(g, { x, y, w: 10, h: 3 }, ROLE.warning, 0.14, clip);
  // Der Rahmen bleibt ganz oder gar nicht: ein angeschnittenes Rechteck waere eine zweite Kante.
  const outline = { x: rect.x + 4, y: rect.y + 4, w: rect.w - 8, h: rect.h - 8 };
  if (!clip || clipRect(outline, clip)?.w === outline.w) {
    g.rect(outline.x, outline.y, outline.w, outline.h).stroke({ width: 1, color: ROLE.warning, alpha: 0.08 });
  }
}

/** Lounge: warmes Wandlicht, weicher als im Spielsaal. */
function loungeWash(g: Graphics, rect: Rect, light: LightState, clip?: Rect): void {
  fillBand(g, { x: rect.x, y: rect.y + rect.h - 14, w: rect.w, h: 14 }, light.tint, 0.04 * light.intensity, clip);
  fillBand(g, { x: rect.x, y: rect.y + rect.h - 14, w: rect.w, h: 1 }, light.tint, 0.16 * light.intensity, clip);
}

export function drawDressing(
  g: Graphics, mat: FloorMaterial, rect: Rect, zone: ZoneLike, tile: number,
  deco?: Container, light: LightState = { tint: mat.light, intensity: 1 }, clip?: Rect,
): void {
  placeDressing(deco, rect, zone.kind, clip);
  if (zone.kind === 'BAR') backBar(g, rect, zone, clip);
  else if (zone.kind === 'TOILET') wainscot(g, rect, tile, clip);
  else if (zone.kind === 'GAMING') pilasters(g, rect, zone, tile, light, clip);
  else if (zone.kind === 'STORAGE') marking(g, rect, clip);
  else if (zone.kind === 'LOUNGE') loungeWash(g, rect, light, clip);
  // Sockel: dunkle Kante direkt ueber dem Boden an jeder Wand, unabhaengig vom Raum.
  fillBand(g, { x: rect.x, y: rect.y + rect.h - 3, w: rect.w, h: 3 }, 0x000000, 0.18, clip);
  fillBand(g, { x: rect.x, y: rect.y + rect.h - 3, w: rect.w, h: 1 }, mat.accent, 0.14, clip);
}
