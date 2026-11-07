/** Spielerische Entscheidungen: Staerke aus den Karten, Aktion aus Staerke und Pot. */
import type { Prng } from '../rng/prng';
import type { Card } from '../rng/shoe';
import { bestHand, rankValue } from './poker-hand';
import type { PokerStyleId } from './poker-types';

export type PokerAction = 'CHECK' | 'CALL' | 'RAISE' | 'FOLD';

/** Profil eines Gasts: Range, Aggression und Anteil des Pots als Raise. */
interface PokerStyle {
  readonly id: PokerStyleId;
  readonly label: string;
  /** Aufschlag auf die Pot-Odds: positiv = enger, negativ = weiter. */
  readonly callMargin: number;
  /** Staerke, ab der ein Gast selbst erhoeht. */
  readonly raiseAt: number;
  readonly raiseChance: number;
  /** Raise als Potanteil; bestimmt die Einsatzgroesse. */
  readonly sizing: number;
}

export const POKER_STYLES: Readonly<Record<PokerStyleId, PokerStyle>> = {
  FELS: { id: 'FELS', label: 'Fels', callMargin: 0.14, raiseAt: 0.86, raiseChance: 35, sizing: 0.5 },
  BUCHHALTER: { id: 'BUCHHALTER', label: 'Buchhalter', callMargin: 0.07, raiseAt: 0.74, raiseChance: 55, sizing: 0.75 },
  HAI: { id: 'HAI', label: 'Hai', callMargin: -0.02, raiseAt: 0.68, raiseChance: 70, sizing: 1 },
};

const styleOf = (style: PokerStyleId = 'BUCHHALTER'): PokerStyle => POKER_STYLES[style];

interface PokerDecision {
  readonly action: PokerAction;
  /** Ziel der aktuellen Strasse; nur bei RAISE gesetzt. */
  readonly raiseTo?: number;
}

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
  style: PokerStyleId = 'BUCHHALTER',
): PokerAction {
  const profile = styleOf(style);
  const coin = (chance: number): boolean => (prng ? prng.nextInt(0, 99) < chance : true);
  if (toCall <= 0) {
    if (strength >= profile.raiseAt && coin(profile.raiseChance)) return 'RAISE';
    return 'CHECK';
  }
  const odds = toCall / Math.max(1, toCall + pot);
  if (strength < odds + profile.callMargin) return 'FOLD';
  if (strength >= profile.raiseAt && coin(profile.raiseChance)) return 'RAISE';
  return 'CALL';
}

/**
 * Gast-Entscheidung inklusive Raise-Ziel. Die Range steckt in Profil und
 * Handstaerke; das Sizing waechst mit dem Pot, nicht mit einem festen Ante.
 */
export function decideCpuAction(
  strength: number,
  toCall: number,
  pot: number,
  bet: number,
  streetCommitted: number,
  stack: number,
  unit: number,
  prng: Prng,
  style: PokerStyleId,
): PokerDecision {
  const action = decideAction(strength, toCall, pot, prng, style);
  if (action !== 'RAISE') return { action };
  const target = Math.min(
    streetCommitted + stack,
    bet + Math.max(unit, Math.round((pot + toCall) * styleOf(style).sizing)),
  );
  return { action, raiseTo: target };
}
