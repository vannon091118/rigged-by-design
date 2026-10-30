/** Ereignisprotokoll: jeder wichtige Zustand mit Ursache, Wirkung und Akteur. */
import type { Ledger } from '../economy/ledger';
import { toVCString } from '../economy/vacoin';

export type JournalKind = 'MONEY' | 'GUEST' | 'STAFF' | 'STOCK' | 'RIVAL' | 'SYSTEM';

interface JournalRefs {
  readonly guestId?: number;
  readonly furnitureId?: number;
  readonly crateId?: number;
  readonly agentId?: number;
  readonly rivalId?: string;
}

export interface JournalEvent {
  readonly id: number;
  readonly tick: number;
  readonly day: number;
  readonly kind: JournalKind;
  readonly subject: string;
  readonly cause: string;
  readonly effect: string;
  readonly amount?: number;
  readonly refs?: JournalRefs;
}

interface JournalDraft {
  readonly kind: JournalKind;
  readonly subject: string;
  readonly cause: string;
  readonly effect: string;
  readonly amount?: number;
  readonly refs?: JournalRefs;
}

/** Der Puffer bleibt klein, damit ein langer Save nicht mit dem Ledger waechst. */
const JOURNAL_LIMIT = 240;

interface JournalHost {
  tick: number;
  day: number;
  journal: JournalEvent[];
  nextJournalId: number;
  lastEvent: string;
}

/** Haengt ein Event an. Nur Welt-Ereignisse setzen die sichtbare Ereigniszeile. */
export function recordJournal(world: JournalHost, draft: JournalDraft): JournalEvent {
  const event: JournalEvent = {
    id: world.nextJournalId++,
    tick: world.tick,
    day: world.day,
    ...draft,
  };
  world.journal.push(event);
  if (world.journal.length > JOURNAL_LIMIT) {
    world.journal.splice(0, world.journal.length - JOURNAL_LIMIT);
  }
  if (draft.kind !== 'MONEY') world.lastEvent = draft.effect;
  return event;
}

/** Konten eines Gastes auf eine Gast-ID abbilden, damit das Protokoll verlinken kann. */
function guestFromAccount(account: string): number | undefined {
  const match = /^(?:VISITOR|FIAT|PENDING)_(\d+)$/.exec(account);
  return match ? Number(match[1]) : undefined;
}

/**
 * Jede Ledger-Zeile wird genau einmal zu einem MONEY-Event.
 * Die Buchung bleibt die Geldwahrheit; das Protokoll kopiert nur ihre Fakten.
 */
export function settleMoneyJournal(world: JournalHost & { journaledSeq: number }, ledger: Ledger): number {
  const entries = ledger.entriesSince(world.journaledSeq);
  for (const entry of entries) {
    const guestId = guestFromAccount(entry.from) ?? guestFromAccount(entry.to);
    recordJournal(world, {
      kind: 'MONEY',
      subject: entry.reason,
      cause: `${entry.from} → ${entry.to}`,
      effect: `${toVCString(entry.amount)} gebucht (${entry.reason}).`,
      amount: entry.amount,
      refs: guestId === undefined ? undefined : { guestId },
    });
  }
  world.journaledSeq = ledger.entryCount;
  return entries.length;
}

/** Filter fuer die UI; die Reihenfolge bleibt chronologisch. */
export function journalEntries(
  events: readonly JournalEvent[],
  kind: JournalKind | 'ALL',
  limit = 80,
): readonly JournalEvent[] {
  const filtered = kind === 'ALL' ? events : events.filter((event) => event.kind === kind);
  return filtered.slice(-limit);
}

/** Zaehlt die Events je Art fuer die Diagnose. */
export function journalCounts(events: readonly JournalEvent[]): Readonly<Record<JournalKind, number>> {
  const counts: Record<JournalKind, number> = { MONEY: 0, GUEST: 0, STAFF: 0, STOCK: 0, RIVAL: 0, SYSTEM: 0 };
  for (const event of events) counts[event.kind] += 1;
  return counts;
}
