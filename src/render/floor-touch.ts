/** Zeigergesten auf dem Canvas: Ein-Finger-Ziehen schwenkt, Tippen laeuft, Pinch zoomt. */
import type { Application, Container } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { FloorCamera } from './floor-camera';

/** Ab hier ist ein Fingerzug ein Schwenk und kein Tipp. */
const DRAG_THRESHOLD = 8;

interface TouchState { readonly id: number; x: number; y: number; dragged: boolean }
interface ClickState { readonly id: number; x: number; y: number; dragged: boolean }

export class FloorTouch {
  readonly #app: Application;
  readonly #camera: Container;
  readonly #cam: FloorCamera;
  readonly #size: () => number;
  readonly #onTap: (clientX: number, clientY: number) => void;
  /** Notausstieg fuer eine gesperrte Buehne; im Normalfall immer aktiv. */
  readonly #enabled: () => boolean;
  readonly #pointers = new Map<number, { x: number; y: number }>();
  #span = 0;
  #pan: { id: number; x: number; y: number } | null = null;
  #touch: TouchState | null = null;
  #click: ClickState | null = null;

  constructor(
    app: Application, camera: Container, cam: FloorCamera, size: () => number,
    onTap: (clientX: number, clientY: number) => void,
    enabled: () => boolean = () => true,
  ) {
    this.#app = app;
    this.#camera = camera;
    this.#cam = cam;
    this.#size = size;
    this.#onTap = onTap;
    this.#enabled = enabled;
    app.canvas.addEventListener('pointerdown', this.#down);
    app.canvas.addEventListener('pointermove', this.#move);
    app.canvas.addEventListener('pointerup', this.#up);
    app.canvas.addEventListener('pointercancel', this.#cancel);
    app.canvas.addEventListener('wheel', this.#wheel, { passive: false });
    app.canvas.addEventListener('contextmenu', this.#menu);
  }

  destroy(): void {
    this.#app.canvas.removeEventListener('pointerdown', this.#down);
    this.#app.canvas.removeEventListener('pointermove', this.#move);
    this.#app.canvas.removeEventListener('pointerup', this.#up);
    this.#app.canvas.removeEventListener('pointercancel', this.#cancel);
    this.#app.canvas.removeEventListener('wheel', this.#wheel);
    this.#app.canvas.removeEventListener('contextmenu', this.#menu);
    this.#app.canvas.style.cursor = '';
    this.#pointers.clear();
  }

  #down = (event: PointerEvent): void => {
    if (!this.#enabled()) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pointers.size === 2) {
      this.#span = this.#distance();
      this.#pan = null;
      this.#touch = null;
      return;
    }
    // Finger: erst nach der Schwelle wird geschwenkt, vorher bleibt es ein Tipp.
    if (event.pointerType !== 'mouse') {
      this.#touch = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
      return;
    }
    // Linksklick und Linksziehen bleiben ein Tap; erst ein Zug wird zum Schwenk.
    if (event.button === 0) {
      this.#click = { id: event.pointerId, x: event.clientX, y: event.clientY, dragged: false };
      return;
    }
    // Mittlere und rechte Taste schwenken.
    if (event.button === 1 || event.button === 2) {
      this.#pan = { id: event.pointerId, x: event.clientX, y: event.clientY };
      this.#app.canvas.style.cursor = 'grabbing';
    }
  };

  #move = (event: PointerEvent): void => {
    if (!this.#enabled() || !this.#pointers.has(event.pointerId)) return;
    this.#pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.#pan && this.#pan.id === event.pointerId) { this.#drag(event, this.#pan); return; }
    const click = this.#click;
    if (click && click.id === event.pointerId) {
      if (!click.dragged && Math.hypot(event.clientX - click.x, event.clientY - click.y) >= DRAG_THRESHOLD) {
        click.dragged = true;
      }
      return;
    }
    const touch = this.#touch;
    if (touch && touch.id === event.pointerId) {
      if (!touch.dragged && Math.hypot(event.clientX - touch.x, event.clientY - touch.y) >= DRAG_THRESHOLD) {
        touch.dragged = true;
      }
      if (touch.dragged) this.#drag(event, touch);
      return;
    }
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
    if (this.#pan && this.#pan.id === event.pointerId) {
      this.#pan = null;
      this.#app.canvas.style.cursor = '';
    }
    const click = this.#click;
    if (click && click.id === event.pointerId) {
      this.#click = null;
      if (!click.dragged) this.#onTap(event.clientX, event.clientY);
    }
    const touch = this.#touch;
    if (touch && touch.id === event.pointerId) {
      this.#touch = null;
      if (!touch.dragged) this.#onTap(event.clientX, event.clientY);
    }
  };

  #cancel = (event: PointerEvent): void => {
    this.#pointers.delete(event.pointerId);
    if (this.#pointers.size < 2) this.#span = 0;
    if (this.#pan?.id === event.pointerId) { this.#pan = null; this.#app.canvas.style.cursor = ''; }
    if (this.#touch?.id === event.pointerId) this.#touch = null;
    if (this.#click?.id === event.pointerId) this.#click = null;
  };

  /** Ziehen verschiebt das Bild unter dem Zeiger; die Figur bleibt stehen. */
  #drag = (event: PointerEvent, state: { x: number; y: number }): void => {
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (Math.abs(dx) + Math.abs(dy) < 1) return;
    state.x = event.clientX;
    state.y = event.clientY;
    const rect = this.#app.canvas.getBoundingClientRect();
    const world = this.#size() * TILE * this.#camera.scale.x;
    if (rect.width === 0 || world <= 0) return;
    const screen = rect.width / this.#app.screen.width;
    this.#cam.pan(dx / screen / world, dy / screen / world);
  };

  #wheel = (event: WheelEvent): void => {
    if (!this.#enabled()) return;
    event.preventDefault();
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const scaleFactor = rect.width / this.#app.screen.width;
    const localX = (event.clientX - rect.left) / scaleFactor;
    const localY = (event.clientY - rect.top) / scaleFactor;
    const worldX = (localX - this.#camera.x) / this.#camera.scale.x / (this.#size() * TILE);
    const worldY = (localY - this.#camera.y) / this.#camera.scale.y / (this.#size() * TILE);
    this.#cam.wheel(worldX, worldY, event.deltaY);
  };

  #menu = (event: Event): void => event.preventDefault();

  #distance = (): number => {
    const positions = [...this.#pointers.values()];
    if (positions.length < 2) return 0;
    return Math.hypot(positions[0]!.x - positions[1]!.x, positions[0]!.y - positions[1]!.y);
  };
}
