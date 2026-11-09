/**
 * Plinko-Board-Geometrie: Stiftpositionen und Taschenboden.
 *
 * Ownership: Sim-/Domain-Owner. Diese Datei ist rein und kennt weder Pixi noch
 * Spielzustand; `plinko-canvas.ts` zeichnet ausschliesslich diese Werte.
 */
import type { PegKind, PlinkoConfig } from '../../core/games/plinko-config';

export const WIDTH = 100;
export const TOP = 8;
const ROW_GAP = 11;
export const PEG_RADIUS = 1.8;
export const BALL_RADIUS = 2.2;
const PEG_COLUMNS = 8;
export const FLOOR_BASE = 120;

export interface Peg {
  readonly x: number;
  readonly y: number;
  readonly kind: PegKind;
}

export const floorOf = (rows: number): number => FLOOR_BASE + (rows - 8) * ROW_GAP;

/** Baut die Stiftpositionen genau so, wie es die Simulation tut. */
export function boardPegs(config: PlinkoConfig, rows: number): Peg[] {
  const special = new Map(config.pegs.map((peg) => [`${peg.row}:${peg.column}`, peg.kind]));
  const pegs: Peg[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = 26 + row * ROW_GAP;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < PEG_COLUMNS; column += 1) {
      const x = 10 + offset + column * 11;
      if (x > WIDTH - 6) continue;
      pegs.push({ x, y, kind: special.get(`${row}:${column}`) ?? 'NORMAL_PEG' });
    }
  }
  return pegs;
}

export interface PocketCell {
  readonly left: number;
  readonly right: number;
  readonly width: number;
  readonly payBps: number;
  readonly tint: number;
  readonly label: string;
}

/** Farbe einer Tasche nach Auszahlung in Basispunkten. */
export function pocketTint(payBps: number): number {
  if (payBps === 0) return 0x2a1030;
  if (payBps >= 50_000) return 0xffd166;
  if (payBps >= 20_000) return 0xff2e88;
  return 0x6f5b8c;
}

/** Beschriftung der Tasche: Basispunkte als Vielfaches mit deutschem Komma. */
export function payoutLabel(payBps: number): string {
  return `${(payBps / 10_000).toFixed(1).replace('.', ',')}x`;
}

/** Eine Zelle je Tasche: Kanten, Breite, Auszahlung, Farbe und Beschriftung. */
export function pocketCells(widths: readonly number[], paytable: readonly number[]): PocketCell[] {
  const cells: PocketCell[] = [];
  let edge = 0;
  widths.forEach((width, index) => {
    const left = edge;
    edge += width;
    const payBps = paytable[index] ?? 0;
    cells.push({ left, right: edge, width, payBps, tint: pocketTint(payBps), label: payoutLabel(payBps) });
  });
  return cells;
}
