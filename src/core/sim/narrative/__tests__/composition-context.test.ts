/**
 * @test-target: src/core/sim/narrative/composition-context.ts
 * @error-code: ERR-2001
 *
 * Der Helper liest ausschliesslich Welt, Fact, Event und Template; er mutiert
 * nichts und liefert die Composer-Felder fuer die Szene.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { createWorld } from '../../templates';
import { recordVisitor } from '../../visitors';
import { buildCompositionContext } from '../composition-context';
import { templateFor } from '../events/definitions';
import { emitFact } from '../facts';
import { actorRefOfVisitor, shift } from '../relationships';
import type { NarrativeEventInstance } from '../event-types';
import type { ActorRef, NarrativeFact } from '../types';
import type { EventTemplate } from '../events/template-types';
import type { WorldState } from '../../types';

function template(eventId: string): EventTemplate {
  const found = templateFor(eventId);
  if (!found) throw new Error(`Template fehlt: ${eventId}`);
  return found;
}

function eventFor(eventId: string, sourceFactId: number, participants: readonly ActorRef[] = []): NarrativeEventInstance {
  const definition = template(eventId);
  return {
    id: 1,
    eventId: definition.eventId,
    templateId: definition.eventId,
    templateVersion: definition.version,
    offeredChoiceIds: definition.choices.map((choice) => choice.choiceId),
    status: 'ACTIVE',
    scope: definition.scope,
    participants,
    sourceFactId,
    priority: definition.priority,
    startedTick: 0,
    updatedTick: 0,
    expiresTick: 30,
    step: definition.initialStep,
    maxOccurrences: definition.maxOccurrences,
    cooldownTicks: definition.cooldownTicks,
    chainFromEventId: null,
    resolution: null,
  };
}

function remember(world: WorldState, fact: NarrativeFact): void {
  world.narrative.pending = world.narrative.pending.filter((entry) => entry.id !== fact.id);
  world.narrative.recent.push(fact);
}

function fixture() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const visitor = recordVisitor(world, { name: 'Rita Kern', persona: 'STAMMGAST', tick: 0 });
  return { world, ledger, visitor };
}

describe('Composition Context (B1)', () => {
  it('liest Kontext, Persona und Template-Flags aus dem Fact', () => {
    const { world, ledger, visitor } = fixture();
    const fact = emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    remember(world, fact);
    world.narrative.flags.geheim = 1;

    const context = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', fact.id, [actorRefOfVisitor(visitor.id)]), template('VISITOR_RETURN'),
    );

    expect(context.contexts).toEqual(['return']);
    expect(context.availablePersonas).toEqual(['rita-kern']);
    expect(context.requiredFlags).toEqual(['startpool']);
  });

  it('faellt ohne Fact auf Trigger und Event zurueck', () => {
    const { world, ledger } = fixture();
    const demand = buildCompositionContext(world, ledger, eventFor('NEON_NACHT', 0), template('NEON_NACHT'));
    const missing = buildCompositionContext(world, ledger, eventFor('VISITOR_RETURN', 999), template('VISITOR_RETURN'));

    expect(demand.contexts).toEqual(['demand']);
    expect(missing.contexts).toEqual(['return']);
  });

  it('uebersetzt ein beendetes Visits nach seiner Valenz', () => {
    const { world, ledger, visitor } = fixture();
    const good = emitFact(world, {
      kind: 'VISIT_ENDED', visitorId: visitor.id, guestId: 1, score: 80, valence: 'GOOD',
    });
    const bad = emitFact(world, {
      kind: 'VISIT_ENDED', visitorId: visitor.id, guestId: 2, score: 20, valence: 'BAD',
    });
    remember(world, good);
    remember(world, bad);

    const goodContext = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', good.id, [actorRefOfVisitor(visitor.id)]), template('VISITOR_RETURN'),
    );
    const badContext = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', bad.id, [actorRefOfVisitor(visitor.id)]), template('VISITOR_RETURN'),
    );

    expect(goodContext.contexts).toEqual(['return']);
    expect(badContext.contexts).toEqual(['loss']);
  });

  it('bildet Konflikt, Service und Rivalen auf ihre Kontexte ab', () => {
    const { world, ledger, visitor } = fixture();
    const second = recordVisitor(world, { name: 'Boris Falk', persona: 'BUSINESS', tick: 0 });
    const firstRef = actorRefOfVisitor(visitor.id);
    const secondRef = actorRefOfVisitor(second.id);
    const conflict = emitFact(world, {
      kind: 'VISITOR_CONFLICT', actorRefs: [firstRef, secondRef], initiator: firstRef, severity: 1,
    });
    const service = emitFact(world, {
      kind: 'VISITOR_SERVICE', actorRefs: [firstRef, 'staff:1'], service: 'CASHIER', valence: 'GOOD',
    });
    const rival = emitFact(world, {
      kind: 'RIVAL_ACTION', actorRefs: ['rival:HAFENKLAUSE'], rivalId: 'HAFENKLAUSE',
      action: 'SABOTAGE', evidence: true, machineId: null,
    });
    remember(world, conflict);
    remember(world, service);
    remember(world, rival);

    const conflictContext = buildCompositionContext(
      world, ledger, eventFor('VISITOR_CONFLICT', conflict.id, [firstRef, secondRef]), template('VISITOR_CONFLICT'),
    );
    const serviceContext = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', service.id, [firstRef]), template('VISITOR_RETURN'),
    );
    const rivalContext = buildCompositionContext(
      world, ledger, eventFor('RIVAL_MOVE', rival.id, ['rival:HAFENKLAUSE']), template('RIVAL_MOVE'),
    );

    expect(conflictContext.contexts).toEqual(['conflict']);
    expect(serviceContext.contexts).toEqual(['service']);
    expect(rivalContext.contexts).toEqual(['rival']);
  });

  it('liest Beziehung und Stimmung aus der gerichteten Kante', () => {
    const { world, ledger, visitor } = fixture();
    const fact = emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
    remember(world, fact);
    shift(world, actorRefOfVisitor(visitor.id), 'player', { trust: 3, sympathy: 2 }, 1);

    const context = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', fact.id, [actorRefOfVisitor(visitor.id)]), template('VISITOR_RETURN'),
    );

    expect(context.relationship).toBe('vertrauen');
    expect(context.mood).toBe('neugierig');
  });

  it('nutzt Erinnerungen, wenn keine Kante und keine Fact-Stimmung existiert', () => {
    const { world, ledger, visitor } = fixture();
    const fact = emitFact(world, { kind: 'VISITOR_FIRST_SEEN', visitorId: visitor.id, persona: 'STAMMGAST' });
    remember(world, fact);
    visitor.memories.push({ factId: 1, tick: 0, score: 20, valence: 'BAD' });

    const context = buildCompositionContext(
      world, ledger, eventFor('VISITOR_RETURN', fact.id, [actorRefOfVisitor(visitor.id)]), template('VISITOR_RETURN'),
    );

    expect(context.relationship).toBe('konflikt');
    expect(context.mood).toBe('argwoehnisch');
  });
});
