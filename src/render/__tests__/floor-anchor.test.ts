/**
 * @test-target: src/render/floor-input.ts
 * @error-code: ERR-4017
 *
 * Der Weltanker ist die Gegenrichtung zum Trefferpfad: derselbe Punkt muss
 * nach einer Kameraänderung wieder an derselben Stelle im Viewport landen.
 */
import type { Application, Container } from 'pixi.js';
import { describe, expect, it } from 'vitest';
import { screenAnchorOf } from '../floor-input';

function app(): Application {
  return {
    canvas: {
      getBoundingClientRect: () => ({ left: 10, top: 20, width: 200, height: 100 }),
    },
    screen: { width: 100, height: 50 },
  } as unknown as Application;
}

function camera(x: number, y: number, scale: number): Container {
  return { x, y, scale: { x: scale, y: scale } } as unknown as Container;
}

describe('Weltanker', () => {
  it('rechnet einen Weltpunkt in Viewport-Pixel und behaelt den Weltpunkt', () => {
    expect(screenAnchorOf({ x: 10, y: 10 }, app(), camera(5, 7, 2))).toEqual({
      x: 60,
      y: 74,
      worldX: 10,
      worldY: 10,
    });
  });

  it('verschiebt den Anker mit einer Kameraaenderung, nicht mit dem Klick', () => {
    const before = screenAnchorOf({ x: 10, y: 10 }, app(), camera(5, 7, 2));
    const after = screenAnchorOf({ x: 10, y: 10 }, app(), camera(15, 17, 2));
    expect(after!.x - before!.x).toBe(20);
    expect(after!.y - before!.y).toBe(20);
    expect(after!.worldX).toBe(before!.worldX);
  });
});
