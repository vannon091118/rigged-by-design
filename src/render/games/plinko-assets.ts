/** Plinko-Texturen: Pegs und Auszahlungsfelder, mit gezeichnetem Rueckfall. */
import { Graphics, Sprite, type Container } from 'pixi.js';
import type { PegKind } from '../../core/games/plinko-config';
import { textureFor } from '../assets/textures';

export const PEG_COLOR: Readonly<Record<PegKind, number>> = {
  NORMAL_PEG: 0x6f5b8c,
  BOUNCY_PEG: 0x54e0ff,
  STICKY_PEG: 0xffd166,
  MAGNET_PEG: 0xff2e88,
  SPLIT_PEG: 0x8ff0c6,
};

const PEG_TEXTURE: Readonly<Record<PegKind, string>> = {
  NORMAL_PEG: 'plinko/peg-steel.png',
  BOUNCY_PEG: 'plinko/bouncy-peg-cyan.png',
  STICKY_PEG: 'plinko/sticky-peg-gold.png',
  MAGNET_PEG: 'plinko/magnet-peg-pink.png',
  SPLIT_PEG: 'plinko/split-peg-green.png',
};

export function pegArt(peg: { readonly x: number; readonly y: number; readonly kind: PegKind }, radius: number): Container {
  const texture = textureFor(PEG_TEXTURE[peg.kind]);
  if (texture) {
    const sprite = new Sprite(texture);
    sprite.width = radius * 2.8;
    sprite.height = radius * 2.8;
    sprite.position.set(peg.x - radius * 1.4, peg.y - radius * 1.4);
    return sprite;
  }
  const g = new Graphics();
  g.circle(peg.x, peg.y, radius).fill(PEG_COLOR[peg.kind]);
  if (peg.kind !== 'NORMAL_PEG') g.circle(peg.x, peg.y, radius + 0.7).stroke({ width: 0.3, color: 0xffffff, alpha: 0.5 });
  return g;
}

export function payoutArt(left: number, width: number, floorY: number, payBps: number): Sprite | null {
  const key = payBps >= 50_000 ? 'plinko/payout-100-gold.png'
    : payBps >= 20_000 ? 'plinko/payout-50-cyan.png' : 'plinko/payout-10-violet.png';
  const texture = textureFor(key);
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.position.set(left + 0.6, floorY);
  sprite.width = width - 1.2;
  sprite.height = 16;
  sprite.alpha = 0.85;
  return sprite;
}
