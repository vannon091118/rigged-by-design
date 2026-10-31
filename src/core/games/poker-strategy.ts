/** Spielerische Entscheidungen: Staerke aus den Karten, Aktion aus Staerke und Pot. */
import type { Prng } from '../rng/prng';
import type { Card } from '../rng/shoe';
import { bestHand, rankValue } from './poker-hand';

export type PokerAction = 'CHECK' | 'CALL' | 'RAISE' | 'FOLD';

/** Basiskategorien je Haendekategorie, danach der Hoehenwert obendrauf. */
const CAT_STRENGTH = [0.16, 0.44, 0.64, 0.76, 0.86, 0.9, 0.95, 0.98, 1] as const;

function preflop(hole: readonly Card[]): number {
  const [a, b] = hole;
  const first = rankValue(a!.rank);
  const second = rankValue(b!.rank);
  if (first === second) return Math.min(0.97, 0.46 + (first / 14) * 0.42);
  let strength = (Math.max(first, second) / 14) * 0.44;
  if (a!.suit === b!.suit) strength += 0.07;
  if (Math.abs(first - second) <= 2) strength += 0.06;
  if (first === 14 || second === 14) strength += 0.03;
  return Math.min(0.9, strength);
}

/** 0..1: wie gut stehen die eigenen Karten gerade da. */
export function strengthOf(hole: readonly Card[], board: readonly Card[]): number {
  // Ohne zwei Karten gibt es keine Staerke: der Tisch vor dem Austeilen fragt trotzdem.
  if (hole.length < 2) return 0;
  if (board.length === 0) return preflop(hole);
  const rank = bestHand([...hole, ...board]);
  const base = CAT_STRENGTH[rank.cat] ?? 0.1;
  return Math.min(1, base + ((rank.kickers[0] ?? 0) / 14) * 0.1);
}

/**
 * Ohne PRNG entscheidet nur die Staerke (fuer die Automatik-Runde), mit PRNG
 * wuerfelt der Gast zwischen passiv und aktiv – gleiche Regeln, anderer Charakter.
 */
export function decideAction(
  strength: number,
  toCall: number,
  pot: number,
  prng?: Prng,
): PokerAction {
  const coin = (chance: number): boolean => (prng ? prng.nextInt(0, 99) < chance : true);
  if (toCall <= 0) {
    if (strength >= 0.74 && coin(55)) return 'RAISE';
    return 'CHECK';
  }
  const odds = toCall / Math.max(1, toCall + pot);
  if (strength < odds + 0.07) return 'FOLD';
  if (strength >= 0.82 && coin(60)) return 'RAISE';
  return 'CALL';
}
