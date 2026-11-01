/** Bodentextur aus dem Paket: ein Teppichmuster ueber den Zonen, unter Moebeln und Figuren. */
import { Container, Graphics, TilingSprite } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';

export class CarpetOverlay {
  readonly root = new Container();
  readonly #mask = new Graphics();
  #sheet: TilingSprite | null = null;
  #key = '';

  update(view: GameView): void {
    const texture = textureFor(ASSET.carpet);
    if (!texture) return;
    const size = view.size * TILE;
    if (!this.#sheet) {
      this.#sheet = new TilingSprite({ texture, width: size, height: size });
      this.#sheet.alpha = 0.18;
      this.#sheet.tileScale.set(0.34);
      this.#sheet.mask = this.#mask;
      this.root.addChild(this.#mask, this.#sheet);
    }
    if (this.#sheet.width !== size) {
      this.#sheet.width = size;
      this.#sheet.height = size;
    }
    const carpetZones = view.zones.filter((zone) => zone.kind === 'GAMING' || zone.kind === 'LOUNGE');
    const zones = carpetZones.map((zone) => `${zone.id}:${zone.x},${zone.y},${zone.w},${zone.h}`).join('|');
    const key = `${view.size}|${view.template}|${zones}`;
    if (key === this.#key) return;
    this.#key = key;
    this.#mask.clear();
    for (const zone of carpetZones) {
      this.#mask.rect(zone.x * TILE, zone.y * TILE, zone.w * TILE, zone.h * TILE).fill(0xffffff);
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
