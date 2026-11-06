/** Kopf und Gesicht der Pixelfigur: Schaedel, Haar, Augen, Mund und Kopf-Textur. */
import { Graphics, Sprite, type Container } from 'pixi.js';
import type { LookAccessory } from '../core/sim/player-look';
import { textureFor } from './assets/textures';
import { headTextureFor } from './guest-parts';
import { pixelHead } from './pixel-head';

export type FaceKind = 'angry' | 'greedy' | 'happy' | 'meh' | 'neutral';

export interface HeadHair {
  readonly hair: number;
  readonly outfit: number;
  readonly persona: string;
  readonly accessory: LookAccessory;
  readonly isPlayer: boolean;
}

/**
 * Kopf-Textur oder Pixelkopf liegt ueber dem gezeichneten Schaedel; der bleibt dann leer.
 * Liefert das Sprite, damit der Aufrufer den Schaedel nicht erneut bemalen muss.
 */
export function mountHead(
  head: Container, drawn: readonly Graphics[], seed: number, portrait: boolean,
): Sprite | null {
  const hide = (): void => { for (const part of drawn) part.visible = false; };
  const pixel = portrait ? pixelHead(seed, 13) : null;
  if (pixel) {
    pixel.position.set(0, 1);
    head.addChild(pixel);
    hide();
  }
  const key = headTextureFor(seed);
  const texture = key ? textureFor(key) : null;
  if (!texture) return null;
  const sprite = new Sprite(texture);
  sprite.width = 14;
  sprite.height = 14;
  sprite.position.set(-7, -7);
  head.addChild(sprite);
  hide();
  return sprite;
}

export function paintSkull(skull: Graphics, skin: number): void {
  skull.clear();
  skull.rect(-5, -10, 10, 3).fill(skin);
  skull.rect(-7, -7, 14, 10).fill(skin);
  skull.rect(-5, 3, 10, 2).fill(skin);
}

export function paintFace(face: Graphics, kind: FaceKind, skin: number, accessory: LookAccessory): void {
  face.clear();
  const eye = (x: number): void => {
    face.rect(x - 2, -3, 4, 4).fill(0xffffff);
    face.rect(x - 1, -2, 2, 2).fill(0x171020);
  };
  eye(-3);
  eye(4);
  if (accessory === 'GLASSES') {
    face.rect(-6, -4, 12, 1).fill(0x1a1020);
    face.rect(-6, 0, 12, 1).fill(0x1a1020);
    face.rect(-6, -4, 1, 5).fill(0x1a1020);
    face.rect(5, -4, 1, 5).fill(0x1a1020);
  }
  if (kind === 'angry') {
    face.rect(-6, -6, 5, 1).fill(0x1a1020);
    face.rect(2, -6, 5, 1).fill(0x1a1020);
    face.rect(-2, 2, 5, 1).fill(0x4a1420);
  } else if (kind === 'greedy') {
    face.rect(-6, -6, 4, 1).fill(0x1a1020);
    face.rect(3, -6, 4, 1).fill(0x1a1020);
    face.rect(-1, 2, 4, 2).fill(0x4a1420);
    face.rect(1, 2, 1, 1).fill(0xff6b81);
  } else if (kind === 'happy') {
    face.rect(-2, 2, 5, 1).fill(0x6a2030);
    face.rect(-1, 3, 3, 1).fill(0x6a2030);
  } else if (kind === 'meh') {
    face.rect(-6, -6, 11, 1).fill(skin);
    face.rect(-2, 3, 4, 1).fill(0x5a2030);
  } else {
    face.rect(-2, 3, 5, 1).fill(0x6a2030);
  }
}

/** Haarschnitt je Persona und Accessoire; der Spieler traegt seine Outfit-Farbe im Band. */
export function paintHair(hair: Graphics, state: HeadHair): void {
  hair.clear();
  const block = (x: number, y: number, w: number, h: number): void => { hair.rect(x, y, w, h).fill(state.hair); };
  if (state.accessory === 'CAP') {
    block(-7, -10, 14, 4);
    hair.rect(2, -8, 8, 2).fill(state.outfit);
  } else if (state.persona === 'BUSINESS') {
    block(-7, -10, 14, 4);
    block(-4, -12, 8, 2);
  } else if (state.persona === 'HIGH_ROLLER') {
    hair.rect(-8, -13, 16, 4).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
    hair.rect(-9, -10, 18, 2).fill(0x16101e).stroke({ width: 1, color: 0xffd166 });
  } else if (state.persona === 'STAMMGAST') {
    block(-7, -11, 14, 5);
    block(-8, -8, 3, 4);
  } else if (state.persona === 'STREET') {
    block(-7, -11, 3, 4);
    block(-2, -12, 3, 3);
    block(3, -11, 4, 4);
  } else {
    block(-7, -10, 14, 3);
    block(-5, -12, 8, 2);
  }
  if (state.isPlayer && state.accessory !== 'CAP') {
    hair.rect(-8, -10, 16, 2).fill(state.outfit);
  }
}
