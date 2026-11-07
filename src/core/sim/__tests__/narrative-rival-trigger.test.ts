/**
 * @test-target: src/core/sim/narrative/events/trigger-definitions.ts
 * @error-code: ERR-2001
 *
 * C2: Der `rival-action`-Trigger oeffnet nur fuer Handlungen mit Folgen ein
 * Event. PROBE bleibt ein Indiz ohne Szene; SABOTAGE erzeugt genau einen
 * RIVAL_MOVE.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { EVENT_TRIGGER_DEFINITIONS } from '../narrative/events/trigger-definitions';
import { processNarrativeRuntime } from '../narrative/runtime';
import { tickRivalMinds } from '../rival-ai/tick';
import { createWorld } from '../templates';
import type { VaCoinMicro } from '../../economy/vacoin';

function rivalWorld() {
  const world = createWorld('SMALL');
  world.tick = 400;
  for (const rival of world.rivals) rival.nextActionTick = 9_999;
  const mind = world.rivals[0]!;
  mind.nextActionTick = 0;
  return { world, mind };
}

describe('Rivalen-Fact als Event-Trigger (C2)', () => {
  it('erzeugt fuer PROBE kein Event', () => {
    const { world, mind } = rivalWorld();
    mind.capacity = 10;
    const acted = tickRivalMinds(world);
    const result = processNarrativeRuntime(world, new Ledger());
    expect(acted.map((entry) => entry.action)).toEqual(['PROBE']);
    expect(result.processed).toBeGreaterThan(0);
    expect(world.narrative.events).toEqual([]);
  });

  it('erzeugt fuer SABOTAGE genau einen RIVAL_MOVE', () => {
    const { world, mind } = rivalWorld();
    mind.capacity = 80;
    mind.goodwill = -30;
    world.narrative.recent.push({
      id: 1, tick: 390, day: 3, kind: 'RIVAL_ENCOUNTER',
      actorRefs: ['rival:HAFENKLAUSE', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: 5_000 as VaCoinMicro,
    });
    const acted = tickRivalMinds(world);
    const result = processNarrativeRuntime(world, new Ledger());
    expect(acted.map((entry) => entry.action)).toEqual(['SABOTAGE']);
    expect(result.scheduled.map((event) => event.eventId)).toEqual(['RIVAL_MOVE']);
  });

  it('haelt die Aktionen des rival-action-Triggers auf vier fest', () => {
    const definition = EVENT_TRIGGER_DEFINITIONS.find((entry) => entry.id === 'rival-action');
    expect(definition?.condition).toEqual({
      op: 'rival-action', actions: ['TRADE_INFO', 'PRICE_MOVE', 'POACH_VISITOR', 'SABOTAGE'],
    });
  });
});
