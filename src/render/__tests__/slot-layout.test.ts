/**
 * @test-target: src/render/games/slot-layout.ts
 * @error-code: ERR-3001
 *
 * Die Walzenanzeige rechnet nur ueber diese Geometrie. Werte, die hier stimmen,
 * sitzen auch im Canvas an der richtigen Stelle.
 */
import { describe, expect, it } from 'vitest';
import { REEL_COUNT, ROW_COUNT, cellCenter, linePoints, settleOffset } from '../games/slot-layout';
import { SLOT_LINES } from '../../core/games/engines/slot';

const CELL = 120;
const PAD = 16;

describe('Slot-Layout', () => {
  it('legt fuenf Walzen mit drei Reihen in feste Zellen', () => {
    expect(REEL_COUNT).toBe(5);
    expect(ROW_COUNT).toBe(3);
    const top = cellCenter(0, 0, CELL, PAD);
    const bottom = cellCenter(0, 2, CELL, PAD);
    expect(top.y).toBeLessThan(bottom.y);
    expect(cellCenter(1, 1, CELL, PAD).x - cellCenter(0, 1, CELL, PAD).x).toBe(CELL);
    expect(bottom.y - top.y).toBe(CELL * 2);
  });

  it('faengt oberhalb an, landet exakt und schiesst nur leicht ueber', () => {
    expect(settleOffset(0)).toBeCloseTo(-1, 5);
    expect(settleOffset(1)).toBe(0);
    let peak = 0;
    let previous = -1;
    for (let step = 1; step <= 100; step += 1) {
      const value = settleOffset(step / 100);
      peak = Math.max(peak, value);
      expect(value).toBeGreaterThanOrEqual(previous - 0.02);
      previous = value;
    }
    expect(peak).toBeGreaterThan(0);
    expect(peak).toBeLessThan(0.06);
  });

  it('zeichnet jede Gewinnlinie als fuenf Punkte von links nach rechts', () => {
    for (const line of SLOT_LINES) {
      const points = linePoints(line, CELL, PAD);
      expect(points).toHaveLength(5);
      for (let index = 1; index < points.length; index += 1) {
        expect(points[index]!.x).toBeGreaterThan(points[index - 1]!.x);
      }
    }
  });
});
