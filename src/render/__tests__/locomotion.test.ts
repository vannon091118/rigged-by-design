/** @test-target: src/render/locomotion.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { GAIT_FRAMES, gaitFor } from '../locomotion';

describe('Laufvertrag', () => {
  it('wählt vier Frames deterministisch aus dem Tick', () => {
    const frames = new Set<number>();
    for (let tick = 0; tick < 8; tick += 1) frames.add(gaitFor(1, tick, 0).frame);
    expect(frames.size).toBe(GAIT_FRAMES);
    expect(gaitFor(1, 5, 0.25)).toEqual(gaitFor(1, 5, 0.25));
  });

  it('leitet beide Richtungen aus dx ab', () => {
    expect(gaitFor(4, 1, 0).facing).toBe('right');
    expect(gaitFor(-4, 1, 0).facing).toBe('left');
    expect(gaitFor(0, 1, 0, 'left').facing).toBe('left');
  });

  it('erzeugt im Stillstand keinen Lauframe', () => {
    expect(gaitFor(0, 7, 0.5)).toMatchObject({ moving: false, frame: 0 });
    expect(gaitFor(0, 7, 0.5, 'left', 0)).toMatchObject({ moving: false, frame: 0 });
  });

  it('zaehlt reine y-Bewegung als Lauf und behaelt die Blickrichtung', () => {
    expect(gaitFor(0, 3, 0.25, 'left', -2)).toMatchObject({ moving: true, facing: 'left' });
    expect(gaitFor(0, 3, 0.25, 'left', -2).frame).toBeGreaterThanOrEqual(0);
  });
});
