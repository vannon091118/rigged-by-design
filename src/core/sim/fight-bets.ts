/**
 * Wettmarkt auf den Vorkampf: Quoten aus der vorhandenen Kampfmechanik.
 *
 * Gewettet wird ausschliesslich auf den Vorkampf zweier Roster-Kaempfer; der
 * eigene Kampf ist bewusst kein Markt. Abgabe und Abrechnung liegen in eigenen
 * Modulen, hier steht nur der Markt und seine Sicht.
 */
import { fromVC, toVCString, type VaCoinMicro } from '../economy/vacoin';
import { fighters, winProbability } from './brawl-combat';
import { openSlips, type FightBetPick, type PendingBet } from './fight-bet-slips';
import { fightNextRung, fightOpponentOf, fightRoster, type BackyardRung } from './fight-career';
import { backyardHistoryOf } from './fight-history';
import { newPlayerRpg, playerMaxHp, type PlayerRpgState } from './player-rpg';
import { clamp, round2 } from './num';
import type { WorldState } from './types';
import { venueView } from './venue-event';

interface FightBetMarket {
  readonly eventId: number;
  readonly pair: string;
  readonly a: string;
  readonly b: string;
  readonly odds: Readonly<Record<FightBetPick, number>>;
  readonly open: boolean;
  readonly reason: string;
}

export interface FightBetView {
  readonly open: boolean;
  readonly market: FightBetMarket | null;
  readonly pending: readonly PendingBet[];
  readonly reason: string;
}

const EVENT_KIND = 'TURNIER_ABEND';
export const MIN_STAKE = fromVC(0.1);
export const MAX_STAKE = fromVC(5);
const ODDS_FLOOR = 1.2;
const ODDS_CAP = 6;
/** Buchmacher-Marge: kein Markt wird zur Arbitrage. */
const BOOK_MARGIN = 0.92;

const roundOdds = (probability: number): number =>
  round2(clamp(BOOK_MARGIN / Math.max(0.05, probability), ODDS_FLOOR, ODDS_CAP));

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
  const [left, right] = fighters(rpgOf(a), fightOpponentOf(b), world.guests.length);
  const pA = winProbability(left, right);
  const pKo = clamp((left.attack + right.attack) / (left.maxHp + right.maxHp), 0.15, 0.85);
  const open = live.phase === 'ADMISSION';
  return {
    eventId: live.id,
    pair: `${a.name} gegen ${b.name}`,
    a: a.name,
    b: b.name,
    odds: { A: roundOdds(pA), B: roundOdds(1 - pA), KO: roundOdds(pKo), PUNKTE: roundOdds(1 - pKo) },
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
