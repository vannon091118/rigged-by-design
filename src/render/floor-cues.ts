/**
 * Bodenhinweise: Spielerring, Zielraster, Laufweg und Klick-Puls in einer Ebene.
 * Reine Darstellung der Steuerung: nichts hier entscheidet, wohin die Figur laeuft.
 */
import { Container, Graphics, Sprite, type Renderer } from 'pixi.js';
import { TILE } from '../core/sim/types';
import { ROLE, STROKE } from './art-tokens';

interface Cell { readonly x: number; readonly y: number }
type CueMode = 'walk' | 'zoom';

const PING_MS = 460;
const PING_STAGGER = 40;
const ARM = 6;
/** Nachleuchten: ein Tipp ohne Hover zeigt das Ziel noch eine halbe Sekunde. */
const GLOW_MS = 500;

/** Ein Ring, dreimal gebacken statt neun Shapes pro Frame. */
function bakeRing(renderer: Renderer): Sprite[] {
  const shape = new Graphics();
  shape.ellipse(0, 0, 20, 9).stroke({ width: 3, color: 0xffffff, alpha: 0.9 });
  shape.ellipse(0, 0, 12, 5.4).stroke({ width: 2, color: 0xffffff, alpha: 0.55 });
  shape.circle(0, 0, 4).fill({ color: 0xffffff, alpha: 0.75 });
  const texture = renderer.generateTexture({ target: shape, resolution: 1 });
  shape.destroy();
  return [0, 1, 2].map(() => {
    const sprite = new Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.visible = false;
    return sprite;
  });
}

export class FloorCues {
  readonly root = new Container();
  readonly #canvas: HTMLCanvasElement;
  readonly #cellAt: (clientX: number, clientY: number) => Cell | null;
  readonly #ring = new Graphics();
  readonly #reticle = new Graphics();
  readonly #pings: Sprite[];
  readonly #path = new Graphics();
  #hover: Cell | null = null;
  #glowCell: Cell | null = null;
  #glowUntil = 0;
  #pressed = false;
  #hoverKey = '';
  #mode: CueMode = 'walk';
  #feet = { x: 0, y: 0 };
  #pingAt: Cell | null = null;
  #pingStart = 0;
  #pingWaiting = false;
  #pathKey = '';
  #client = { x: -1, y: -1 };

  constructor(
    canvas: HTMLCanvasElement,
    cellAt: (clientX: number, clientY: number) => Cell | null,
    renderer: Renderer,
  ) {
    this.#canvas = canvas;
    this.#cellAt = cellAt;
    this.#pings = bakeRing(renderer);
    this.root.eventMode = 'none';
    this.root.interactiveChildren = false;
    this.root.addChild(this.#path, this.#ring, this.#reticle, ...this.#pings);
    this.#ring.ellipse(0, 13, 13, 5.6).fill({ color: ROLE.service, alpha: 0.12 });
    this.#ring.ellipse(0, 13, 11.5, 4.9).stroke({ width: 1.6, color: ROLE.service, alpha: 0.5 });
    this.#ring.ellipse(0, 13, 6.6, 2.7).stroke({ width: 1, color: ROLE.service, alpha: 0.35 });
    canvas.addEventListener('pointermove', this.#move);
    canvas.addEventListener('pointerleave', this.#leave);
    canvas.addEventListener('pointerdown', this.#down);
  }

  /** Uebersicht klickt heran, Detail laeuft: das Zielraster zeigt die Farbe der Folge. */
  setMode(detail: boolean): void {
    const mode: CueMode = detail ? 'walk' : 'zoom';
    if (mode === this.#mode) return;
    this.#mode = mode;
    this.#hoverKey = '';
    this.#drawReticle(this.#hover ?? this.#glowCell);
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
    if (this.#pressed) {
      this.#pressed = false;
      this.#glowUntil = now + GLOW_MS;
    }
    if (this.#glowCell && now >= this.#glowUntil) {
      this.#glowCell = null;
      this.#hoverKey = '';
      this.#drawReticle(this.#hover);
    }
    const pulse = 1 + Math.sin(now / 640) * 0.06;
    this.#ring.position.set(this.#feet.x, this.#feet.y);
    this.#ring.scale.set(pulse, pulse);
    this.#drawPing(now);
  }

  destroy(): void {
    this.#canvas.removeEventListener('pointermove', this.#move);
    this.#canvas.removeEventListener('pointerleave', this.#leave);
    this.#canvas.removeEventListener('pointerdown', this.#down);
    this.root.destroy({ children: true });
  }

  #drawReticle(cell: Cell | null): void {
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
    const elapsed = now - this.#pingStart;
    const cx = (this.#pingAt.x + 0.5) * TILE;
    const cy = (this.#pingAt.y + 0.68) * TILE;
    const color = this.#mode === 'zoom' ? ROLE.identity : ROLE.service;
    let alive = false;
    for (let index = 0; index < this.#pings.length; index += 1) {
      const sprite = this.#pings[index]!;
      const t = (elapsed - index * PING_STAGGER) / PING_MS;
      if (t < 0 || t >= 1) { sprite.visible = false; continue; }
      alive = true;
      const ease = 1 - (1 - t) * (1 - t);
      sprite.visible = true;
      sprite.position.set(cx, cy);
      sprite.scale.set(0.35 + ease * 1.15);
      sprite.alpha = (1 - t) * (0.62 - index * 0.14);
      sprite.tint = color;
    }
    if (!alive) this.#pingAt = null;
  }

  #move = (event: PointerEvent): void => {
    this.#client.x = event.clientX;
    this.#client.y = event.clientY;
    this.#aim(this.#cellAt(event.clientX, event.clientY));
  };

  /** Auf Touch gibt es kein Hover: der Finger zeigt das Ziel selbst. */
  #down = (event: PointerEvent): void => {
    if (event.button !== 0) return;
    const cell = this.#cellAt(event.clientX, event.clientY);
    if (!cell) return;
    this.#client.x = event.clientX;
    this.#client.y = event.clientY;
    this.#glowCell = cell;
    this.#pressed = true;
    this.#aim(cell);
  };

  #aim = (cell: Cell | null): void => {
    if (cell?.x === this.#hover?.x && cell?.y === this.#hover?.y) return;
    this.#hover = cell;
    this.#drawReticle(cell ?? this.#glowCell);
  };

  #leave = (): void => {
    this.#client.x = -1;
    if (!this.#hover) return;
    this.#hover = null;
    this.#drawReticle(this.#glowCell);
  };
}
