/**
 * Raumausstattung ueber dem Bodenbelag: das, was einen Raum wiedererkennbar macht,
 * ohne Laufwege zu blockieren. Alles statisch und an die Zone gebunden.
 */
import type { Graphics } from 'pixi.js';
import { LIGHT, ROLE, type FloorMaterial } from './art-tokens';

interface Rect { x: number; y: number; w: number; h: number }
interface ZoneLike { kind: string; x: number; y: number; w: number; h: number }

/** Rueckwand der Bar: Regalbretter mit Flaschen, damit die Bar eine Bar ist. */
function backBar(g: Graphics, rect: Rect, zone: ZoneLike): void {
  const left = Math.max(rect.x + 14, zone.x * 26 + 14);
  const right = Math.min(rect.x + rect.w - 14, (zone.x + zone.w) * 26 - 14);
  if (right - left < 24) return;
  // Eine Rueckwandnische mit zwei Brettern und wenigen Flaschen: ruhig statt Konfetti.
  g.rect(left, rect.y + 8, right - left, 12).fill({ color: 0x000000, alpha: 0.16 });
  g.rect(left, rect.y + 8, right - left, 1).fill({ color: ROLE.warning, alpha: 0.28 });
  g.rect(left, rect.y + 19, right - left, 1).fill({ color: 0x000000, alpha: 0.3 });
  for (let x = left + 10; x < right - 12; x += 34) g.rect(x, rect.y + 13, 3, 6).fill({ color: ROLE.value, alpha: 0.32 });
}

/** Fliesen-Sockel im Klo: halbe Wandhoehe, damit der Raum nach Nassbereich aussieht. */
function wainscot(g: Graphics, rect: Rect, tile: number): void {
  const band = Math.min(rect.h * 0.4, tile * 2.2);
  const y = rect.y + rect.h - band;
  g.rect(rect.x, y, rect.w, band).fill({ color: LIGHT.cool, alpha: 0.05 });
  g.rect(rect.x, y, rect.w, 1).fill({ color: LIGHT.cool, alpha: 0.22 });
  for (let x = rect.x + tile; x < rect.x + rect.w; x += tile) g.rect(x, y, 1, band).fill({ color: LIGHT.cool, alpha: 0.1 });
}

/** Neon-Pilaster im Spielsaal: zwei Lichtachsen, die den Saal gliedern. */
function pilasters(g: Graphics, rect: Rect, zone: ZoneLike, tile: number): void {
  for (const share of [0.32, 0.68]) {
    const x = Math.round((zone.x + zone.w * share) * tile);
    if (x < rect.x + 4 || x > rect.x + rect.w - 6) continue;
    g.rect(x, rect.y, 2, rect.h).fill({ color: ROLE.identity, alpha: 0.1 });
    g.rect(x - 1, rect.y + 2, 4, 8).fill({ color: ROLE.identity, alpha: 0.32 });
  }
}

/** Lager: Bodenmarkierung, damit der Raum als Wirtschaftsflaeche liest. */
function marking(g: Graphics, rect: Rect): void {
  const y = Math.round(rect.y + rect.h * 0.58);
  for (let x = rect.x + 8; x < rect.x + rect.w - 8; x += 20) g.rect(x, y, 10, 3).fill({ color: ROLE.warning, alpha: 0.14 });
  g.rect(rect.x + 4, rect.y + 4, rect.w - 8, rect.h - 8).stroke({ width: 1, color: ROLE.warning, alpha: 0.08 });
}

/** Kasse: Goldleiste an der Wand hinter dem Schalter. */
function goldRail(g: Graphics, rect: Rect): void {
  g.rect(rect.x + 8, rect.y + 8, rect.w - 16, 2).fill({ color: ROLE.value, alpha: 0.3 });
  g.rect(rect.x + 8, rect.y + 10, rect.w - 16, 8).fill({ color: LIGHT.warm, alpha: 0.04 });
}

/** Lounge: warmes Wandlicht, weicher als im Spielsaal. */
function loungeWash(g: Graphics, rect: Rect): void {
  g.rect(rect.x, rect.y + rect.h - 14, rect.w, 14).fill({ color: LIGHT.warm, alpha: 0.04 });
  g.rect(rect.x, rect.y + rect.h - 14, rect.w, 1).fill({ color: LIGHT.warm, alpha: 0.16 });
}

export function drawDressing(g: Graphics, mat: FloorMaterial, rect: Rect, zone: ZoneLike, tile: number): void {
  if (zone.kind === 'BAR') backBar(g, rect, zone);
  else if (zone.kind === 'TOILET') wainscot(g, rect, tile);
  else if (zone.kind === 'GAMING') pilasters(g, rect, zone, tile);
  else if (zone.kind === 'STORAGE') marking(g, rect);
  else if (zone.kind === 'EXCHANGE') goldRail(g, rect);
  else if (zone.kind === 'LOUNGE') loungeWash(g, rect);
  // Sockel: dunkle Kante direkt ueber dem Boden an jeder Wand, unabhaengig vom Raum.
  g.rect(rect.x, rect.y + rect.h - 3, rect.w, 3).fill({ color: 0x000000, alpha: 0.18 });
  g.rect(rect.x, rect.y + rect.h - 3, rect.w, 1).fill({ color: mat.accent, alpha: 0.14 });
}
