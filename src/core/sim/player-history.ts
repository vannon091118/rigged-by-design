/**
 * Spielhistorie: die persoenlichen Etappen aus dem Ereignisarchiv.
 *
 * Keine zweite Chronik - Kaempfe stehen schon als Duell/Hinterhof im Archiv, der
 * Buden-Kauf als BAR-Eintrag und die Immobilie als IMMOBILIE-Eintrag. Diese Sicht
 * filtert, ordnet und deckelt nur, damit das Charakterfenster die letzten eigenen
 * Etappen zeigen kann.
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
const PERSONAL_LABELS: Readonly<Record<string, string>> = {
  BAR: 'Erste Bude gekauft',
  IMMOBILIE: 'Erste Immobilie gekauft',
};

function isPersonal(event: JournalEvent): boolean {
  return isFightEvent(event) || PERSONAL_LABELS[event.subject] !== undefined;
}

function labelOf(event: JournalEvent): string {
  return PERSONAL_LABELS[event.subject] ?? event.subject;
}

/** Das Archiv ist chronologisch; die letzten `limit` eigenen Etappen bleiben in Reihenfolge. */
export function playerHistoryOf(
  events: readonly JournalEvent[],
  limit: number = PLAYER_HISTORY_LIMIT,
): readonly PlayerHistoryEntry[] {
  const personal = events.filter(isPersonal);
  return personal
    .slice(-Math.max(0, limit))
    .map((event) => ({ id: event.id, day: event.day, label: labelOf(event), detail: event.effect }));
}
