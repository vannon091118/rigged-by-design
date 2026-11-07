/**
 * Kennzahlen des Betriebs-Messlaufs: Was Gaeste erleben, je Spieltag gezaehlt.
 * Reine Auswertung des Weltzustands und der Ledger-Deltas.
 */
import { demandBreakdown, TICKS_PER_DAY } from '../demand';
import type { Ledger } from '../../economy/ledger';
import { HAUSKONTO } from '../money';
import type { EconomySummary } from '../economics';
import { companyStatus } from '../progression';
import { reputation } from '../spawn';
import type { Guest, TemplateId, WorldState } from '../types';

export interface Departure {
  readonly spins: number;
  readonly state: string;
  readonly intent: string;
  readonly mood: number;
  readonly patience: number;
}

export interface DayRow {
  day: number;
  tier: string;
  template: TemplateId;
  games: number;
  demand: number;
  arrivals: number;
  perMin: number;
  active: number;
  activeMax: number;
  outside: number;
  inside: number;
  waitDoor: number;
  waitDesk: number;
  waitDevice: number;
  staySec: number;
  rounds: number;
  util: Record<string, number>;
  abWait: number;
  abBroke: number;
  abAngry: number;
  neverPlayed: number;
  totalDepartures: number;
  returnRate: number;
  satisfaction: number;
  reputation: number;
  dirty: number;
  capital: number;
  economy: EconomySummary;
}

export interface Track {
  arrive: number;
  state: string;
  since: number;
  spins: number;
  intent: string;
  mood: number;
  patience: number;
}

interface Acc {
  arrivals: number; active: number; samples: number; activeMax: number;
  outside: number; inside: number;
  waitSum: Record<string, number>; waitN: Record<string, number>;
  stay: number; stayN: number; spins: number; spinsN: number;
  abWait: number; abBroke: number; abAngry: number; neverPlayed: number;
  util: Record<string, number>;
  departures: Departure[];
}

export const emptyAcc = (): Acc => ({
  arrivals: 0, active: 0, samples: 0, activeMax: 0, outside: 0, inside: 0,
  waitSum: {}, waitN: {}, stay: 0, stayN: 0, spins: 0, spinsN: 0,
  abWait: 0, abBroke: 0, abAngry: 0, neverPlayed: 0, util: {}, departures: [],
});

/** Ein Tick Beobachtung: Ankuenfte, Zustaende, Wartezeiten, Sitze und Abgaenge. */
export function observe(world: WorldState, acc: Acc, seen: Map<number, Track>): void {
  let outside = 0;
  let inside = 0;
  for (const guest of world.guests as Guest[]) {
    let track = seen.get(guest.id);
    if (!track) {
      track = { arrive: world.tick, state: guest.state, since: world.tick, spins: 0, intent: '', mood: guest.mood, patience: guest.patience };
      seen.set(guest.id, track);
      acc.arrivals += 1;
    }
    if (track.state !== guest.state) {
      acc.waitSum[track.state] = (acc.waitSum[track.state] ?? 0) + (world.tick - track.since);
      acc.waitN[track.state] = (acc.waitN[track.state] ?? 0) + 1;
      track.state = guest.state;
      track.since = world.tick;
    }
    track.spins = guest.spins;
    track.intent = guest.intent ?? '';
    track.mood = guest.mood;
    track.patience = guest.patience;
    if (guest.state === 'ENTER') outside += 1;
    if (guest.state === 'EXCHANGE' && guest.queueIndex > 0) inside += 1;
  }
  const present = new Set(world.guests.map((guest) => guest.id));
  for (const [id, track] of seen) {
    if (present.has(id)) continue;
    acc.stay += world.tick - track.arrive;
    acc.stayN += 1;
    acc.spins += track.spins;
    acc.spinsN += 1;
    if (track.spins === 0) acc.neverPlayed += 1;
    acc.departures.push({
      spins: track.spins, state: track.state, intent: track.intent, mood: track.mood, patience: track.patience,
    });
    // Die Absicht beim Gehen sagt, warum: Wartezeit, leere Chips oder Wut.
    if (track.intent.includes('Geduld')) acc.abWait += 1;
    else if (track.intent.includes('Mindesteinsatz')) acc.abBroke += 1;
    else if (track.state === 'ANGRY') acc.abAngry += 1;
    seen.delete(id);
  }
  for (const item of world.furniture) {
    if (!item.gameId) continue;
    acc.util[item.gameId] = (acc.util[item.gameId] ?? 0) + item.occupants.length / Math.max(1, item.seats);
  }
  acc.active += world.guests.length;
  acc.activeMax = Math.max(acc.activeMax, world.guests.length);
  acc.outside += outside;
  acc.inside += inside;
  acc.samples += 1;
}

const mean = (sum: number, count: number): number => (count > 0 ? sum / count : 0);

export function summarize(
  world: WorldState,
  acc: Acc,
  ledger: Ledger,
  economy: EconomySummary,
): DayRow {
  const util: Record<string, number> = {};
  for (const [id, value] of Object.entries(acc.util)) {
    const machines = world.furniture.filter((item) => item.gameId === id).length;
    util[id] = (100 * value) / Math.max(1, acc.samples * Math.max(1, machines));
  }
  const visitors = world.visitors;
  return {
    day: world.day,
    tier: companyStatus(world, ledger).tier,
    template: world.template,
    games: world.furniture.filter((item) => item.gameId).length,
    demand: demandBreakdown(world).perDay,
    arrivals: acc.arrivals,
    perMin: acc.arrivals / (TICKS_PER_DAY / 2 / 60),
    active: mean(acc.active, acc.samples),
    activeMax: acc.activeMax,
    outside: mean(acc.outside, acc.samples),
    inside: mean(acc.inside, acc.samples),
    waitDoor: mean(acc.waitSum.ENTER ?? 0, acc.waitN.ENTER ?? 0) / 2,
    waitDesk: mean(acc.waitSum.EXCHANGE ?? 0, acc.waitN.EXCHANGE ?? 0) / 2,
    waitDevice: mean(acc.waitSum.WAIT ?? 0, acc.waitN.WAIT ?? 0) / 2,
    staySec: mean(acc.stay, acc.stayN) / 2,
    rounds: mean(acc.spins, acc.spinsN),
    util,
    abWait: acc.abWait,
    abBroke: acc.abBroke,
    abAngry: acc.abAngry,
    neverPlayed: acc.neverPlayed,
    totalDepartures: acc.departures.length,
    returnRate: visitors.length > 0 ? (100 * visitors.filter((v) => v.visits >= 2).length) / visitors.length : 0,
    satisfaction: world.satisfaction,
    reputation: reputation(world),
    dirty: world.dirty.size,
    capital: Math.floor(ledger.getBalance(HAUSKONTO) / 10_000),
    economy,
  };
}
