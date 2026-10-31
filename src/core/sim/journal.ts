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

/** Der Puffer bleibt klein, damit die Anzeige nicht mit dem Ledger waechst. */
const JOURNAL_LIMIT = 240;
/**
 * Das Archiv ist der dauerhafte Teil: es faengt jedes Ereignis auf, ueberlebt den Puffer
 * und steht im Save. Die Grenze ist nur eine Speichergrenze, keine Sichtbarkeitsgrenze.
 */
const ARCHIVE_LIMIT = 2000;

interface JournalHost {
  tick: number;
  day: number;
  journal: JournalEvent[];
  /** Dauerhaftes Archiv; aeltere Staende kennen das Feld nicht und bekommen es beim Laden. */
  archive: JournalEvent[];
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
  world.archive.push(event);
  if (world.archive.length > ARCHIVE_LIMIT) {
    world.archive.splice(0, world.archive.length - ARCHIVE_LIMIT);
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

interface ArchiveFilter {
  readonly kind?: JournalKind | 'ALL';
  readonly day?: number;
  readonly guestId?: number;
  readonly text?: string;
  readonly minAmount?: number;
}

/**
 * Archiv-Abfrage fuer die UI: filtert nach Art, Tag, Gast, Betrag und Freitext und
 * liefert das Neueste zuerst. Reihenfolge und Auswahl sind reine Funktionen des Archivs.
 */
export function archiveQuery(
  events: readonly JournalEvent[],
  filter: ArchiveFilter = {},
  limit = 120,
): readonly JournalEvent[] {
  const needle = filter.text?.trim().toLowerCase() ?? '';
  const matched = events.filter((event) => {
    if (filter.kind && filter.kind !== 'ALL' && event.kind !== filter.kind) return false;
    if (filter.day !== undefined && event.day !== filter.day) return false;
    if (filter.guestId !== undefined && event.refs?.guestId !== filter.guestId) return false;
    if (filter.minAmount !== undefined && Math.abs(event.amount ?? 0) < filter.minAmount) return false;
    if (!needle) return true;
    return `${event.subject} ${event.cause} ${event.effect}`.toLowerCase().includes(needle);
  });
  return matched.slice(-limit).reverse();
}

/** Zaehlt die Events je Art fuer die Diagnose. */
export function journalCounts(events: readonly JournalEvent[]): Readonly<Record<JournalKind, number>> {
  const counts: Record<JournalKind, number> = { MONEY: 0, GUEST: 0, STAFF: 0, STOCK: 0, RIVAL: 0, SYSTEM: 0 };
  for (const event of events) counts[event.kind] += 1;
  return counts;
}
