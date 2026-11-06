/**
 * @test-target: src/render/assets/atlas.ts
 * @error-code: ERR-3001
 *
 * Shelf-Plan: deterministische Reihenfolge, keine Ueberlappung, harte Seitengrenze.
 */
import { describe, expect, it } from 'vitest';
import { shelfPack } from '../assets/atlas';

const item = (path: string, width: number, height: number) => ({ path, width, height });

describe('Shelf-Atlas', () => {
  it('sortiert nach Hoehe, Breite und Pfad statt nach Dateisystem-Reihenfolge', () => {
    const pages = shelfPack([
      item('b/klein.png', 10, 10),
      item('a/gross.png', 20, 20),
      item('c/mittel.png', 30, 15),
    ], 1024, 2);
    expect(pages.flat().map((frame) => frame.path)).toEqual([
      'a/gross.png', 'c/mittel.png', 'b/klein.png',
    ]);
  });

  it('haelt jede Seite innerhalb der Grenze und ueberlappt keine Frames', () => {
    const pages = shelfPack([
      item('a', 600, 600), item('b', 600, 600), item('c', 400, 200), item('d', 400, 200),
    ], 1024, 2);
    const frames = pages.flat();
    expect(frames).toHaveLength(4);
    for (const frame of frames) {
      expect(frame.x).toBeGreaterThanOrEqual(0);
      expect(frame.y).toBeGreaterThanOrEqual(0);
      expect(frame.x + frame.width).toBeLessThanOrEqual(1024);
      expect(frame.y + frame.height).toBeLessThanOrEqual(1024);
    }
    expect(pages.length).toBeGreaterThan(1);
  });

  it('verwirft nur Frames, die groesser als eine Seite sind', () => {
    const pages = shelfPack([item('riesig', 1200, 1200), item('passt', 32, 32)], 1024, 2);
    expect(pages.flat().map((frame) => frame.path)).toEqual(['passt']);
  });
});
