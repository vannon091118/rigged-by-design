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
import { WALL, wallBandRect, wallDepthId, wallFaceInBand, type WallView } from './wall-art';

const WALLPAPER = 'environment/tiles/wallpaper-damask-plum.png';

interface Textures { readonly h: Texture; readonly v: Texture }

function bandTexture(renderer: Renderer, vertical: boolean, tile: number): Texture {
  const w = vertical ? WALL : tile;
  const h = vertical ? tile : WALL;
  const g = new Graphics();
  g.rect(0, 0, w, h).fill({ color: INK, alpha: 0.96 });
  const face = wallFaceInBand(vertical ? 'V' : 'H', { x: 0, y: 0, w, h });
  g.rect(face.x, face.y, face.w, face.h).fill({ color: 0x191322, alpha: 0.98 });
  g.rect(face.x, face.y, face.w, 1).fill({ color: LIGHT.cool, alpha: 0.3 });
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
  #tile: number | null = null;
  #sprites: Sprite[] = [];
  #textures = new Map<number, Textures>();

  /** Baut die Schicht nur neu, wenn Layout oder Tile-Groesse gewechselt haben. */
  sync(renderer: Renderer, view: WallView, tile: number, stage: DepthStage): void {
    if (this.#layout === view.layout && this.#tile === tile) return;
    this.#layout = view.layout;
    this.#tile = tile;
    let textures = this.#textures.get(tile);
    if (!textures) {
      textures = { h: bandTexture(renderer, false, tile), v: bandTexture(renderer, true, tile) };
      this.#textures.set(tile, textures);
    }
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    for (const edge of view.layout.edges) {
      if (edge.kind !== 'WALL') continue;
      const band = wallBandRect(edge, view.size, tile);
      const sprite = new Sprite(edge.axis === 'H' ? textures.h : textures.v);
      sprite.position.set(band.x, band.y);
      stage.root.addChild(sprite);
      this.#sprites.push(sprite);
      stage.set(sprite, band.y + band.h, 'wall', wallDepthId(edge));
    }
  }

  destroy(): void {
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    for (const textures of this.#textures.values()) {
      textures.h.destroy(true);
      textures.v.destroy(true);
    }
    this.#textures.clear();
  }
}
