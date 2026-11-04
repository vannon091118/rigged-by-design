/** NAR-14: Anzeigemodell fuer Szenen und Profile – reine Ableitung, keine zweite Wahrheit. */
import type { Ledger } from '../../economy/ledger';
import { HAUSKONTO } from '../money';
import type { ActorRef, Visitor, WorldState } from '../types';
import { checkChoiceSelection, choiceCostTotal } from './choices/eligibility';
import { composeNarrative, type ComposedNarrative } from './composer';
import { templateFor } from './events/definitions';
import type { ContentSlotKind } from './events/template-types';
import { isLiveEventStatus } from './event-lifecycle';
import type { NarrativeEventInstance } from './event-types';
import type { NarrativeEventView, NarrativeProfileView, NarrativeView } from './view-types';

/** Grenze fuer die Anzeige: mehr Profile sind nicht lesbar und nicht noetig. */
const PROFILE_LIMIT = 12;

/** Persona-Refs der Registry sind Namens-Slugs, keine Persona-IDs. */
const slug = (name: string): string => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const visitorIdOf = (ref: ActorRef): number | null => {
  const match = /^visitor:(\d+)$/.exec(ref);
  return match ? Number(match[1]) : null;
};

function participantLabel(ref: ActorRef, visitors: readonly Visitor[]): string {
  if (ref === 'player') return 'Du';
  const visitorId = visitorIdOf(ref);
  if (visitorId !== null) return visitors.find((visitor) => visitor.id === visitorId)?.name ?? `Besucher #${visitorId}`;
  if (ref.startsWith('staff:')) return 'Personal';
  return `Rivale ${ref.slice('rival:'.length)}`;
}

function slotText(composed: ComposedNarrative, kind: ContentSlotKind): string {
  return composed.slots.find((slot) => slot.kind === kind)?.text ?? '';
}

/**
 * Text kommt ausschliesslich aus der Registry. Reicht die Teilnehmer-Persona
 * nicht fuer ein Fragment, wird einmal ohne diese Einschraenkung zusammengesetzt;
 * bleibt es Fallback, sagt das Modell es (`fallbackText`) statt Text zu erfinden.
 */
function composeEvent(
  template: NonNullable<ReturnType<typeof templateFor>>,
  participants: readonly Visitor[],
): ComposedNarrative {
  const request = { locale: 'de', slots: template.contentSlots, availablePersonas: participants.map((visitor) => slug(visitor.name)) };
  const composed = composeNarrative(request);
  if (!composed.degraded || request.availablePersonas.length === 0) return composed;
  return composeNarrative({ ...request, availablePersonas: [] });
}

function eventView(world: WorldState, ledger: Ledger, event: NarrativeEventInstance): NarrativeEventView | null {
  const template = templateFor(event.eventId, event.templateVersion);
  if (!template) return null;
  const participants = event.participants
    .map(visitorIdOf)
    .map((visitorId) => world.visitors.find((visitor) => visitor.id === visitorId))
    .filter((visitor): visitor is Visitor => visitor !== undefined);
  const composed = composeEvent(template, participants);
  const context = {
    tick: world.tick,
    flags: world.narrative.flags,
    houseBalance: ledger.getBalance(HAUSKONTO),
    relationships: world.narrative.relationships,
    participants: event.participants,
  };
  const choices = event.offeredChoiceIds.map((choiceId) => {
    const evaluation = checkChoiceSelection(event, template, choiceId, context);
    const slot = evaluation.choice?.labelSlotId;
    const label = slot ? composed.slots.find((entry) => entry.slotId === slot)?.text ?? '' : '';
    return {
      choiceId,
      label: label || 'Weiter',
      available: evaluation.available,
      reasons: evaluation.reasons,
      cost: evaluation.choice ? choiceCostTotal(evaluation.choice) : 0,
    };
  });
  return {
    id: event.id,
    eventId: event.eventId,
    title: slotText(composed, 'TITLE'),
    body: slotText(composed, 'BODY'),
    step: event.step,
    status: event.status,
    expiresInTicks: Math.max(0, event.expiresTick - world.tick),
    participants: event.participants.map((ref) => ({
      ref, label: participantLabel(ref, world.visitors), visitorId: visitorIdOf(ref),
    })),
    choices,
    fallbackText: composed.degraded,
  };
}

/** Profile: Figuren mit offener Szene zuerst, danach Figuren mit Beziehung oder Erinnerung. */
function profiles(world: WorldState, live: readonly NarrativeEventInstance[]): NarrativeProfileView[] {
  const inScene = new Set<number>();
  const stories = new Map<number, string[]>();
  for (const event of live) {
    for (const ref of event.participants) {
      const visitorId = visitorIdOf(ref);
      if (visitorId === null) continue;
      inScene.add(visitorId);
      stories.set(visitorId, [...(stories.get(visitorId) ?? []), event.eventId]);
    }
  }
  const related = new Set(world.narrative.relationships.map((edge) => visitorIdOf(edge.from)));
  return [...world.visitors]
    .filter((visitor) => inScene.has(visitor.id) || related.has(visitor.id) || visitor.memories.length > 0)
    .sort((left, right) => Number(inScene.has(right.id)) - Number(inScene.has(left.id)) || left.id - right.id)
    .slice(0, PROFILE_LIMIT)
    .map((visitor) => ({
      visitorId: visitor.id,
      name: visitor.name,
      persona: visitor.persona,
      visits: visitor.visits,
      memories: visitor.memories.map((memory) => ({ ...memory })),
      relationships: world.narrative.relationships
        .filter((edge) => edge.from === `visitor:${visitor.id}`)
        .map((edge) => ({
          to: edge.to, trust: edge.trust, sympathy: edge.sympathy,
          conflict: edge.conflict, influence: edge.influence, updatedTick: edge.updatedTick,
        })),
      stories: stories.get(visitor.id) ?? [],
    }));
}

/** Aktive Szenen zuerst nach Starttick, dann nach ID: gleiche Welt, gleiche Reihenfolge. */
export function buildNarrativeView(world: WorldState, ledger: Ledger): NarrativeView {
  const live = world.narrative.events
    .filter((event) => isLiveEventStatus(event.status))
    .sort((left, right) => left.startedTick - right.startedTick || left.id - right.id);
  const events = live
    .map((event) => eventView(world, ledger, event))
    .filter((view): view is NarrativeEventView => view !== null);
  return { events, profiles: profiles(world, live) };
}
