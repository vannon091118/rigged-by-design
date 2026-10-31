/**
 * Laufwege: Teppichlaeufer zwischen den Raeumen, gelegt von Zonenrand zu Zonenrand,
 * damit sie in den Korridoren bleiben und den Saal nicht durchschneiden. Darauf
 * Lichtinseln im Rhythmus. Eine statische Ebene, kein Tick-Redraw.
 */
import type { Graphics } from 'pixi.js';
import type { GameView } from '../store/types';
import { LIGHT, RUNNER } from './art-tokens';

interface Spot { readonly x: number; readonly y: number }
interface ZoneLike { kind: string; x: number; y: number; w: number; h: number }

const ORDER = ['ENTRANCE', 'EXCHANGE', 'GAMING', 'BAR', 'TOILET'] as const;
const WIDTH = 1.35;

/**
 * Naechster Punkt kurz vor dem Zonenrand: der Laeufer setzt an der Wand an,
 * deckt sie aber nicht zu.
 */
function borderPoint(zone: ZoneLike, toward: Spot, tile: number): Spot {
  const cx = zone.x + zone.w / 2;
  const cy = zone.y + zone.h / 2;
  const dx = toward.x - cx;
  const dy = toward.y - cy;
  const gap = 7 / tile;
  if (Math.abs(dx) * zone.h > Math.abs(dy) * zone.w) {
    return { x: dx > 0 ? zone.x + zone.w + gap : zone.x - gap, y: cy };
  }
  return { x: cx, y: dy > 0 ? zone.y + zone.h + gap : zone.y - gap };
}

function elbow(g: Graphics, from: Spot, to: Spot, tile: number): void {
  const width = Math.round(tile * WIDTH);
  const half = width / 2;
  const ax = from.x * tile;
  const ay = from.y * tile;
  const bx = to.x * tile;
  const by = to.y * tile;
  g.rect(Math.min(ax, bx) - half, ay - half, Math.abs(bx - ax) + width, width).fill({ color: RUNNER.fill, alpha: 0.72 });
  g.rect(bx - half, Math.min(ay, by) - half, width, Math.abs(by - ay) + width).fill({ color: RUNNER.fill, alpha: 0.72 });
  g.rect(Math.min(ax, bx) - half, ay - half, Math.abs(bx - ax) + width, 1).fill({ color: RUNNER.edge, alpha: 0.4 });
  g.rect(Math.min(ax, bx) - half, ay + half - 1, Math.abs(bx - ax) + width, 1).fill({ color: RUNNER.edge, alpha: 0.4 });
  g.rect(bx - half, Math.min(ay, by) - half, 1, Math.abs(by - ay) + width).fill({ color: RUNNER.edge, alpha: 0.4 });
  g.rect(bx + half - 1, Math.min(ay, by) - half, 1, Math.abs(by - ay) + width).fill({ color: RUNNER.edge, alpha: 0.4 });
  // Gewebe statt Balken: kurze Querstreifen auf dem Laeufer.
  for (let x = Math.min(ax, bx) + 4; x < Math.max(ax, bx) - 4; x += 12) {
    g.rect(x, ay - half + 2, 2, width - 4).fill({ color: RUNNER.edge, alpha: 0.16 });
  }
  for (let y = Math.min(ay, by) + 4; y < Math.max(ay, by) - 4; y += 12) {
    g.rect(bx - half + 2, y, width - 4, 2).fill({ color: RUNNER.edge, alpha: 0.16 });
  }
}

/** Lichtinseln im Rhythmus: erst der warme Kegel, dann der hellere Kern. */
function pools(g: Graphics, from: Spot, to: Spot, tile: number): void {
  const ax = from.x * tile;
  const ay = from.y * tile;
  const bx = to.x * tile;
  const by = to.y * tile;
  const step = tile * 4;
  for (let x = Math.min(ax, bx); x <= Math.max(ax, bx); x += step) {
    g.ellipse(x, ay, tile * 1.6, tile * 1.1).fill({ color: LIGHT.warm, alpha: 0.04 });
    g.ellipse(x, ay, tile * 0.8, tile * 0.55).fill({ color: LIGHT.warm, alpha: 0.05 });
  }
  for (let y = Math.min(ay, by); y <= Math.max(ay, by); y += step) {
    g.ellipse(bx, y, tile * 1.1, tile * 1.6).fill({ color: LIGHT.warm, alpha: 0.04 });
    g.ellipse(bx, y, tile * 0.55, tile * 0.8).fill({ color: LIGHT.warm, alpha: 0.05 });
  }
}

export function drawRoutes(g: Graphics, view: GameView, tile: number): void {
  const zones = ORDER.flatMap((kind) => {
    const zone = view.zones.find((entry) => entry.kind === kind);
    return zone ? [zone as ZoneLike] : [];
  });
  for (let index = 1; index < zones.length; index += 1) {
    const previous = zones[index - 1]!;
    const next = zones[index]!;
    const from = borderPoint(previous, { x: next.x + next.w / 2, y: next.y + next.h / 2 }, tile);
    const to = borderPoint(next, { x: previous.x + previous.w / 2, y: previous.y + previous.h / 2 }, tile);
    elbow(g, from, to, tile);
    pools(g, from, to, tile);
  }
}
