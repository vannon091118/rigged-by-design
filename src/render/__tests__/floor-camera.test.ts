/**
 * @test-target: src/render/floor-camera.ts
 * @error-code: ERR-3001
 *
 * Kamera: Uebersicht, Schwenk, Tasten-Zoom und Nachziehen am Bildrand sind reine Mathe.
 * Der Test liest nur die Transform, die die Kamera schreibt, und braucht kein Pixi-Rendering.
 */
import { describe, expect, it } from 'vitest';
import { TILE } from '../../core/sim/types';
import { FloorCamera } from '../floor-camera';

const SIZE = 30;
const WIDTH = 1600;
const HEIGHT = 900;
const CONVERGE = 200;

function cameraAtFit(): FloorCamera {
  const camera = new FloorCamera();
  camera.resize(WIDTH, HEIGHT, SIZE, true);
  return camera;
}

function settle(camera: FloorCamera): void {
  for (let frame = 0; frame < CONVERGE; frame += 1) camera.step();
}

/** Liest nur, was `apply` in die Buehne schreibt: Position und Massstab. */
function transform(camera: FloorCamera): { x: number; y: number; world: number } {
  const out = { x: 0, y: 0, world: 0 };
  camera.apply({
    scale: { set: (value: number) => { out.world = SIZE * TILE * value; } },
    position: { set: (x: number, y: number) => { out.x = x; out.y = y; } },
  } as never, WIDTH, HEIGHT, SIZE);
  return out;
}

describe('Uebersicht', () => {
  it('legt das Haus mittig in die Buehne', () => {
    const view = transform(cameraAtFit());
    expect(view.x + view.world / 2).toBeCloseTo(WIDTH / 2, 4);
    expect(view.y + view.world / 2).toBeCloseTo(HEIGHT / 2, 4);
  });
});

describe('Schwenk', () => {
  it('folgt dem Zeiger: Ziehen nach rechts schiebt das Haus nach rechts', () => {
    const camera = cameraAtFit();
    camera.zoomStep(1.6);
    settle(camera);
    const before = transform(camera);
    camera.pan(0.1, 0);
    settle(camera);
    const after = transform(camera);
    expect(after.x).toBeGreaterThan(before.x);
  });

  it('bleibt an der Hauskante stehen', () => {
    const camera = cameraAtFit();
    camera.zoomStep(1.6);
    camera.pan(-9, -9);
    settle(camera);
    const view = transform(camera);
    // Nach dem Lerp bleibt ein Rest unter einem Pixel: die Kante ist erreicht, nicht ueberschritten.
    expect(Math.abs(view.x - (WIDTH / 2 - view.world))).toBeLessThan(1);
    expect(Math.abs(view.y - (HEIGHT / 2 - view.world))).toBeLessThan(1);
  });
});

describe('Nachziehen', () => {
  it('laesst die Uebersicht in Ruhe', () => {
    const camera = cameraAtFit();
    const before = transform(camera);
    camera.keepInView(0, 0, WIDTH, HEIGHT, SIZE);
    settle(camera);
    expect(transform(camera).x).toBeCloseTo(before.x, 4);
  });

  it('zieht nach, sobald die Figur den inneren Rahmen verlaesst', () => {
    const camera = cameraAtFit();
    camera.zoomStep(2.4);
    settle(camera);
    const before = transform(camera);
    camera.keepInView(SIZE * TILE * 0.95, (SIZE * TILE) / 2, WIDTH, HEIGHT, SIZE);
    settle(camera);
    expect(transform(camera).x).toBeLessThan(before.x);
  });
});

describe('Tasten-Zoom', () => {
  it('kehrt beim Herauszoomen in die Mitte zurueck', () => {
    const camera = cameraAtFit();
    camera.zoomStep(2.4);
    camera.pan(0.3, 0);
    settle(camera);
    camera.zoomStep(0.25);
    settle(camera);
    const view = transform(camera);
    expect(Math.abs(view.x + view.world / 2 - WIDTH / 2)).toBeLessThan(1);
  });
});
