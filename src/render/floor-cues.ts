/**
 * Bodenhinweise: Spielerring, Zielraster, Laufweg und Klick-Puls in einer Ebene.
 * Reine Darstellung der Steuerung: nichts hier entscheidet, wohin die Figur laeuft.
 */
import { Container, Graphics } from 'pixi.js';
import { TILE } from '../core/sim/types';
import { ROLE, STROKE } from './art-tokens';

interface Cell { readonly x: number; readonly y: number }
type CueMode = 'walk' | 'zoom';

const PING_MS = 460;
const ARM = 6;

export class FloorCues {
  readonly root = new Container();
  readonly #canvas: HTMLCanvasElement;
  readonly #cellAt: (clientX: number, clientY: number) => Cell | null;
  readonly #ring = new Graphics();
  readonly #reticle = new Graphics();
  readonly #ping = new Graphics();
  readonly #path = new Graphics();
  #hover: Cell | null = null;
  #hoverKey = '';
  #mode: CueMode = 'walk';
  #feet = { x: 0, y: 0 };
  #pingAt: Cell | null = null;
  #pingStart = 0;
  #pingWaiting = false;
  #pathKey = '';
  #client = { x: -1, y: -1 };

  constructor(canvas: HTMLCanvasElement, cellAt: (clientX: number, clientY: number) => Cell | null) {
    this.#canvas = canvas;
    this.#cellAt = cellAt;
    this.root.eventMode = 'none';
    this.root.interactiveChildren = false;
    this.root.addChild(this.#path, this.#ring, this.#reticle, this.#ping);
    this.#ring.ellipse(0, 13, 13, 5.6).fill({ color: ROLE.service, alpha: 0.12 });
    this.#ring.ellipse(0, 13, 11.5, 4.9).stroke({ width: 1.6, color: ROLE.service, alpha: 0.5 });
    this.#ring.ellipse(0, 13, 6.6, 2.7).stroke({ width: 1, color: ROLE.service, alpha: 0.35 });
    canvas.addEventListener('pointermove', this.#move);
    canvas.addEventListener('pointerleave', this.#leave);
  }

  /** Uebersicht klickt heran, Detail laeuft: das Zielraster zeigt die Farbe der Folge. */
  setMode(detail: boolean): void {
    const mode: CueMode = detail ? 'walk' : 'zoom';
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#hoverKey = '';
    this.#drawReticle();
  }

  /** Laufweg als Punktspur, Ziel als Ring: man sieht vor dem Loslaufen, wohin es geht. */
  setPath(points: readonly Cell[], index: number): void {
    const tail = points[points.length - 1];
    const key = `${points.length}|${index}|${tail?.x ?? -1},${tail?.y ?? -1}`;
    if (key === this.#pathKey) return;
    this.#pathKey = key;
    const g = this.#path;
    g.clear();
    for (let step = Math.max(1, index + 1); step < points.length - 1; step += 1) {
      const point = points[step]!;
      g.circle((point.x + 0.5) * TILE, (point.y + 0.68) * TILE, 1.3).fill({ color: ROLE.service, alpha: 0.32 });
    }
    if (tail && index < points.length - 1) {
      g.circle((tail.x + 0.5) * TILE, (tail.y + 0.68) * TILE, 5)
        .stroke({ width: STROKE.hair, color: ROLE.service, alpha: 0.45 });
    }
  }

  ping(cell: Cell): void {
    this.#pingAt = cell;
    this.#pingWaiting = true;
  }

  /** Nach einer Kamerafahrt liegt unter dem Zeiger eine andere Kachel: Raster nachziehen. */
  refresh(): void {
    if (this.#client.x < 0) return;
    this.#aim(this.#cellAt(this.#client.x, this.#client.y));
  }

  animate(now: number, feet: { x: number; y: number }): void {
    this.#feet.x = feet.x;
    this.#feet.y = feet.y;
    const pulse = 1 + Math.sin(now / 640) * 0.06;
    this.#ring.position.set(this.#feet.x, this.#feet.y);
    this.#ring.scale.set(pulse, pulse);
    this.#drawPing(now);
  }

  destroy(): void {
    this.#canvas.removeEventListener('pointermove', this.#move);
    this.#canvas.removeEventListener('pointerleave', this.#leave);
    this.root.destroy({ children: true });
  }

  #drawReticle(): void {
    const cell = this.#hover;
    const key = `${cell?.x ?? -1},${cell?.y ?? -1}|${this.#mode}`;
    if (key === this.#hoverKey) return;
    this.#hoverKey = key;
    const g = this.#reticle;
    g.clear();
    g.visible = cell !== null;
    if (!cell) return;
    const color = this.#mode === 'walk' ? ROLE.service : ROLE.identity;
    const x = cell.x * TILE;
    const y = cell.y * TILE;
    const cx = x + TILE / 2;
    const cy = y + TILE / 2;
    // Leuchtende Mitte: ein kleiner, heller Kern in der Kachelmitte.
    g.circle(cx, cy, 2).fill({ color, alpha: 0.8 });
    g.circle(cx, cy, 1).fill({ color: 0xffffff, alpha: 0.9 });
    g.moveTo(x, y + ARM).lineTo(x, y).lineTo(x + ARM, y);
    g.moveTo(x + TILE - ARM, y).lineTo(x + TILE, y).lineTo(x + TILE, y + ARM);
    g.moveTo(x + TILE, y + TILE - ARM).lineTo(x + TILE, y + TILE).lineTo(x + TILE - ARM, y + TILE);
    g.moveTo(x + ARM, y + TILE).lineTo(x, y + TILE).lineTo(x, y + TILE - ARM);
    g.stroke({ width: STROKE.base, color, alpha: 0.8 });
    if (this.#mode === 'zoom') {
      g.moveTo(cx - 4, cy).lineTo(cx + 4, cy);
      g.moveTo(cx, cy - 4).lineTo(cx, cy + 4);
      g.stroke({ width: 1, color, alpha: 0.7 });
    } else {
      g.circle(cx, cy, 1.4).fill({ color, alpha: 0.6 });
    }
  }

  #drawPing(now: number): void {
    if (!this.#pingAt) return;
    if (this.#pingWaiting) {
      this.#pingWaiting = false;
      this.#pingStart = now;
    }
    const t = (now - this.#pingStart) / PING_MS;
    const g = this.#ping;
    g.clear();
    if (t >= 1) {
      this.#pingAt = null;
      return;
    }
    const ease = 1 - (1 - t) * (1 - t);
    const cx = (this.#pingAt.x + 0.5) * TILE;
    const cy = (this.#pingAt.y + 0.68) * TILE;
    const color = this.#mode === 'zoom' ? ROLE.identity : ROLE.service;
    // Drei konzentrische Ringe: ein wachsender, ein leicht verzögerter, ein kleiner Kern.
    for (const ring of [0, 0.25, 0.5]) {
      const r = (3 + ease * 20) * (1 - ring * 0.4);
      const alpha = (1 - t) * (0.5 - ring * 0.15);
      g.ellipse(cx, cy, r, r * 0.46).stroke({ width: STROKE.base, color, alpha });
      g.circle(cx, cy, r * 0.25).fill({ color, alpha: (1 - t) * 0.6 });
    }
  }

  #move = (event: PointerEvent): void => {
    this.#client.x = event.clientX;
    this.#client.y = event.clientY;
    this.#aim(this.#cellAt(event.clientX, event.clientY));
  };

  #aim = (cell: Cell | null): void => {
    if (cell?.x === this.#hover?.x && cell?.y === this.#hover?.y) return;
    this.#hover = cell;
    this.#drawReticle();
  };

  #leave = (): void => {
    this.#client.x = -1;
    if (!this.#hover) return;
    this.#hover = null;
    this.#drawReticle();
  };
}
