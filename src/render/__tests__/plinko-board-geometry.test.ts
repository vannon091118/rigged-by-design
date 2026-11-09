/**
 * @test-target: src/render/games/plinko-board-geometry.ts
 * @error-code: ERR-3001
 *
 * Die Brettgeometrie ist die einzige Quelle fuer Stiftpositionen und den
 * Taschenboden; der Canvas zeichnet nur noch diese Werte.
 */
import { describe, expect, it } from 'vitest';
import type { PlinkoConfig } from '../../core/games/plinko-config';
import {
  FLOOR_BASE, WIDTH, boardPegs, floorOf, payoutLabel, pocketCells, pocketTint,
} from '../games/plinko-board-geometry';

const config = (pegs: PlinkoConfig['pegs'] = []): PlinkoConfig => ({
  pocketCount: 9,
  pocketWidths: Array.from({ length: 9 }, () => 100 / 9),
  pegs,
});

describe('Plinko-Board-Geometrie', () => {
  it('legt den Taschenboden relativ zur Reihenzahl', () => {
    expect(floorOf(8)).toBe(FLOOR_BASE);
    expect(floorOf(12)).toBe(FLOOR_BASE + 44);
  });

  it('baut acht Stifte pro Reihe und haelt sie im Brett', () => {
    const pegs = boardPegs(config(), 8);
    expect(pegs).toHaveLength(64);
    expect(pegs[0]).toMatchObject({ x: 10, y: 26, kind: 'NORMAL_PEG' });
    expect(pegs[8]!.x).toBe(15.5);
    expect(pegs.every((peg) => peg.x >= 10 && peg.x <= WIDTH - 6)).toBe(true);
    expect(pegs[pegs.length - 1]!.y).toBe(26 + 7 * 11);
  });

  it('uebernimmt Spezialstifte an derselben Rasterposition', () => {
    const pegs = boardPegs(config([
      { row: 0, column: 1, kind: 'BOUNCY_PEG' },
      { row: 1, column: 0, kind: 'MAGNET_PEG' },
    ]), 8);
    expect(pegs[1]).toMatchObject({ x: 21, y: 26, kind: 'BOUNCY_PEG' });
    expect(pegs[8]).toMatchObject({ x: 15.5, y: 37, kind: 'MAGNET_PEG' });
  });

  it('legt Taschen lueckenlos aneinander und uebernimmt die Auszahlung', () => {
    const cells = pocketCells([10, 20, 70], [17_100, 0, 50_000]);
    expect(cells.map((cell) => [cell.left, cell.right])).toEqual([[0, 10], [10, 30], [30, 100]]);
    expect(cells.map((cell) => cell.width)).toEqual([10, 20, 70]);
    expect(cells.map((cell) => cell.payBps)).toEqual([17_100, 0, 50_000]);
  });

  it('faerbt Taschen nach Auszahlungsstufe', () => {
    expect(pocketTint(0)).toBe(0x2a1030);
    expect(pocketTint(19_999)).toBe(0x6f5b8c);
    expect(pocketTint(20_000)).toBe(0xff2e88);
    expect(pocketTint(49_999)).toBe(0xff2e88);
    expect(pocketTint(50_000)).toBe(0xffd166);
  });

  it('beschriftet Taschen als Vielfaches mit deutschem Komma', () => {
    expect(payoutLabel(17_100)).toBe('1,7x');
    expect(payoutLabel(0)).toBe('0,0x');
    expect(payoutLabel(50_000)).toBe('5,0x');
  });
});
