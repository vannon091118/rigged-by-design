/** Uebersetzt einen Trigger-Match in einen begrenzten EventCandidate aus dem Template. */
import type { EventCandidate } from '../event-types';
import { isEventCandidate } from '../event-schema';
import type { ActorRef } from '../types';
import type { ActorRole, TriggerMatch } from '../trigger-types';
import { offerChoiceIds } from '../choices/contract';
import { isEventTemplate } from './template-schema';
import type { EventTemplate } from './template-types';

const roleOf = (ref: ActorRef): ActorRole => {
  if (ref === 'player') return 'player';
  if (ref.startsWith('visitor:')) return 'visitor';
  if (ref.startsWith('staff:')) return 'staff';
  return 'rival';
};

/** Rollen werden eins zu eins und ohne doppelte Akteure aufgeloest. */
export function resolveParticipants(
  roles: readonly ActorRole[],
  refs: readonly ActorRef[],
): readonly ActorRef[] | null {
  if (roles.length !== refs.length || new Set(refs).size !== refs.length) return null;
  const used = new Set<number>();
  const participants: ActorRef[] = [];
  for (const role of roles) {
    const index = refs.findIndex((ref, position) => !used.has(position) && roleOf(ref) === role);
    if (index < 0) return null;
    used.add(index);
    participants.push(refs[index]!);
  }
  return participants;
}

/** Nur ein passender, nicht manipulierter Match erzeugt einen Kandidaten. */
export function createEventCandidate(
  template: EventTemplate,
  match: TriggerMatch,
  chainFromEventId: number | null = null,
): EventCandidate | null {
  if (!isEventTemplate(template) || !match.matched || match.triggerId !== template.triggerId) return null;
  const participants = resolveParticipants(template.participantRoles, match.participants);
  if (!participants) return null;
  const candidate: EventCandidate = {
    eventId: template.eventId,
    templateId: template.eventId,
    templateVersion: template.version,
    priority: template.priority,
    scope: template.scope,
    participants,
    sourceFactId: match.factId,
    expiresInTicks: template.expiresInTicks,
    cooldownTicks: template.cooldownTicks,
    maxOccurrences: template.maxOccurrences,
    chainFromEventId,
    step: template.initialStep,
    offeredChoiceIds: [...offerChoiceIds(template)],
  };
  return isEventCandidate(candidate) ? candidate : null;
}
