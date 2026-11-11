/** @test-target: src/render/floor-camera.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { TILE } from '../../core/sim/types';
import { FloorCamera } from '../floor-camera';

function camera(width: number, height: number, size = 30): FloorCamera {
  const cam = new FloorCamera();
  cam.resize(width, height, size, true);
  return cam;
}

describe('FloorCamera: Sichtbarkeit und Füllung', () => {
  it('zeigt den ganzen Plan (contain) und meldet den vollen Faktor (cover)', () => {
    const cam = camera(1600, 950);
    const world = 30 * TILE;
    expect(world * cam.fit).toBeLessThanOrEqual(1600 + 0.001);
    expect(world * cam.fit).toBeLessThanOrEqual(950 + 0.001);
    expect(world * cam.fill).toBeGreaterThanOrEqual(1600 - 0.001);
    expect(world * cam.fill).toBeGreaterThanOrEqual(950 - 0.001);
    expect(cam.fill).toBeGreaterThan(cam.fit);
  });

  it('füllt bei quadratischem Viewport exakt und lässt der Übersicht 4 % Rand', () => {
    const cam = camera(800, 800);
    const world = 30 * TILE;
    expect(world * cam.fill).toBeCloseTo(800, 6);
    expect(cam.fit).toBeCloseTo(cam.fill * 0.96, 6);
  });

  it('klemmt den Zoom nie unter die Übersicht', () => {
    const cam = camera(1582, 717);
    const fit = cam.fit;
    cam.zoomStep(0.5);
    expect(cam.fit).toBe(fit);
    expect(cam.zoom).toBe(fit);
    cam.overview();
    expect(cam.fit).toBe(fit);
  });
});
