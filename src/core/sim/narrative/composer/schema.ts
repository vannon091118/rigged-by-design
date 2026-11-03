/** NAR-11: Laufzeitpruefung fuer generierte Fragmente und Composer-Anfragen. */
import { isActorRef } from '../relationships';
import type { NarrativeCommand } from '../commands/types';
import type { ContentSlotKind } from '../events/template-types';
import type { ComposeRequest, NarrativeFragment } from './types';

const ID = /^[A-Z][A-Z0-9_]{0,63}$/;
const SLUG = /^[a-z0-9][a-z0-9-]*$/;
const FLAG = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const DIMENSIONS = ['trust', 'sympathy', 'conflict', 'influence'] as const;
const SLOT_KINDS: readonly ContentSlotKind[] = ['TITLE', 'BODY', 'CHOICE_LABEL', 'OUTCOME'];
const LIMITS = { slots: 12, contexts: 8, flags: 12, personas: 4, directives: 8, text: 800 } as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isText = (value: unknown, max: number): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
const isInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const isStringList = (value: unknown, max: number): value is readonly string[] =>
  Array.isArray(value) && value.length <= max && value.every((entry) => isText(entry, 64));

function isCommand(raw: unknown): raw is NarrativeCommand {
  if (!isRecord(raw)) return false;
  if (raw.id === 'SET_FLAG') return isText(raw.flag, 32) && FLAG.test(raw.flag)
    && isInt(raw.delta, -1000, 1000) && raw.delta !== 0;
  if (raw.id === 'FREEZE_TICK') return isInt(raw.ticks, 1, 200);
  if (raw.id !== 'ADJUST_RELATIONSHIP') return false;
  return typeof raw.from === 'string' && typeof raw.to === 'string'
    && isActorRef(raw.from) && isActorRef(raw.to) && raw.from !== raw.to
    && typeof raw.dimension === 'string' && (DIMENSIONS as readonly string[]).includes(raw.dimension)
    && isInt(raw.delta, -10, 10) && raw.delta !== 0;
}

export function isNarrativeCommand(raw: unknown): raw is NarrativeCommand {
  return isCommand(raw);
}

/** Generierte Fragmente werden auch zur Laufzeit nicht blind vertraut. */
export function isNarrativeFragment(raw: unknown): raw is NarrativeFragment {
  if (!isRecord(raw) || !isText(raw.contributionId, 80) || !SLUG.test(raw.contributionId)
    || !isText(raw.turnId, 96) || !isText(raw.agentId, 32) || !isText(raw.role, 32)
    || !isText(raw.locale, 8) || !isText(raw.slot, 32) || !isText(raw.function, 32)
    || !isText(raw.tone, 32) || !isText(raw.mood, 32) || !isText(raw.relationship, 32)
    || !isText(raw.text, LIMITS.text) || !isText(raw.source, 240)) return false;
  if (!isStringList(raw.contexts, LIMITS.contexts) || raw.contexts.length === 0
    || !isStringList(raw.personaRefs, LIMITS.personas) || !isStringList(raw.flags, LIMITS.flags)) return false;
  if (!Array.isArray(raw.directives) || raw.directives.length > LIMITS.directives
    || !raw.directives.every(isCommand)) return false;
  return true;
}

export function isComposeRequest(raw: unknown): raw is ComposeRequest {
  if (!isRecord(raw) || !isText(raw.locale, 8) || !Array.isArray(raw.slots)
    || raw.slots.length === 0 || raw.slots.length > LIMITS.slots) return false;
  const ids = new Set<string>();
  for (const slot of raw.slots) {
    if (!isRecord(slot) || !isText(slot.id, 64) || !ID.test(slot.id)
      || typeof slot.kind !== 'string' || !SLOT_KINDS.includes(slot.kind as ContentSlotKind)) return false;
    if (ids.has(slot.id)) return false;
    ids.add(slot.id);
  }
  if (raw.contexts !== undefined && !isStringList(raw.contexts, LIMITS.contexts)) return false;
  if (raw.requiredFlags !== undefined && !isStringList(raw.requiredFlags, LIMITS.flags)) return false;
  if (raw.availablePersonas !== undefined && !isStringList(raw.availablePersonas, LIMITS.personas)) return false;
  for (const key of ['tone', 'mood', 'relationship'] as const) {
    if (raw[key] !== undefined && !isText(raw[key], 32)) return false;
  }
  return true;
}
