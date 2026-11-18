/** Gaeste-Teile, die einmal gelten: Palette, Kopftexturen und der eine Schatten. */
import { Graphics, Sprite, type Renderer, type Texture } from 'pixi.js';
import { SHADOW } from './art-tokens';

export const PERSONA_COLORS: Record<string, number> = {
  LUMPEN: 0x8d99ae, STREET: 0x00c9a7, STAMMGAST: 0xb06bff, BUSINESS: 0xd6a84b, HIGH_ROLLER: 0xff2e88,
};
export const SKINS = [0xf2d3b3, 0xe0b48c, 0xb97c4b, 0x8a5a36, 0xd8a27a];
export const HAIRS = [0x2a1a14, 0x5a3a22, 0xd9b35c, 0x1a1020, 0x9a5a2a];
export const PANTS = 0x1c1226;
export const SHOES = 0x0c0814;

export const hash = (value: string): number => {
  let result = 0;
  for (let index = 0; index < value.length; index += 1) result = (result * 31 + value.charCodeAt(index)) | 0;
  return Math.abs(result);
};

/** Die drei Kopffamilien; ihre Vertreter liegen im selben Atlas. */
export const HEAD_FAMILIES = Object.freeze(['head-01', 'head-02', 'head-03'] as const);
export type HeadFamily = (typeof HEAD_FAMILIES)[number];

/**
 * Kopf-Texturen aus dem Manifest, einem Gast nach seinem Seed zugeordnet.
 * `head-03-01.svg` haengt hinten an: bestehende Gaeste behalten ihren Kopf,
 * nur der neue Bucket bekommt die dritte Familie.
 */
const HEAD_TEXTURES: readonly string[] = [
  'characters/head-01-01.png', 'characters/head-01-02.png', 'characters/head-01-03.png',
  'characters/head-01-04.png', 'characters/head-01-05.png', 'characters/head-01-06.png',
  'characters/head-01-07.png', 'characters/head-01-08.png', 'characters/head-01-09.png',
  'characters/head-02-01.png', 'characters/head-02-02.png', 'characters/head-02-03.png',
  'characters/head-02-04.png', 'characters/head-02-05.png', 'characters/head-02-06.png',
  'characters/head-02-07.png', 'characters/head-02-08.png', 'characters/head-02-09.png',
  'characters/head-03-01.svg',
];

export function headTextureFor(seed: number): string | null {
  return HEAD_TEXTURES[Math.abs(seed) % HEAD_TEXTURES.length] ?? null;
}

/** Kopffamilie eines Texturpfads; unbekannte Pfade bleiben ohne Familie. */
export function headFamilyFor(path: string | null): HeadFamily | null {
  const match = /characters\/(head-\d{2})-/.exec(path ?? '');
  return HEAD_FAMILIES.find((family) => family === match?.[1]) ?? null;
}

/** Schatten einmal backen: eine Textur fuer alle Figuren statt Graphic pro Figur. */
let shadowTexture: Texture | null = null;

export function primeGuestShadow(renderer: Renderer): void {
  if (shadowTexture) return;
  const shape = new Graphics()
    .ellipse(0, 0, 11, 4).fill({ color: 0x000000, alpha: SHADOW.soft })
    .rect(-9, -1, 18, 2.5).fill({ color: 0x000000, alpha: SHADOW.deep });
  shadowTexture = renderer.generateTexture({ target: shape, resolution: 1 });
  shape.destroy();
}

export function shadowSprite(): Sprite {
  const sprite = new Sprite(shadowTexture!);
  sprite.anchor.set(0.5, 0.5);
  sprite.position.set(0, 15);
  return sprite;
}
