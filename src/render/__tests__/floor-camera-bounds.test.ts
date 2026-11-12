/** @test-target: src/render/floor-camera.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { TILE } from '../../core/sim/types';
import { FloorCamera } from '../floor-camera';

function settle(cam: FloorCamera): void {
  for (let index = 0; index < 80; index += 1) cam.step();
}

describe('FloorCamera: Weltgrenzen und LOD-Hysterese', () => {
  it('rechnet Fit und Fill mit Breite und Hoehe getrennt', () => {
    const cam = new FloorCamera();
    cam.resize(1000, 500, { width: 60, height: 30 }, true);
    expect(cam.bounds).toEqual({ width: 60, height: 30 });
    expect(60 * TILE * cam.fit).toBeLessThanOrEqual(1000.001);
    expect(30 * TILE * cam.fit).toBeLessThanOrEqual(500.001);
    expect(60 * TILE * cam.fill).toBeGreaterThanOrEqual(1000 - 0.001);
  });

  it('bleibt bei einer quadratischen Welt deckungsgleich mit dem alten Vertrag', () => {
    const cam = new FloorCamera();
    cam.resize(800, 800, 30, true);
    expect(30 * TILE * cam.fill).toBeCloseTo(800, 6);
    expect(cam.fit).toBeCloseTo(cam.fill * 0.96, 6);
  });

  it('haelt die Kamera im toten Winkel ruhig und zieht erst am Rand nach', () => {
    const cam = new FloorCamera();
    cam.resize(800, 800, 30, true);
    cam.zoomStep(2);
    settle(cam);
    const before = { ...cam.focus };
    cam.keepInView(15 * TILE, 15 * TILE, 800, 800, 30);
    settle(cam);
    expect(cam.focus).toEqual(before);
    cam.keepInView(24 * TILE, 15 * TILE, 800, 800, 30);
    settle(cam);
    expect(cam.focus.x).toBeGreaterThan(before.x);
  });

  it('rundet die Kameraverschiebung auf das Geraetepixelraster', () => {
    const cam = new FloorCamera();
    cam.resize(801, 601, { width: 60, height: 30 }, true);
    const position = {
      x: 0, y: 0,
      set(x: number, y: number): void { this.x = x; this.y = y; },
    };
    const camera = { scale: { set: () => undefined }, position } as never;
    cam.apply(camera, 801, 601, { width: 60, height: 30 }, 2);
    expect(position.x * 2).toBeCloseTo(Math.round(position.x * 2), 9);
    expect(position.y * 2).toBeCloseTo(Math.round(position.y * 2), 9);
  });

  it('schaltet Detail mit Hysterese statt an einer flackernden Kante', () => {
    const cam = new FloorCamera();
    cam.resize(800, 800, 30, true);
    expect(cam.detail).toBe(false);
    cam.zoomStep(1.4);
    settle(cam);
    expect(cam.detail).toBe(true);
    cam.zoomStep(0.78);
    settle(cam);
    // 1.08..1.16 ist die Hysterese: nach dem Reinzoomen bleibt Detail kurz an.
    expect(cam.zoom).toBeGreaterThan(cam.fit * 1.08);
    expect(cam.detail).toBe(true);
    cam.overview();
    settle(cam);
    expect(cam.detail).toBe(false);
  });
});
