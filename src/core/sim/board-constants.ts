/** Feste Brett- und Teppichwerte; aus types.ts ausgelagert, damit die Typdatei unter dem LOC-Limit bleibt. */
import type { CarpetId } from './types';

export const TILE = 26;
export const REGION = 30;
export const CARPETS: Readonly<Record<CarpetId, { name: string; color: number }>> = {
  VIOLET: { name: 'Violett', color: 0x1b0f2a },
  CRIMSON: { name: 'Karmin', color: 0x2a0d17 },
  JADE: { name: 'Jade', color: 0x0d241f },
  GOLD: { name: 'Gold', color: 0x2a2210 },
};
