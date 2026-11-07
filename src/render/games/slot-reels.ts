/** Walzenstreifen der Buehne: Aufbau einer Walze und Umtausch einer Zelle. */
import { Container } from 'pixi.js';
import { drawSlotSymbol } from './slot-symbols-art';

export const CELL = 116;
export const PAD = 18;
/** Vier Zellen, eine mehr als sichtbar: die vierte traegt den Auslauf. */
const CELLS = 4;

export interface Reel {
  readonly strip: Container;
  readonly cells: Container[];
  readonly rows: number[];
  offset: number;
  spinning: boolean;
  stopping: boolean;
  bounce: number;
  target: string[];
}

/** Tauscht das Symbol einer Zelle aus, ohne die Zelle selbst zu ersetzen. */
export function repaint(cell: Container, symbol: string): void {
  for (const child of cell.removeChildren()) child.destroy();
  const art = drawSlotSymbol(symbol, CELL * 0.82);
  art.position.set(0, 0);
  cell.addChild(art);
}

/** Ein einzelner Auslauf pro Walze: laufen, umlaufen, auf dem Ziel rasten. */
export function makeReel(index: number, x: number, symbols: readonly string[]): Reel {
  const strip = new Container();
  const cells: Container[] = [];
  const rows = [0, 1, 2, 3];
  for (let slot = 0; slot < CELLS; slot += 1) {
    const cell = new Container();
    const art = drawSlotSymbol(symbols[(index + slot) % symbols.length]!, CELL * 0.82);
    art.position.set(0, 0);
    cell.addChild(art);
    cell.position.set(x + CELL * 0.09, PAD + rows[slot]! * CELL + CELL * 0.09);
    cells.push(cell);
    strip.addChild(cell);
  }
  return { strip, cells, rows, offset: 0, spinning: false, stopping: false, bounce: 0, target: [] };
}
