/**
 * Vordergrund-Waende als eigene Occlusion-Schicht. Jede Wand ist ein Sprite in
 * der gemeinsamen Tiefenebene; sein Anker ist die Suedkante des Bands. Figuren
 * noerdlich davon liegen dahinter, Figuren suedlich davor. Die Texturen werden
 * einmal je Ausrichtung erzeugt und von allen Waenden geteilt.
 */
import { Container, Graphics, Sprite, TilingSprite, type Renderer, type Texture } from 'pixi.js';
import type { LayoutState } from '../core/sim/layout-types';
import { INK, LIGHT } from './art-tokens';
import { textureFor } from './assets/textures';
import type { DepthStage } from './depth';
import { WALL, WALL_FACE, wallBandRect, wallDepthId, type WallView } from './wall-art';

const WALLPAPER = 'environment/tiles/wallpaper-damask-plum.png';

interface Textures { readonly h: Texture; readonly v: Texture }

function bandTexture(renderer: Renderer, vertical: boolean, tile: number): Texture {
  const w = vertical ? WALL : tile;
  const h = vertical ? tile : WALL;
  const g = new Graphics();
  g.rect(0, 0, w, h).fill({ color: INK, alpha: 0.96 });
  const face = vertical
    ? { x: w - WALL_FACE, y: 1, w: WALL_FACE, h: h - 2 }
    : { x: 1, y: h - WALL_FACE, w: w - 2, h: WALL_FACE };
  g.rect(face.x, face.y, face.w, face.h).fill({ color: 0x191322, alpha: 0.98 });
  g.rect(face.x, face.y, vertical ? face.w : face.w, 1).fill({ color: LIGHT.cool, alpha: 0.3 });
  const wallpaper = textureFor(WALLPAPER);
  if (!wallpaper) return renderer.generateTexture(g);
  const root = new Container();
  const sheet = new TilingSprite({ texture: wallpaper, width: w, height: h });
  sheet.tileScale.set(2);
  sheet.alpha = 0.24;
  root.addChild(g, sheet);
  return renderer.generateTexture(root);
}

export class WallOcclusion {
  #layout: LayoutState | null = null;
  #sprites: Sprite[] = [];
  #textures: Textures | null = null;

  /** Baut die Schicht nur neu, wenn sich die Layout-Identitaet geaendert hat. */
  sync(renderer: Renderer, view: WallView, tile: number, stage: DepthStage): void {
    if (this.#layout === view.layout) return;
    this.#layout = view.layout;
    this.#textures ??= { h: bandTexture(renderer, false, tile), v: bandTexture(renderer, true, tile) };
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    for (const edge of view.layout.edges) {
      if (edge.kind !== 'WALL') continue;
      const band = wallBandRect(edge, view.size, tile);
      const sprite = new Sprite(edge.axis === 'H' ? this.#textures.h : this.#textures.v);
      sprite.position.set(band.x, band.y);
      stage.root.addChild(sprite);
      this.#sprites.push(sprite);
      stage.set(sprite, band.y + band.h, 'wall', wallDepthId(edge));
    }
  }

  destroy(): void {
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    this.#textures = null;
  }
}
