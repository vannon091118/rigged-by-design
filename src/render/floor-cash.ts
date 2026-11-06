/** Kasse als Objekt: offene Gewinne liegen als Chip-Stapel am Wechseltisch. */
import { Container, Graphics } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ROLE, STROKE } from './art-tokens';
import { playSfx } from './sound-fx';

const CHIP_VC = 5 * 10_000;
const MAX_CHIPS = 6;

export class FloorCash {
  readonly root = new Container();
  readonly #pulse = new Graphics();
  readonly #chips = new Container();
  #drawn = -1;
  #lastTick = -1;

  constructor() {
    this.#pulse.circle(0, 0, 26).fill({ color: ROLE.value, alpha: 0.16 });
    this.#pulse.circle(0, 0, 26).stroke({ width: STROKE.base, color: ROLE.value, alpha: 0.45 });
    this.root.addChild(this.#pulse, this.#chips);
    this.root.visible = false;
  }

  /** Bestand, Position und Klingeln folgen dem Snapshot, nicht der Uhr. */
  sync(view: GameView): void {
    const desk = view.furniture.find((item) => item.kind === 'EXCHANGE');
    if (!desk) {
      this.root.visible = false;
      return;
    }
    const count = view.pending > 0
      ? Math.min(MAX_CHIPS, Math.max(1, Math.ceil(view.pending / CHIP_VC)))
      : 0;
    this.root.visible = true;
    this.root.position.set((desk.x + desk.w / 2) * TILE, (desk.y + desk.h * 0.82) * TILE);
    this.#pulse.visible = count > 0;
    if (count !== this.#drawn) this.#draw(count);
    if (count > 0 && view.tick !== this.#lastTick) {
      this.#lastTick = view.tick;
      // Ein Klingeln pro zwei Ticks: hoechstens alle 1,04 s und nie doppelt je Snapshot.
      if (view.tick % 2 === 0) playSfx('coin');
    }
  }

  /** Warmes Pulslicht; reine Darstellung. */
  pulse(now: number): void {
    this.#pulse.alpha = 0.45 + Math.sin(now / 360) * 0.2;
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  #draw(count: number): void {
    this.#drawn = count;
    for (const child of this.#chips.removeChildren()) child.destroy();
    for (let index = 0; index < count; index += 1) {
      const chip = new Graphics();
      const x = Math.sin(index * 2.1) * 2.4;
      const y = -index * 4;
      chip.roundRect(-9, -4, 18, 7, 3).fill(ROLE.value).stroke({ width: 1, color: 0x8a6a1a });
      chip.roundRect(-6, -2, 12, 3, 1.5).fill({ color: 0xfff2c4, alpha: 0.7 });
      chip.position.set(x, y);
      this.#chips.addChild(chip);
    }
  }
}
