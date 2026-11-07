/** Reine Geometrie und Tween-Kurven der Walzenanzeige; ohne Pixi damit testbar. */
import { slotPaylines } from '../../core/games/engines/slot-paytable';

/** Fuenf Walzen sind das Standardgitter; Geraete drehen auch drei oder vier. */
const DEFAULT_REELS = 5;

export const REEL_COUNT = DEFAULT_REELS;
export const ROW_COUNT = 3;

/** Eigene Koordinate des Walzenfelds; nirgendwo importiert, also lokal. */
interface Point {
  readonly x: number;
  readonly y: number;
}

/** Mittelpunkt einer Zelle im Kabinett, Nullpunkt links oben im Walzenfeld. */
export function cellCenter(reel: number, row: number, cell: number, pad: number): Point {
  return { x: pad + reel * cell + cell / 2, y: pad + row * cell + cell / 2 };
}

/**
 * Landeposition der Walze: startet eine volle Umdrehung oberhalb und schwingt
 * mit einem kleinen Ueberschwinger auf null. Rueckgabe in Zellenhoehen.
 */
export function settleOffset(progress: number): number {
  const t = progress < 0 ? 0 : progress > 1 ? 1 : progress;
  const eased = 1 - (1 - t) ** 3;
  const overshoot = Math.sin(t * Math.PI) * (1 - t) * 0.045;
  return -1 + eased + overshoot;
}

/** Punkte einer Gewinnlinie durch die Zellmitten, links nach rechts. */
export function linePoints(line: readonly number[], cell: number, pad: number): Point[] {
  return line.map((row, reel) => cellCenter(reel, row, cell, pad));
}

export function paylineAt(index: number, reels = DEFAULT_REELS): readonly number[] {
  const lines = slotPaylines(reels);
  return lines[index % lines.length]!;
}
