/** Einziger Ausfuehrungspfad: Preflight, Kosten, Handler, RESOLVED. */
import type { Ledger } from '../../../economy/ledger';
import type { VaCoinMicro } from '../../../economy/vacoin';
import { EXTERNAL, HAUSKONTO } from '../../money';
import type { WorldState } from '../../types';
import { freezeEvent, transitionEvent } from '../event-lifecycle';
import type { ChoiceActor, EventTemplate } from '../events/template-types';
import { emitCommandRejected } from '../facts';
import { shift } from '../relationships';
import type { ActorRef } from '../types';
import { preflightChoice } from './preflight';
import type {
  ChoiceExecution, ChoicePlan, CommandRejectReason, NarrativeCommand,
} from './types';

const resolveActor = (actor: ChoiceActor, participants: readonly ActorRef[]): ActorRef | null =>
  typeof actor === 'string' ? actor : participants[actor.participant] ?? null;

const shiftFor = (dimension: 'trust' | 'sympathy' | 'conflict' | 'influence', delta: number) => {
  switch (dimension) {
    case 'trust': return { trust: delta };
    case 'sympathy': return { sympathy: delta };
    case 'conflict': return { conflict: delta };
    case 'influence': return { influence: delta };
  }
};

function applyCommand(world: WorldState, eventId: number, command: NarrativeCommand): boolean {
  if (command.id === 'SET_FLAG') {
    const current = world.narrative.flags[command.flag] ?? 0;
    world.narrative.flags[command.flag] = Math.max(-1_000_000, Math.min(1_000_000, current + command.delta));
    return true;
  }
  if (command.id === 'FREEZE_TICK') return freezeEvent(world, eventId, command.ticks, world.tick);
  if (command.id !== 'ADJUST_RELATIONSHIP') return false;
  const event = world.narrative.events.find((entry) => entry.id === eventId);
  if (!event) return false;
  const from = resolveActor(command.from, event.participants);
  const to = resolveActor(command.to, event.participants);
  if (!from || !to || from === to) return false;
  shift(world, from, to, shiftFor(command.dimension, command.delta), world.tick);
  return true;
}

function rejected(
  world: WorldState,
  eventId: number,
  choiceId: string,
  plan: ChoicePlan | null,
  rejections: ChoiceExecution['rejections'],
): ChoiceExecution {
  const reason: CommandRejectReason = rejections[0]?.reason ?? 'INVALID_EVENT';
  emitCommandRejected(world, choiceId, reason);
  return {
    ok: false,
    event: plan?.event ?? world.narrative.events.find((entry) => entry.id === eventId) ?? null,
    commands: plan?.commands ?? [],
    cost: plan?.cost ?? 0,
    rejections,
  };
}

export function executeChoice(
  world: WorldState,
  ledger: Ledger,
  eventId: number,
  choiceId: string,
  templateOverride?: EventTemplate,
): ChoiceExecution {
  const preflight = preflightChoice(world, ledger, eventId, choiceId, templateOverride);
  if (!preflight.ok) return rejected(world, eventId, choiceId, null, preflight.rejections);
  const { event, choice, commands, cost } = preflight.plan;

  if (event.status === 'OFFERED' && !transitionEvent(world, event.id, 'ACTIVE', world.tick)) {
    return rejected(world, eventId, choiceId, preflight.plan, [{
      commandId: choiceId, reason: 'EVENT_NOT_LIVE', detail: 'Aktivierung fehlgeschlagen.',
    }]);
  }
  if (cost > 0) {
    ledger.transfer(HAUSKONTO, EXTERNAL, cost as VaCoinMicro, `narrative ${event.eventId}/${choiceId}`, world.tick);
  }
  for (const command of commands) {
    if (!applyCommand(world, event.id, command)) {
      return rejected(world, eventId, choiceId, preflight.plan, [{
        commandId: command.id, reason: 'INVALID_TARGET', detail: 'Handler hat abgewiesen.',
      }]);
    }
  }
  if (!transitionEvent(world, event.id, 'RESOLVED', world.tick, choice.outcomeId)) {
    return rejected(world, eventId, choiceId, preflight.plan, [{
      commandId: choiceId, reason: 'EVENT_NOT_LIVE', detail: 'Aufloesung fehlgeschlagen.',
    }]);
  }
  const resolved = world.narrative.events.find((entry) => entry.id === event.id) ?? null;
  return { ok: true, event: resolved, commands, cost, rejections: [] };
}
