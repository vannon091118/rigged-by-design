/**
 * @module fight-bet-register-legacy — Lesen und Heilen gespeicherter Scheine
 *
 * Zwei Aufgaben: das Register aus einem Save sanitisieren (nur bekannte Picks,
 * positive Einsaetze, plausible Quoten) und ein Save ohne Register einmalig aus
 * dem Journal-Archiv adoptieren. Das ist Migrationscode, kein Spielpfad: Er
 * laeuft beim Laden, nie im Tick.
 */
import type { VaCoinMicro } from '../economy/vacoin';
import type { JournalEvent } from './journal';
import {
  emptyFightBets, SETTLE_SUBJECT, SLIP_SUBJECT, UNDERCARD_SUBJECT,
  type FightBetPick, type FightBetSlip, type FightBetState, type UndercardResult,
} from './fight-bet-register';

const PICKS: readonly FightBetPick[] = ['A', 'B', 'KO', 'PUNKTE'];

/** Ein Feld aus der stabilen `key:value|key:value`-Form eines Journal-Grunds. */
function field(cause: unknown, key: string): string | null {
  if (typeof cause !== 'string') return null;
  for (const part of cause.split('|')) {
    const [name, ...rest] = part.split(':');
    if (name === key) return rest.join(':');
  }
  return null;
}

const whole = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;

/** Eine Quote als Basispunkte; unlesbare Werte fallen auf den Einsatz zurueck. */
function oddsBpOf(value: unknown): number {
  const parsed = whole(value, 100);
  return parsed >= 100 && parsed <= 10000 ? parsed : 100;
}

const pickOf = (value: unknown): FightBetPick | null =>
  PICKS.includes(value as FightBetPick) ? (value as FightBetPick) : null;

function adoptSlip(raw: unknown): FightBetSlip[] {
  if (typeof raw !== 'object' || raw === null) return [];
  const record = raw as Record<string, unknown>;
  const pick = pickOf(record.pick);
  const stake = whole(record.stake, 0);
  if (!pick || stake <= 0) return [];
  return [{
    id: whole(record.id, 0),
    eventId: whole(record.eventId, 0),
    pick,
    stake: stake as VaCoinMicro,
    oddsBp: oddsBpOf(record.oddsBp),
  }];
}

function adoptUndercard(raw: unknown): UndercardResult | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as Record<string, unknown>;
  const winner = record.winner === 'A' || record.winner === 'B' ? record.winner : null;
  const method = record.method === 'KO' || record.method === 'PUNKTE' ? record.method : null;
  if (!winner || !method) return null;
  return {
    eventId: whole(record.eventId, 0),
    a: String(record.a ?? ''),
    b: String(record.b ?? ''),
    winner,
    method,
    rounds: whole(record.rounds, 0),
  };
}

function undercardOfCause(entry: JournalEvent): UndercardResult | null {
  const winner = field(entry.cause, 'sieger');
  const method = field(entry.cause, 'methode');
  if (winner !== 'A' && winner !== 'B') return null;
  if (method !== 'KO' && method !== 'PUNKTE') return null;
  return {
    eventId: Number(field(entry.cause, 'event')),
    a: field(entry.cause, 'paar') ?? '',
    b: '',
    winner,
    method,
    rounds: Number(field(entry.cause, 'runden')),
  };
}

/** Ein gespeichertes Register heilen: unbekannte Felder fallen weg. */
export function normalizeStoredFightBets(raw: Record<string, unknown>): FightBetState {
  const state = emptyFightBets();
  state.open = Array.isArray(raw.open) ? raw.open.flatMap(adoptSlip) : [];
  state.undercard = adoptUndercard(raw.undercard);
  const used = state.open.reduce((max, slip) => Math.max(max, slip.id + 1), 1);
  state.nextSlipId = Math.max(whole(raw.nextSlipId, 1), used);
  return state;
}

/**
 * Ein Save ohne Register (vor dieser Lane) traegt seine offenen Scheine und den
 * letzten Vorkampf nur im Archiv. Die Quote kommt aus dem Anzeigetext; ein
 * unlesbarer Text erstattet spaeter den Einsatz, statt ihn still zu nullen.
 */
export function adoptFightBetsFromArchive(archive: readonly JournalEvent[]): FightBetState {
  const state = emptyFightBets();
  const settled = new Set(
    archive
      .filter((entry) => entry.subject === SETTLE_SUBJECT)
      .map((entry) => field(entry.cause, 'schein'))
      .filter((slip): slip is string => slip !== null),
  );
  for (const entry of archive) {
    if (entry.subject === UNDERCARD_SUBJECT) {
      const undercard = undercardOfCause(entry);
      if (undercard) state.undercard = undercard;
      continue;
    }
    if (entry.subject !== SLIP_SUBJECT) continue;
    const id = Number(field(entry.cause, 'schein'));
    const pick = pickOf(field(entry.cause, 'pick'));
    const stake = Number(field(entry.cause, 'stake'));
    if (!Number.isFinite(id) || !pick || !Number.isFinite(stake) || stake <= 0) continue;
    if (settled.has(String(id))) continue;
    const quote = Number(field(entry.cause, 'quote'));
    state.open.push({
      id,
      eventId: Number(field(entry.cause, 'event')),
      pick,
      stake: stake as VaCoinMicro,
      oddsBp: oddsBpOf(Number.isFinite(quote) ? Math.round(quote * 100) : 100),
    });
  }
  state.nextSlipId = state.open.reduce((max, slip) => Math.max(max, slip.id + 1), 1);
  return state;
}
