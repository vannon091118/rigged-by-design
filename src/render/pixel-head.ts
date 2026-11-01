/** Figuren aus dem Paket: ein Kopf-Sprite, das die gezeichnete Figur ersetzt, wenn es geladen ist. */
import { Sprite } from 'pixi.js';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';

const HEAD_RATIO = 36 / 32;

/** Deterministischer Kopf je Figur; `size` ist die Breite in Weltpixeln. */
export function pixelHead(seed: number, size: number): Sprite | null {
  const path = ASSET.heads[Math.abs(seed) % ASSET.heads.length]!;
  const texture = textureFor(path);
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.9);
  sprite.width = size;
  sprite.height = size * HEAD_RATIO;
  return sprite;
}

/** Der Croupier/Dealer mit eigenem Kopf, damit er nicht wie ein Gast wirkt. */
export function dealerHead(size: number): Sprite | null {
  const texture = textureFor(ASSET.dealer);
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.anchor.set(0.5, 0.9);
  sprite.width = size;
  sprite.height = size * HEAD_RATIO;
  return sprite;
}
