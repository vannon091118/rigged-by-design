/**
 * Schein- und Abrechnungsbelege sind Journal-Eintraege: kein neues Save-Feld,
 * kein zweites Register. Die Felder stehen in der stabilen
 * `key:value|key:value`-Form, die dieses Modul liest.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import type { WorldState } from './types';

export type FightBetPick = 'A' | 'B' | 'KO' | 'PUNKTE';

export const SLIP_SUBJECT = 'WETTSCHEIN';
export const SETTLE_SUBJECT = 'WETTABRECHNUNG';
export const UNDERCARD_SUBJECT = 'VORNKAMPF';

export interface PendingBet {
  readonly slip: number;
  readonly eventId: number;
  readonly pick: FightBetPick;
  readonly stake: VaCoinMicro;
  readonly odds: number;
}

export interface UndercardResult {
  readonly eventId: number;
  readonly a: string;
  readonly b: string;
  readonly winner: 'A' | 'B';
  readonly method: 'KO' | 'PUNKTE';
  readonly rounds: number;
}

/** Ein Feld aus der stabilen `key:value|key:value`-Form eines Journal-Grunds. */
function field(cause: string, key: string): string | null {
  for (const part of cause.split('|')) {
    const [name, ...rest] = part.split(':');
    if (name === key) return rest.join(':');
  }
  return null;
}

/** Offene Scheine: Abgabe ohne Abrechnung mit derselben Nummer. */
export function openSlips(world: WorldState): PendingBet[] {
  const settled = new Set(
    world.archive
      .filter((entry) => entry.subject === SETTLE_SUBJECT)
      .map((entry) => field(entry.cause, 'schein'))
      .filter((slip): slip is string => slip !== null),
  );
  return world.archive
    .filter((entry) => entry.subject === SLIP_SUBJECT)
    .map((entry) => ({
      slip: Number(field(entry.cause, 'schein')),
      eventId: Number(field(entry.cause, 'event')),
      pick: String(field(entry.cause, 'pick')) as FightBetPick,
      stake: Number(field(entry.cause, 'stake')) as VaCoinMicro,
      odds: Number(field(entry.cause, 'quote')),
    }))
    .filter((bet) => Number.isFinite(bet.slip) && !settled.has(String(bet.slip)));
}

/** Der Vorkampf-Beleg eines Abends, sofern der Kampf schon entschieden ist. */
export function undercardOf(world: WorldState, eventId: number): UndercardResult | null {
  const entry = world.archive.find(
    (event) => event.subject === UNDERCARD_SUBJECT && field(event.cause, 'event') === String(eventId),
  );
  if (!entry) return null;
  const winner = field(entry.cause, 'sieger');
  const method = field(entry.cause, 'methode');
  if (winner !== 'A' && winner !== 'B') return null;
  if (method !== 'KO' && method !== 'PUNKTE') return null;
  return {
    eventId,
    a: field(entry.cause, 'paar') ?? '',
    b: '',
    winner,
    method,
    rounds: Number(field(entry.cause, 'runden')),
  };
}
