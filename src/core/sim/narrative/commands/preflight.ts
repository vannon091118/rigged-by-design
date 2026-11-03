/** Vollstaendige Vorpruefung einer Choice, bevor irgendein Effekt geschrieben wird. */
import type { Ledger } from '../../../economy/ledger';
import { HAUSKONTO } from '../../money';
import type { WorldState } from '../../types';
import { checkChoiceSelection, choiceCostTotal } from '../choices/eligibility';
import { canTransitionEvent } from '../event-lifecycle';
import { templateFor } from '../events/definitions';
import { isEventTemplate } from '../events/template-schema';
import type { ChoiceActor, EventTemplate } from '../events/template-types';
import { isStaffRef, visitorIdOf } from '../relationships';
import type { ActorRef } from '../types';
import { allowlistForChoice, commandSpec } from './registry';
import { commandsForChoice } from './validate';
import {
  COMMAND_LIMITS, type ChoicePlan, type ChoicePreflight, type CommandRejectReason,
  type CommandRejection,
} from './types';

const rejection = (commandId: string, reason: CommandRejectReason, detail: string): CommandRejection => ({
  commandId, reason, detail,
});

const resolveActor = (actor: ChoiceActor, participants: readonly ActorRef[]): ActorRef | null =>
  typeof actor === 'string' ? actor : participants[actor.participant] ?? null;

function actorAlive(world: WorldState, ref: ActorRef): boolean {
  if (ref === 'player') return true;
  const visitorId = visitorIdOf(ref);
  if (visitorId !== null) return world.visitors.some((visitor) => visitor.id === visitorId);
  if (isStaffRef(ref)) {
    const id = Number(ref.slice('staff:'.length));
    return world.agents.some((agent) => agent.id === id);
  }
  return ref.startsWith('rival:');
}

function targetRejections(world: WorldState, event: ChoicePlan['event'], commands: ChoicePlan['commands']): CommandRejection[] {
  const rejections: CommandRejection[] = [];
  for (const command of commands) {
    const spec = commandSpec(command.id);
    if (!spec?.executable) {
      rejections.push(rejection(command.id, 'NOT_EXECUTABLE', 'Handler ist noch nicht freigeschaltet.'));
      continue;
    }
    if (command.id === 'FREEZE_TICK') {
      if (command.ticks > COMMAND_LIMITS.freezeTicks) {
        rejections.push(rejection(command.id, 'INVALID_ARGS', 'Freeze ueberschreitet das Limit.'));
      }
      continue;
    }
    if (command.id !== 'ADJUST_RELATIONSHIP') continue;
    const from = resolveActor(command.from, event.participants);
    const to = resolveActor(command.to, event.participants);
    if (!from || !to || from === to || !actorAlive(world, from) || !actorAlive(world, to)) {
      rejections.push(rejection(command.id, 'INVALID_TARGET', 'Akteur fehlt oder ist ungueltig.'));
    }
  }
  return rejections;
}

function fail(event: ChoicePlan['event'] | null, rejections: readonly CommandRejection[]): ChoicePreflight {
  return { ok: false, event, rejections };
}

/**
 * `templateOverride` ist nur fuer bereits im Code validierte Templates gedacht,
 * etwa neue Definitionen vor ihrer Registry-Aufnahme. Die Runtime nutzt die Registry.
 */
export function preflightChoice(
  world: WorldState,
  ledger: Ledger,
  eventId: number,
  choiceId: string,
  templateOverride?: EventTemplate,
): ChoicePreflight {
  const event = world.narrative.events.find((entry) => entry.id === eventId) ?? null;
  if (!event) return fail(null, [rejection(choiceId, 'INVALID_EVENT', 'Event-ID unbekannt.')]);
  const template = templateOverride === undefined
    ? templateFor(event.templateId, event.templateVersion)
    : (isEventTemplate(templateOverride) ? templateOverride : null);
  if (!template || template.eventId !== event.templateId || template.eventId !== event.eventId
    || template.version !== event.templateVersion) {
    return fail(event, [rejection(choiceId, 'TEMPLATE_MISMATCH', 'Template-ID oder Version passt nicht.')]);
  }

  const evaluation = checkChoiceSelection(event, template, choiceId, {
    tick: world.tick,
    flags: { ...world.narrative.flags },
    houseBalance: ledger.getBalance(HAUSKONTO),
    relationships: [...world.narrative.relationships],
    participants: event.participants,
  });
  if (!evaluation.available || !evaluation.choice) {
    return fail(event, evaluation.reasons.map((reason) => rejection(choiceId, reason, 'Choice nicht verfuegbar.')));
  }

  const commands = commandsForChoice(evaluation.choice);
  const allowlist = allowlistForChoice(evaluation.choice);
  const rejections = targetRejections(world, event, commands);
  for (const command of commands) {
    if (!allowlist.includes(command.id)) {
      rejections.push(rejection(command.id, 'COMMAND_NOT_ALLOWED', 'Nicht im Choice-Vertrag deklariert.'));
    }
  }
  if (event.status === 'OFFERED' && !canTransitionEvent('OFFERED', 'ACTIVE')) {
    rejections.push(rejection(choiceId, 'EVENT_NOT_LIVE', 'Event kann nicht aktiviert werden.'));
  }
  if (event.status === 'ACTIVE' && !canTransitionEvent('ACTIVE', 'RESOLVED')) {
    rejections.push(rejection(choiceId, 'EVENT_NOT_LIVE', 'Event kann nicht aufgeloest werden.'));
  }
  const cost = choiceCostTotal(evaluation.choice);
  if (cost > ledger.getBalance(HAUSKONTO)) {
    rejections.push(rejection(choiceId, 'INSUFFICIENT_FUNDS', 'Kosten sind nicht gedeckt.'));
  }
  if (rejections.length > 0) return fail(event, rejections);
  return {
    ok: true,
    plan: {
      event, template, choice: evaluation.choice, commands, cost,
    },
  };
}
