/**
 * Kampfhistorie aus dem Ereignisarchiv: dieselbe Ableitung fuer Gastduell,
 * Hinterhof und Kampfabend. Kein eigener Zaehler - der Eintrag ist der Beleg.
 */
import type { JournalEvent } from './journal';

/** Alle Kampfarten stehen im selben Archiv; nur das Praefix unterscheidet sie. */
const BACKYARD = 'Hinterhof gegen ';
const DUEL = 'Duell gegen ';
const FIGHT_EVENT = 'Kampfabend gegen ';

export interface FightRecord {
  readonly wins: number;
  readonly losses: number;
  readonly kos: number;
}

export interface BackyardHistoryEntry {
  readonly name: string;
  readonly wins: number;
  readonly losses: number;
  readonly kos: number;
  readonly lastDay: number;
  readonly lastResult: string;
}

interface ParsedFight {
  readonly name: string;
  readonly won: boolean;
  readonly ko: boolean;
  readonly day: number;
}

/** Das Subjekt eines Hinterhofkampfs; der Parser liest genau dieses Praefix. */
export function backyardSubject(name: string): string {
  return `${BACKYARD}${name}`;
}

/** Das Subjekt eines Kampfabends; dieselbe Bilanz zaehlt ihn ueber dieses Praefix. */
export function fightEventSubject(name: string): string {
  return `${FIGHT_EVENT}${name}`;
}

/** Ein Archiv-Eintrag zaehlt nur, wenn Subjekt und Effekt einen Kampf belegen. */
function parseFight(event: JournalEvent): ParsedFight | null {
  const prefix = event.subject.startsWith(BACKYARD)
    ? BACKYARD
    : event.subject.startsWith(DUEL)
      ? DUEL
      : event.subject.startsWith(FIGHT_EVENT) ? FIGHT_EVENT : null;
  if (prefix === null) return null;
  const won = event.effect.startsWith('Gewonnen');
  if (!won && !event.effect.startsWith('Verloren')) return null;
  return { name: event.subject.slice(prefix.length), won, ko: event.effect.includes('KO'), day: event.day };
}

/** Bilanz ueber alle Kaempfe: Gastduelle und Hinterhof zaehlen in derselben Wahrheit. */
export function fightRecordOf(events: readonly JournalEvent[]): FightRecord {
  let wins = 0;
  let losses = 0;
  let kos = 0;
  for (const event of events) {
    const fight = parseFight(event);
    if (!fight) continue;
    if (fight.won) wins += 1;
    else losses += 1;
    if (fight.ko) kos += 1;
  }
  return { wins, losses, kos };
}

/** Kampf-Eintrag im Archiv? Andere Sichten filtern damit, ohne das Praefix zu wiederholen. */
export function isFightEvent(event: JournalEvent): boolean {
  return parseFight(event) !== null;
}

/** Gegnerhistorie chronologisch; ein Gegner ohne Hinterhof-Eintrag taucht nicht auf. */
export function backyardHistoryOf(events: readonly JournalEvent[]): readonly BackyardHistoryEntry[] {
  const totals = new Map<string, { wins: number; losses: number; kos: number; lastDay: number; won: boolean }>();
  for (const event of events) {
    if (!event.subject.startsWith(BACKYARD)) continue;
    const fight = parseFight(event);
    if (!fight) continue;
    const entry = totals.get(fight.name) ?? { wins: 0, losses: 0, kos: 0, lastDay: 0, won: false };
    if (fight.won) entry.wins += 1;
    else entry.losses += 1;
    if (fight.ko) entry.kos += 1;
    entry.lastDay = fight.day;
    entry.won = fight.won;
    totals.set(fight.name, entry);
  }
  return [...totals.entries()]
    .sort(([left, a], [right, b]) => a.lastDay - b.lastDay || left.localeCompare(right))
    .map(([name, entry]) => ({
      name, wins: entry.wins, losses: entry.losses, kos: entry.kos,
      lastDay: entry.lastDay, lastResult: entry.won ? 'Gewonnen' : 'Verloren',
    }));
}
