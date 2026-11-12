/**
 * Teppichwahl als feine Textur ueber den Tiles, deren Layout-Material CARPET
 * ist. Die Maske kommt aus dem Layout, nicht aus Zonen: Bodenmaterial bleibt
 * die Wahrheit, die Auswahl nur eine Darstellungsnuance.
 */
import { Container, Graphics, TilingSprite } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { LayoutState } from '../core/sim/layout-types';
import type { GameView } from '../store/types';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';

export class CarpetOverlay {
  readonly root = new Container();
  readonly #mask = new Graphics();
  #sheet: TilingSprite | null = null;
  #layout: LayoutState | null = null;
  #apartment = false;

  update(view: GameView): void {
    const texture = textureFor(ASSET.carpet);
    if (!texture) return;
    const apartment = view.scene.kind === 'APARTMENT';
    const size = view.size * TILE;
    if (!this.#sheet) {
      this.#sheet = new TilingSprite({ texture, width: size, height: size });
      this.#sheet.alpha = 0.14;
      this.#sheet.tileScale.set(0.34);
      this.#sheet.mask = this.#mask;
      this.root.addChild(this.#mask, this.#sheet);
    }
    // Die Casino-Teppichwahl gilt nicht in der Wohnung; dort traegt der Boden
    // seine eigene, matte Wohnungspalette.
    this.#sheet.visible = !apartment;
    if (this.#sheet.width !== size) {
      this.#sheet.width = size;
      this.#sheet.height = size;
    }
    const themeChanged = this.#apartment !== apartment;
    this.#apartment = apartment;
    if (this.#layout === view.layout && !themeChanged) return;
    this.#layout = view.layout;
    this.#mask.clear();
    if (apartment) return;
    const layout = view.layout;
    for (let y = 0; y < layout.size; y += 1) {
      for (let x = 0; x < layout.size; x += 1) {
        if (layout.floor[y * layout.size + x] !== 'CARPET') continue;
        this.#mask.rect(x * TILE, y * TILE, TILE, TILE).fill(0xffffff);
      }
    }
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
