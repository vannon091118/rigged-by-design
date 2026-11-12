/**
 * @module city-life-memory — Erinnerungen aus Begegnungen
 *
 * Erinnerungen sind das Erfahrungsgedaechtnis der NPCs: eine Begegnung erzeugt
 * eine soziale Erinnerung, redselige NPCs geben Gehoertes als Geruecht weiter.
 * Beide landen im persistenten Resident und koennen spaetere Entscheidungen
 * ueber den Memory-Score kippen.
 */
import { traitEffect } from './city-traits';
import type { CityResidentState, NpcMemory } from './city-life-types';
import type { TraitState } from './city-types';

export function addMemory(
  memories: readonly NpcMemory[], memory: NpcMemory | null,
): readonly NpcMemory[] {
  if (!memory) return memories;
  return [...memories, memory].slice(-8);
}

export function socialMemory(
  targetId: string, tick: number, id: number, relations: Readonly<Record<string, number>>,
): NpcMemory {
  return {
    id, tick, kind: 'SOCIAL', aboutNpcId: targetId,
    sentiment: (relations[targetId] ?? 0) >= 0 ? 1 : -1, confidence: 1,
  };
}

export function rumorMemory(
  resident: CityResidentState, target: CityResidentState, tick: number, id: number,
  traits: readonly TraitState[],
): NpcMemory | null {
  const share = traitEffect(traits, 'share');
  if (share <= 0) return null;
  const heard = [...target.memories].reverse().find((entry) =>
    (entry.kind === 'SOCIAL' || entry.kind === 'RUMOR')
    && entry.aboutNpcId !== null
    && entry.aboutNpcId !== resident.npcId
    && entry.aboutNpcId !== target.npcId);
  if (!heard?.aboutNpcId) return null;
  return {
    id, tick, kind: 'RUMOR', aboutNpcId: heard.aboutNpcId,
    sentiment: heard.sentiment, confidence: Math.min(0.8, heard.confidence * 0.7),
  };
}
