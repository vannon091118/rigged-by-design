/** @test-target: src/core/sim/narrative/main-event-pool.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { INFLUENCE_CONFIG, type InfluenceConfig } from '../influence-config';
import { transitionEvent } from '../narrative/event-lifecycle';
import { scheduleEvent } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import { maybeScheduleMainEvent, poolEventWeight } from '../narrative/main-event-pool';
import { actorRefOfVisitor, shift } from '../narrative/relationships';
import { processNarrativeRuntime } from '../narrative/runtime';
import { buildNarrativeView } from '../narrative/view';
import { createWorld } from '../templates';
import { makeGuest } from '../traits';
import type { Guest, WorldState } from '../types';
import type { ActorRef } from '../narrative/types';
import { recordVisitor } from '../visitors';

const SEED = 20261108;
const POOL_IDS = ['AMBIENT_BAR_TALK', 'AMBIENT_SHARED_ROUND', 'AMBIENT_TENSE_TABLE'];

function forced(overrides: Partial<InfluenceConfig['eventPool']> = {}): InfluenceConfig {
  return {
    ...INFLUENCE_CONFIG,
    eventPool: { ...INFLUENCE_CONFIG.eventPool, chance: 1, idleCooldownTicks: 0, ...overrides },
  };
}

interface PairWorld {
  readonly world: WorldState;
  readonly from: ActorRef;
  readonly to: ActorRef;
}

function pairWorld(): PairWorld {
  const world = createWorld('SMALL');
  const add = (id: number, name: string): ActorRef => {
    const visitor = recordVisitor(world, { name, persona: 'STAMMGAST', tick: 0 });
    const guest: Guest = makeGuest({ id, persona: 'STAMMGAST', prng: new Prng(SEED + id), spawn: { x: 2, y: 13 } });
    guest.visitorId = visitor.id;
    guest.mood = 50;
    guest.sociability = 60;
    guest.thirst = 30;
    world.guests.push(guest);
    return actorRefOfVisitor(visitor.id);
  };
  return { world, from: add(1, 'Ada'), to: add(2, 'Bela') };
}

describe('Main-Event-Pool (P-22)', () => {
  it('zieht feste Szenen ohne Sonderstatus, ohne Sonder-Log und mit normalen Slots', () => {
    const { world } = pairWorld();
    const beforeEvent = world.lastEvent;
    const beforeJournal = world.journal.length;
    const event = maybeScheduleMainEvent(world, forced(), 0);
    expect(event).not.toBeNull();
    expect(POOL_IDS).toContain(event!.eventId);
    expect(templateFor(event!.eventId)).not.toBeNull();
    expect('pool' in event!).toBe(false);
    expect(world.lastEvent).toBe(beforeEvent);
    expect(world.journal.length).toBe(beforeJournal);
    const scene = buildNarrativeView(world, new Ledger()).events.find((entry) => entry.id === event!.id)!;
    expect(scene.title.length).toBeGreaterThan(0);
    expect(scene.body.length).toBeGreaterThan(0);
    expect(scene.fallbackSlots).toEqual([]);
  });

  it('triggert nur bei idle und ist ohne Chance nicht verpflichtend', () => {
    const { world } = pairWorld();
    expect(scheduleEvent(world, {
      eventId: 'BLOCKER', priority: 1, scope: 'GLOBAL', participants: [], sourceFactId: 0,
    }, 'ACTIVE', 0)).not.toBeNull();
    expect(maybeScheduleMainEvent(world, forced(), 0)).toBeNull();

    const quiet = pairWorld().world;
    const off = forced({ chance: 0 });
    for (let tick = 0; tick < 50; tick += 1) {
      expect(maybeScheduleMainEvent(quiet, off, tick)).toBeNull();
    }
    expect(quiet.narrative.events).toHaveLength(0);
  });

  it('daempft Wiederholung und zieht nicht zweimal dieselbe Szene hintereinander', () => {
    const { world, from, to } = pairWorld();
    const config = forced({ recencyPenalty: 0.1, recencyWindowTicks: 1000, repeatLockout: 1 });
    const ids: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      const tick = index * 100;
      const event = maybeScheduleMainEvent(world, config, tick);
      expect(event).not.toBeNull();
      ids.push(event!.eventId);
      expect(transitionEvent(world, event!.id, 'CANCELLED', tick)).toBe(true);
    }
    for (let index = 1; index < ids.length; index += 1) expect(ids[index]).not.toBe(ids[index - 1]);
    const damped = poolEventWeight(world, 'AMBIENT_BAR_TALK', from, to, config, 1000);
    const fresh = poolEventWeight(world, 'AMBIENT_BAR_TALK', from, to,
      forced({ recencyWindowTicks: 0, repeatLockout: 0 }), 1000);
    expect(damped).toBeLessThan(fresh);
  });

  it('reagiert messbar auf die gerichtete Beziehungskante', () => {
    const { world, from, to } = pairWorld();
    const config = forced({ recencyWindowTicks: 0 });
    const neutral = poolEventWeight(world, 'AMBIENT_BAR_TALK', from, to, config, 0);
    shift(world, from, to, { trust: 8, sympathy: 6 }, 0);
    const warm = poolEventWeight(world, 'AMBIENT_BAR_TALK', from, to, config, 0);
    expect(warm).toBeGreaterThan(neutral);
    shift(world, from, to, { conflict: 9 }, 0);
    const hostile = poolEventWeight(world, 'AMBIENT_BAR_TALK', from, to, config, 0);
    expect(hostile).toBeLessThan(warm);

    const tenseWorld = pairWorld();
    const before = poolEventWeight(tenseWorld.world, 'AMBIENT_TENSE_TABLE', tenseWorld.from, tenseWorld.to, config, 0);
    shift(tenseWorld.world, tenseWorld.from, tenseWorld.to, { conflict: 8 }, 0);
    const tense = poolEventWeight(tenseWorld.world, 'AMBIENT_TENSE_TABLE', tenseWorld.from, tenseWorld.to, config, 0);
    expect(tense).toBeGreaterThan(before);
  });

  it('laeuft in der Runtime auch ohne neuen Fact', () => {
    const { world } = pairWorld();
    const result = processNarrativeRuntime(world, new Ledger(), forced());
    expect(result.processed).toBe(0);
    expect(result.scheduled).toHaveLength(1);
    expect(result.scheduled[0]!.status).toBe('OFFERED');
  });
});
