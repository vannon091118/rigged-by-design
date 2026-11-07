/** Folgen eines verlorenen Duells: Ruf und Laune als befristete Strafe, kein Zufallspool. */
import type { WorldState } from './types';

export const ROBBERY_ACCOUNT = 'EXTERNAL_ROBBERY';
export const UNSAFE_REPUTATION_SPAWN_FACTOR = 0.55;
export const MOOD_SHOCK_NEWCOMER_MALUS = 20;

const MOOD_DROP = 30;
const PATIENCE_DROP = 20;
const MOOD_SHOCK_DAYS = 2;

/** Gleiche Strafe erneuert ihren Timer, statt sich zu stapeln. */
function pushPenalty(world: WorldState, kind: 'UNSAFE_REPUTATION' | 'MOOD_SHOCK', daysLeft: number): void {
  world.activePenalties = world.activePenalties
    .filter((penalty) => penalty.kind !== kind)
    .concat({ kind, daysLeft });
}

/** Ein öffentlich verlorener Kampf macht den Laden für Neuankömmlinge unsicher. */
export function applyUnsafeReputation(world: WorldState, daysLeft: number): void {
  pushPenalty(world, 'UNSAFE_REPUTATION', Math.max(2, daysLeft));
  world.lastEvent = 'Es spricht sich herum: Dein Laden ist unsicher.';
}

/** Die Menge sieht die Niederlage: Laune und Geduld aller Gäste kippen. */
export function applyMoodShock(world: WorldState): void {
  for (const guest of world.guests) {
    guest.mood = Math.max(0, guest.mood - MOOD_DROP);
    guest.patience = Math.max(0, guest.patience - PATIENCE_DROP);
  }
  pushPenalty(world, 'MOOD_SHOCK', MOOD_SHOCK_DAYS);
  world.lastEvent = 'Schockwelle im Casino: Alle Gäste sind verstört.';
}

/** Zählt die Straf-Tage bei jedem Tageswechsel herunter und entfernt abgelaufene Strafen. */
export function tickPenaltyDays(world: WorldState): void {
  for (const penalty of world.activePenalties) penalty.daysLeft -= 1;
  world.activePenalties = world.activePenalties.filter((penalty) => penalty.daysLeft > 0);
}
