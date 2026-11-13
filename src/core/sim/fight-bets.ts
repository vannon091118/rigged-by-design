/**
 * Wettmarkt auf den Vorkampf: Quoten aus der vorhandenen Kampfmechanik.
 *
 * Gewettet wird ausschliesslich auf den Vorkampf zweier Roster-Kaempfer; der
 * eigene Kampf ist bewusst kein Markt. Abgabe und Abrechnung liegen in eigenen
 * Modulen, hier steht nur der Markt und seine Sicht.
 *
 * Der Markt liest denselben Publikumswert wie Kampfabend, Duell und Hinterhof
 * (`crowdBonus`, -5..+5 Prozentpunkte). Die Zuschauerzahl ist keine Trefferquote.
 */
import { fromVC, toVCString, type VaCoinMicro } from '../economy/vacoin';
import { crowdBonus, fighters, winProbability, type Fighter } from './brawl-combat';
import { openSlips, type FightBetPick, type PendingBet } from './fight-bet-slips';
import { fightNextRung, fightOpponentOf, fightRoster, type BackyardRung } from './fight-career';
import { backyardHistoryOf } from './fight-history';
import { newPlayerRpg, playerMaxHp, type PlayerRpgState } from './player-rpg';
import { clamp } from './num';
import type { WorldState } from './types';
import { venueView } from './venue-event';

interface FightBetMarket {
  readonly eventId: number;
  readonly pair: string;
  readonly a: string;
  readonly b: string;
  /** Nur Paesse mit Kurs; fast sichere Ausgaenge sind ausgesetzt. */
  readonly odds: Readonly<Partial<Record<FightBetPick, number>>>;
  /** Gewinnwahrscheinlichkeit der Seite A in Prozent, aus derselben Rechnung. */
  readonly chance: number;
  readonly open: boolean;
  readonly reason: string;
}

export interface FightBetView {
  readonly open: boolean;
  readonly market: FightBetMarket | null;
  readonly pending: readonly PendingBet[];
  readonly reason: string;
}

interface FightQuotes {
  readonly pA: number;
  readonly pKo: number;
  readonly odds: Readonly<Partial<Record<FightBetPick, number>>>;
}

const EVENT_KIND = 'TURNIER_ABEND';
export const MIN_STAKE = fromVC(0.1);
export const MAX_STAKE = fromVC(5);
const ODDS_MIN = 1;
const ODDS_CAP = 6;
/** Buchmacher-Marge: kein Markt wird zur Arbitrage. */
export const BOOK_MARGIN = 0.92;

/** Abrunden auf zwei Stellen: die Auszahlung bleibt unter der fairen Quote. */
const floor2 = (value: number): number => Math.floor(value * 100) / 100;

/**
 * Quote zu einer bekannten Wahrscheinlichkeit: `Marge / p`, abgerundet und nach
 * oben gedeckelt. Keine erfundene Untergrenze: Waere die Auszahlung kleiner als
 * der Einsatz, gibt es keinen Kurs statt einer Wette mit Minusrendite.
 */
export function oddsFor(probability: number): number | null {
  const fair = BOOK_MARGIN / clamp(probability, 0.01, 1);
  if (fair < 1) return null;
  return clamp(floor2(fair), ODDS_MIN, ODDS_CAP);
}

/** KO-Wahrscheinlichkeit aus Angriff und Lebenspunkten beider Seiten. */
export function koProbability(left: Fighter, right: Fighter): number {
  return clamp((left.attack + right.attack) / (left.maxHp + right.maxHp), 0.15, 0.85);
}

/** Quoten und Wahrscheinlichkeiten eines Kampfes, aus einer Rechnung. */
export function marketQuotes(a: BackyardRung, b: BackyardRung, crowd: number): FightQuotes {
  const [left, right] = fighters(rpgOf(a), fightOpponentOf(b), crowd);
  const pA = winProbability(left, right);
  const pKo = koProbability(left, right);
  const odds: Partial<Record<FightBetPick, number>> = {};
  const prices: readonly (readonly [FightBetPick, number])[] = [
    ['A', pA], ['B', 1 - pA], ['KO', pKo], ['PUNKTE', 1 - pKo],
  ];
  for (const [pick, probability] of prices) {
    const price = oddsFor(probability);
    if (price !== null) odds[pick] = price;
  }
  return { pA, pKo, odds };
}

/** Dieselbe Koerper-Abbildung wie im Hinterhof: Kraft wird zur Brawl-Stufe. */
export function rpgOf(rung: BackyardRung): PlayerRpgState {
  const base = { ...newPlayerRpg(), brawlLevel: Math.max(0, rung.strength - 1) };
  return { ...base, hp: playerMaxHp(base) };
}

export function liveTournament(
  world: WorldState,
): { readonly id: number; readonly phase: string } | null {
  const current = venueView(world).current;
  if (!current || current.kind !== EVENT_KIND) return null;
  return { id: current.id, phase: current.phase };
}

/** Der Vorkampf ist der erste Roster-Kampf, der nicht der eigene ist. */
export function undercardPair(world: WorldState): readonly [BackyardRung, BackyardRung] | null {
  const main = fightNextRung(backyardHistoryOf(world.archive));
  const rest = fightRoster().filter((rung) => rung.name !== main.name);
  return rest.length >= 2 ? [rest[0]!, rest[1]!] : null;
}

function marketOf(world: WorldState): FightBetMarket | null {
  const live = liveTournament(world);
  const pair = undercardPair(world);
  if (!live || !pair) return null;
  const [a, b] = pair;
  const quotes = marketQuotes(a, b, crowdBonus(world.guests));
  const open = live.phase === 'ADMISSION';
  return {
    eventId: live.id,
    pair: `${a.name} gegen ${b.name}`,
    a: a.name,
    b: b.name,
    odds: quotes.odds,
    chance: Math.round(quotes.pA * 100),
    open,
    reason: open
      ? `Vorkampf ${a.name} gegen ${b.name} · Markt bis zum Kampfbeginn.`
      : 'Markt geschlossen: Der Abend laeuft bereits.',
  };
}

/** Die eine Sicht: Markt, fixierte Quoten und offene Scheine. */
export function fightBetView(world: WorldState, wallet: VaCoinMicro): FightBetView {
  const market = marketOf(world);
  const pending = openSlips(world);
  if (!market) {
    return { open: false, market: null, pending, reason: 'Kein Turnierabend mit Vorkampf im Einlass.' };
  }
  if (!market.open) return { open: false, market, pending, reason: market.reason };
  if (wallet < MIN_STAKE) {
    return { open: false, market, pending, reason: `Einsatz fehlt: mindestens ${toVCString(MIN_STAKE)}.` };
  }
  return {
    open: true,
    market,
    pending,
    reason: `${market.reason} Einsatz ${toVCString(MIN_STAKE)} bis ${toVCString(MAX_STAKE)}.`,
  };
}
