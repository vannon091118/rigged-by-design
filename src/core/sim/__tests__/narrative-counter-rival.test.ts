/**
 * @test-target: src/core/sim/narrative/commands/execute.ts
 * @error-code: ERR-2001
 *
 * D2: `CONFRONT_RIVAL` traegt die typisierte Domaenenwirkung `COUNTER_RIVAL`.
 * Nach der Ausfuehrung liefert `decideRivalAction` fuer diesen Rivalen bis zum
 * Tick null; ein unbekannter Rivale wird bereits im Preflight abgewiesen.
 * `execute.ts` bleibt der einzige Schreibpfad; ein neuer Fact entsteht nicht.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { HAUSKONTO } from '../money';
import { executeChoice } from '../narrative/commands/execute';
import { scheduleEvent } from '../narrative/event-scheduler';
import { templateFor } from '../narrative/events/definitions';
import { createEventCandidate } from '../narrative/events/template-candidate';
import type { EventTemplate } from '../narrative/events/template-types';
import { decideRivalAction, type RivalPolicyInput } from '../rival-ai/policy';
import { createWorld } from '../templates';
import type { TriggerMatch } from '../narrative/trigger-types';

const input = (overrides: Partial<RivalPolicyInput> = {}): RivalPolicyInput => ({
  tick: 400, stance: 'NEUTRAL', capacity: 80, goodwill: -30, nextActionTick: 0,
  counteredUntilTick: 0, rivalReputation: 40, playerReputation: 30, guestsServed: 40,
  evidenceCount: 0, recentNetToHouse: 0, machineId: 101,
  ...overrides,
});

function rivalWorld(activeTemplate: EventTemplate = templateFor('RIVAL_MOVE', 1)!) {
  const world = createWorld('SMALL');
  world.tick = 400;
  const ledger = new Ledger({ [HAUSKONTO]: fromVC(100) });
  const match: TriggerMatch = {
    triggerId: 'rival-action', matched: true, factId: 1,
    participants: ['rival:HAFENKLAUSE'], reasons: ['TEST'],
  };
  const candidate = createEventCandidate(activeTemplate, match)!;
  const event = scheduleEvent(world, candidate, 'OFFERED', world.tick)!;
  return { world, ledger, event };
}

describe('Gegenmassnahme COUNTER_RIVAL (D2)', () => {
  it('setzt counteredUntilTick und legt den Rivalen bis zum Tick still', () => {
    const { world, ledger, event } = rivalWorld();
    const mind = world.rivals.find((entry) => entry.rivalId === 'HAFENKLAUSE')!;
    const result = executeChoice(world, ledger, event.id, 'CONFRONT_RIVAL');
    expect(result.ok).toBe(true);
    expect(result.event?.status).toBe('RESOLVED');
    expect(mind.counteredUntilTick).toBe(world.tick + 900);
    expect(decideRivalAction(input({ tick: world.tick, counteredUntilTick: mind.counteredUntilTick }))).toBeNull();
    expect(decideRivalAction(input({
      tick: mind.counteredUntilTick, counteredUntilTick: mind.counteredUntilTick,
    }))).not.toBeNull();
  });

  it('weist einen unbekannten Rivalen bereits im Preflight ab', () => {
    const base = templateFor('RIVAL_MOVE', 1)!;
    const unknown: EventTemplate = {
      ...base,
      eventId: 'COUNTER_TEST',
      choices: [{
        ...base.choices[0]!,
        effects: [{ kind: 'COUNTER_RIVAL', rival: 'rival:NIEMAND' }],
      }],
    };
    const { world, ledger, event } = rivalWorld(unknown);
    const result = executeChoice(world, ledger, event.id, 'CONFRONT_RIVAL', unknown);
    expect(result.ok).toBe(false);
    expect(result.rejections.map((entry) => entry.reason)).toContain('INVALID_TARGET');
    expect(world.rivals.every((entry) => entry.counteredUntilTick === 0)).toBe(true);
    expect(world.narrative.pending.at(-1)?.kind).toBe('COMMAND_REJECTED');
  });
});
