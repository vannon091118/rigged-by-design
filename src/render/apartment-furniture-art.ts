/**
 * @module apartment-furniture-art — eigene Bildsprache der Wohnung
 *
 * Die Wohnung teilt die Möbelmechanik mit dem Casino, aber nicht dessen Optik:
 * warmes Holz, Leinen, Keramik und mattes Metall statt Neon und Samt. Gezeichnet
 * wird prozedural, gebunden an die stabile `artId` (`apartment:*`), nicht an
 * einen Anzeigenamen.
 */
import type { Graphics } from 'pixi.js';
import type { FurnitureRole } from './decor-roles';

const OAK = 0x8a5a3c;
const OAK_DARK = 0x5d3a26;
const LINEN = 0xe8dcc4;
const CLAY = 0xc98f4a;
const CERAMIC = 0xe6e2da;
const STEEL = 0x9aa0a6;
const GLASS = 0x1a2430;

/** Wahr, wenn das Möbel die Wohnungs-ART trägt; nur diese IDs bekommen diese Optik. */
export const isApartmentFurniture = (item: { readonly artId?: string }): boolean =>
  item.artId?.startsWith('apartment:') === true;

/** Rolle → warmes Wohnungsbild. Unbekannte Rollen bleiben eine schlichte Fläche. */
export function drawApartmentFurniture(g: Graphics, w: number, h: number, role: FurnitureRole): void {
  switch (role) {
    case 'BED':
      g.roundRect(2, h * 0.18, w - 4, h * 0.68, 4).fill(OAK);
      g.roundRect(5, h * 0.24, w - 10, h * 0.48, 3).fill(LINEN);
      g.roundRect(7, h * 0.26, w * 0.3, h * 0.16, 4).fill(0xf7f1e4);
      g.rect(5, h * 0.58, w - 10, h * 0.16).fill({ color: CLAY, alpha: 0.5 });
      return;
    case 'WARDROBE':
      g.roundRect(2, h * 0.08, w - 4, h * 0.84, 3).fill(OAK);
      g.rect(w * 0.48, h * 0.12, 1.5, h * 0.76).fill(OAK_DARK);
      g.rect(w * 0.2, h * 0.18, 1, h * 0.62).fill({ color: LINEN, alpha: 0.25 });
      g.rect(w * 0.7, h * 0.52, 2, h * 0.08).fill(STEEL);
      g.rect(w * 0.28, h * 0.52, 2, h * 0.08).fill(STEEL);
      return;
    case 'SOFA':
      g.roundRect(2, h * 0.26, w - 4, h * 0.52, 6).fill(CLAY);
      g.roundRect(4, h * 0.36, w - 8, h * 0.3, 5).fill({ color: LINEN, alpha: 0.55 });
      g.rect(w * 0.08, h * 0.76, 4, h * 0.12).fill(OAK_DARK);
      g.rect(w * 0.86, h * 0.76, 4, h * 0.12).fill(OAK_DARK);
      return;
    case 'TABLE':
      g.ellipse(w / 2, h * 0.42, w * 0.38, h * 0.24).fill(OAK).stroke({ width: 1, color: OAK_DARK, alpha: 0.7 });
      g.ellipse(w / 2, h * 0.4, w * 0.3, h * 0.17).fill({ color: LINEN, alpha: 0.2 });
      g.rect(w * 0.47, h * 0.62, w * 0.06, h * 0.22).fill(OAK_DARK);
      return;
    case 'KITCHEN':
      g.roundRect(2, h * 0.3, w - 4, h * 0.42, 3).fill(OAK);
      g.roundRect(4, h * 0.34, w - 8, h * 0.18, 3).fill(CERAMIC);
      g.rect(w * 0.5, h * 0.36, 2, h * 0.14).fill(STEEL);
      g.rect(w * 0.3, h * 0.74, w * 0.4, h * 0.14).fill(OAK_DARK);
      return;
    case 'FRIDGE':
      g.roundRect(4, h * 0.06, w - 8, h * 0.88, 3).fill(CERAMIC);
      g.rect(4, h * 0.4, w - 8, 1.5).fill({ color: STEEL, alpha: 0.8 });
      g.rect(w * 0.78, h * 0.16, 2, h * 0.18).fill(STEEL);
      g.rect(w * 0.78, h * 0.46, 2, h * 0.3).fill(STEEL);
      return;
    case 'TOILET':
      g.roundRect(w * 0.24, h * 0.18, w * 0.52, h * 0.26, 3).fill(CERAMIC);
      g.ellipse(w * 0.5, h * 0.62, w * 0.26, h * 0.2).fill(CERAMIC).stroke({ width: 1, color: STEEL, alpha: 0.5 });
      g.ellipse(w * 0.5, h * 0.58, w * 0.16, h * 0.1).fill({ color: GLASS, alpha: 0.35 });
      return;
    case 'SINK':
      g.roundRect(w * 0.14, h * 0.06, w * 0.72, h * 0.5, 4).fill(OAK);
      g.roundRect(w * 0.2, h * 0.1, w * 0.6, h * 0.42, 3).fill({ color: GLASS, alpha: 0.5 });
      g.roundRect(w * 0.28, h * 0.64, w * 0.44, h * 0.22, 4).fill(CERAMIC);
      g.rect(w * 0.49, h * 0.56, 2, h * 0.1).fill(STEEL);
      return;
    case 'SMARTPHONE':
      g.roundRect(w * 0.3, h * 0.16, w * 0.4, h * 0.6, 3).fill(GLASS).stroke({ width: 1, color: STEEL });
      g.rect(w * 0.35, h * 0.24, w * 0.3, h * 0.34).fill(0x2a3f4a);
      return;
    default:
      g.roundRect(2, h * 0.2, w - 4, h * 0.6, 4).fill(OAK);
  }
}
