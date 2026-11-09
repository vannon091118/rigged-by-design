/** Was ein Gast gerade fühlt: eine Grafik statt eines Satzes. */
import type { Guest } from './types';

export type GuestEmotion = 'SLOT' | 'JACKPOT' | 'ADDICTED' | 'DRINK' | 'TOILET' | 'DIRTY' | 'ANGRY' | 'CASH' | 'WAIT' | 'NONE';

/** Ab dieser Sucht zeigt die Blase ADDICTED — und ab dort kostet sie Ruf (P-5). */
export const ADDICTED_THRESHOLD = 60;

interface EmotionMeta {
  readonly label: string;
  readonly glyph: string;
  readonly tone: string;
}

export const EMOTION_META: Readonly<Record<GuestEmotion, EmotionMeta>> = {
  SLOT: { label: 'will zocken', glyph: '🎰', tone: 'slot' },
  JACKPOT: { label: 'Jackpot-Rausch', glyph: '💎', tone: 'jackpot' },
  ADDICTED: { label: 'süchtig', glyph: '❤️‍🔥', tone: 'addicted' },
  DRINK: { label: 'Durst', glyph: '🍺', tone: 'drink' },
  TOILET: { label: 'muss aufs Klo', glyph: '🚽', tone: 'toilet' },
  DIRTY: { label: 'angewidert', glyph: '🤢', tone: 'dirty' },
  ANGRY: { label: 'wütend', glyph: '💢', tone: 'angry' },
  CASH: { label: 'will zur Kasse', glyph: '💵', tone: 'cash' },
  WAIT: { label: 'wartet', glyph: '⏳', tone: 'wait' },
  NONE: { label: 'entspannt', glyph: '', tone: 'none' },
};

/** Dreck in der Nähe färbt die Stimmung; direkte Mitgliedschaft statt Suche im Array. */
/** Eine Kachel als Index im flachen Dreck-Set; Gegenstueck zu dirtyNear. */
export const dirtyTileIndex = (size: number, x: number, y: number): number => y * size + x;

export function dirtyNear(tiles: ReadonlySet<number>, size: number, x: number, y: number, radius = 2): boolean {
  for (let dy = -radius; dy <= radius; dy += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      const tx = x + dx;
      const ty = y + dy;
      if (tx < 0 || ty < 0 || tx >= size || ty >= size) continue;
      if (tiles.has(ty * size + tx)) return true;
    }
  }
  return false;
}

export function emotionOf(guest: Guest, spottedDirt = false): GuestEmotion {
  if (guest.state === 'ANGRY' || guest.anger > 50) return 'ANGRY';
  if (guest.state === 'ENTER' || guest.state === 'EXCHANGE' || guest.state === 'CASHOUT') return 'CASH';
  if (guest.state === 'TOILET' || guest.need === 'toilet') return 'TOILET';
  if (guest.state === 'DRINK' || guest.need === 'drink') return 'DRINK';
  if (spottedDirt && guest.mood < 78) return 'DIRTY';
  if (guest.state === 'LEAVE') return 'NONE';
  const result = guest.lastResult.toUpperCase();
  if (guest.state === 'PLAY' && (result.includes('JACKPOT') || result.includes('DIAMOND'))) return 'JACKPOT';
  if (guest.addiction >= ADDICTED_THRESHOLD) return 'ADDICTED';
  if (guest.state === 'PLAY' || guest.state === 'CHOOSE') return 'SLOT';
  if (guest.state === 'WAIT') return 'WAIT';
  return 'NONE';
}
