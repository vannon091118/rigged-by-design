/**
 * Spielhistorie: die persoenlichen Etappen aus dem Ereignisarchiv.
 *
 * Keine zweite Chronik - Kaempfe stehen schon als Duell/Hinterhof im Archiv, der
 * Buden-Kauf als BAR-Eintrag. Diese Sicht filtert, ordnet und deckelt nur, damit
 * das Charakterfenster die letzten eigenen Etappen zeigen kann.
 */
import { isFightEvent } from './fight-history';
import type { JournalEvent } from './journal';

export interface PlayerHistoryEntry {
  readonly id: number;
  readonly day: number;
  readonly label: string;
  readonly detail: string;
}

/** Wie viele Etappen das Charakterfenster zeigt; der Rest bleibt im Protokoll. */
const PLAYER_HISTORY_LIMIT = 6;
const BAR_SUBJECT = 'BAR';
const BAR_LABEL = 'Erste Bude gekauft';

function labelOf(event: JournalEvent): string {
  return event.subject === BAR_SUBJECT ? BAR_LABEL : event.subject;
}

/** Das Archiv ist chronologisch; die letzten `limit` eigenen Etappen bleiben in Reihenfolge. */
export function playerHistoryOf(
  events: readonly JournalEvent[],
  limit: number = PLAYER_HISTORY_LIMIT,
): readonly PlayerHistoryEntry[] {
  const personal = events.filter((event) => isFightEvent(event) || event.subject === BAR_SUBJECT);
  return personal
    .slice(-Math.max(0, limit))
    .map((event) => ({ id: event.id, day: event.day, label: labelOf(event), detail: event.effect }));
}
