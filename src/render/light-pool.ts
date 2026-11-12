/**
 * Licht als ein Layer, nicht als 16 gestapelte Ellipsen pro Zone.
 *
 * Jede Zone bekommt einen Slot aus einem festen 16er-Pool. Alle Slots teilen
 * dieselbe 256×256-Radialtextur; Farbe und Dosis kommen aus der bestehenden
 * Lichtrolle. Der Layer ist reine Darstellung und liest nur den Snapshot.
 */
import { Container, Sprite } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { lightFor } from './art-tokens';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';

export const LIGHT_POOL_SLOTS = 16;

interface LightSlot {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly tint: number;
  readonly alpha: number;
}

/** Deterministische Slotbelegung aus Zonen; hoechstens 16 gleichzeitig. */
export function lightSlots(view: GameView): LightSlot[] {
  return view.zones.slice(0, LIGHT_POOL_SLOTS).map((zone) => {
    const light = lightFor(zone.kind, view.dayPhase);
    return {
      x: (zone.x + zone.w / 2) * TILE,
      y: (zone.y + zone.h / 2) * TILE,
      w: Math.max(24, zone.w * TILE * 0.95),
      h: Math.max(24, zone.h * TILE * 0.88),
      tint: light.tint,
      alpha: 0.2 * light.intensity,
    };
  });
}

export class LightPool {
  readonly root = new Container();
  readonly #sprites: Sprite[] = [];
  #destroyed = false;

  constructor() {
    this.root.eventMode = 'none';
  }

  update(view: GameView): void {
    if (this.#destroyed) return;
    const texture = textureFor(ASSET.lightPool);
    if (!texture) return;
    const slots = lightSlots(view);
    while (this.#sprites.length < slots.length) {
      const sprite = new Sprite(texture);
      sprite.anchor.set(0.5, 0.5);
      // BlendMode gehoert auf das Lichtkind, nicht auf die Gruppe.
      sprite.blendMode = 'add';
      this.root.addChild(sprite);
      this.#sprites.push(sprite);
    }
    slots.forEach((slot, index) => {
      const sprite = this.#sprites[index]!;
      sprite.texture = texture;
      sprite.position.set(slot.x, slot.y);
      sprite.width = slot.w;
      sprite.height = slot.h;
      sprite.tint = slot.tint;
      sprite.alpha = slot.alpha;
      sprite.visible = true;
    });
    for (let index = slots.length; index < this.#sprites.length; index += 1) this.#sprites[index]!.visible = false;
  }

  destroy(): void {
    this.#destroyed = true;
    this.root.destroy({ children: true });
    this.#sprites.length = 0;
  }
}
