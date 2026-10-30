/** Zwei-Finger-Zoom auf dem Canvas; die Kamera bleibt die einzige Zoom-Wahrheit. */
import type { Application, Container } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { FloorCamera } from './floor-camera';

export class FloorTouch {
  readonly #app: Application;
  readonly #camera: Container;
  readonly #cam: FloorCamera;
  readonly #size: () => number;
  readonly #pointers = new Map<number, { x: number; y: number }>();
  #span = 0;

  constructor(app: Application, camera: Container, cam: FloorCamera, size: () => number) {
    this.#app = app;
    this.#camera = camera;
    this.#cam = cam;
    this.#size = size;
    app.canvas.addEventListener('pointerdown', this.#down);
    app.canvas.addEventListener('pointermove', this.#move);
    app.canvas.addEventListener('pointerup', this.#up);
    app.canvas.addEventListener('pointercancel', this.#up);
  }

  destroy(): void {
    this.#app.canvas.removeEventListener('pointerdown', this.#down);
    this.#app.canvas.removeEventListener('pointermove', this.#move);
    this.#app.canvas.removeEventListener('pointerup', this.#up);
    this.#app.canvas.removeEventListener('pointercancel', this.#up);
    this.#pointers.clear();
  }

  #down = (event: PointerEvent): void => {
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size === 2) this.#span = this.#distance();
  };

  #move = (event: PointerEvent): void => {
    if (!this.#pointers.has(event.pointerId)) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size !== 2) return;
    const span = this.#distance();
    if (this.#span <= 0) { this.#span = span; return; }
    const ratio = span / this.#span;
    if (Math.abs(ratio - 1) < 0.01) return;
    this.#span = span;
    const positions = [...this.#pointers.values()];
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const scaleFactor = rect.width / this.#app.screen.width;
    const midX = (positions[0]!.x + positions[1]!.x) / 2;
    const midY = (positions[0]!.y + positions[1]!.y) / 2;
    const localX = (midX - rect.left) / scaleFactor;
    const localY = (midY - rect.top) / scaleFactor;
    const worldX = (localX - this.#camera.x) / this.#camera.scale.x / (this.#size() * TILE);
    const worldY = (localY - this.#camera.y) / this.#camera.scale.y / (this.#size() * TILE);
    this.#cam.pinch(ratio, worldX, worldY);
  };

  #up = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
    if (this.#pointers.size < 2) this.#span = 0;
  };

  #distance = (): number => {
    const positions = [...this.#pointers.values()];
    if (positions.length < 2) return 0;
    return Math.hypot(positions[0]!.x - positions[1]!.x, positions[0]!.y - positions[1]!.y);
  };
}
