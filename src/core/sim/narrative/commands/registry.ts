/** Allowlist der Commands: ID, Familie, Parameter und Handler-Vertrag. */
import { isActorRef } from '../relationships';
import type { ChoiceActor, EventChoice } from '../events/template-types';
import type { RelationshipDimension } from '../trigger-types';
import type {
  CommandFamily, CommandId, DirectiveScalar, NarrativeCommand, ParsedDirective,
} from './types';

const FLAG = /^[A-Za-z][A-Za-z0-9_]{0,31}$/;
const DIALOG = /^[A-Z][A-Z0-9_]{0,63}$/;
const DIMENSIONS: readonly RelationshipDimension[] = ['trust', 'sympathy', 'conflict', 'influence'];
const MAX_TEXT = 64;

interface CommandSpec {
  readonly id: CommandId;
  readonly family: CommandFamily;
  /** Noch nicht ausfuehrbare Commands bleiben parsebar, werden aber abgewiesen. */
  readonly executable: boolean;
  compile(directive: ParsedDirective, participantCount: number): NarrativeCommand | null;
}

const isSafeInt = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;

const text = (value: DirectiveScalar | undefined, max = MAX_TEXT): string | null =>
  typeof value === 'string' && value.length > 0 && value.length <= max ? value : null;

const integer = (value: DirectiveScalar | undefined, min: number, max: number): number | null =>
  isSafeInt(value, min, max) ? value : null;

const valueOf = (directive: ParsedDirective, key: string, index: number): DirectiveScalar | undefined =>
  directive.named[key] ?? directive.positional[index];

function actorOf(value: DirectiveScalar | undefined, participantCount: number): ChoiceActor | null {
  if (typeof value === 'number' && isSafeInt(value, 0, Math.max(0, participantCount - 1))) {
    return { participant: value };
  }
  if (typeof value !== 'string') return null;
  const participant = /^@(\d+)$/.exec(value);
  if (participant) {
    const index = Number(participant[1]);
    return isSafeInt(index, 0, Math.max(0, participantCount - 1)) ? { participant: index } : null;
  }
  return isActorRef(value) ? value : null;
}

const compileSetFlag = (directive: ParsedDirective): NarrativeCommand | null => {
  const flag = text(valueOf(directive, 'flag', 0), 32);
  const delta = integer(valueOf(directive, 'delta', 1) ?? 1, -1000, 1000);
  if (!flag || !FLAG.test(flag) || delta === null || delta === 0) return null;
  return { id: 'SET_FLAG', flag, delta };
};

const compileRelationship = (directive: ParsedDirective, participantCount: number): NarrativeCommand | null => {
  const from = actorOf(valueOf(directive, 'from', 0), participantCount);
  const to = actorOf(valueOf(directive, 'to', 1), participantCount);
  const dimension = valueOf(directive, 'dimension', 2);
  const delta = integer(valueOf(directive, 'delta', 3), -10, 10);
  if (!from || !to || from === to || typeof dimension !== 'string'
    || !(DIMENSIONS as readonly string[]).includes(dimension) || delta === null || delta === 0) return null;
  return { id: 'ADJUST_RELATIONSHIP', from, to, dimension: dimension as RelationshipDimension, delta };
};

const compileFreeze = (directive: ParsedDirective): NarrativeCommand | null => {
  const ticks = integer(valueOf(directive, 'ticks', 0), 1, 200);
  return ticks === null ? null : { id: 'FREEZE_TICK', ticks };
};

const compileDialog = (directive: ParsedDirective): NarrativeCommand | null => {
  const dialogId = text(valueOf(directive, 'dialogId', 0));
  return dialogId && DIALOG.test(dialogId) ? { id: 'TRIGGER_DIALOG', dialogId } : null;
};

const compileCounter = (directive: ParsedDirective, participantCount: number): NarrativeCommand | null => {
  const rival = actorOf(valueOf(directive, 'rival', 0), participantCount);
  return rival ? { id: 'COUNTER_RIVAL', rival } : null;
};

export const COMMAND_SPECS: readonly CommandSpec[] = [
  { id: 'SET_FLAG', family: 'STORY', executable: true, compile: compileSetFlag },
  { id: 'ADJUST_RELATIONSHIP', family: 'RELATIONSHIP', executable: true, compile: compileRelationship },
  { id: 'FREEZE_TICK', family: 'EVENT', executable: true, compile: compileFreeze },
  { id: 'TRIGGER_DIALOG', family: 'DIALOG', executable: false, compile: compileDialog },
  { id: 'COUNTER_RIVAL', family: 'RIVAL', executable: true, compile: compileCounter },
];

export function commandSpec(id: string): CommandSpec | null {
  return COMMAND_SPECS.find((spec) => spec.id === id) ?? null;
}

export function isCommandId(value: string): value is CommandId {
  return commandSpec(value) !== null;
}

/** Die deklarierten Choice-Effekte sind die kontextspezifische Allowlist. */
export function allowlistForChoice(choice: EventChoice): readonly CommandId[] {
  return [...new Set(choice.effects.map((effect) => effect.kind))] as CommandId[];
}
