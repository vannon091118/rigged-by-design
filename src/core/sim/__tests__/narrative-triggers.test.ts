/** @test-target: src/core/sim/narrative/triggers.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { emitFact } from '../narrative/facts';
import { actorRefOfVisitor, shift } from '../narrative/relationships';
import {
  actorRefsOfFact, buildTriggerContext, evaluateTrigger, evaluateTriggerDefinition,
  type TriggerCondition,
} from '../narrative/triggers';
import { createWorld, ensureStarter } from '../templates';
import { recordVisitor } from '../visitors';

function fixture() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const visitor = recordVisitor(world, { name: 'Rita', persona: 'STAMMGAST', tick: 0 });
  visitor.memories = [{ factId: 1, tick: 0, score: 20, valence: 'BAD' }];
  const fact = emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: visitor.id, visits: 2 });
  const ledger = new Ledger();
  const device = world.furniture.find((item) => item.gameId)!;
  device.damaged = true;
  world.tick = 10;
  world.narrative.flags.open = 2;
  world.narrative.houseBand = 'LOW';
  world.player.rpg.charismaLevel = 3;
  world.reputation = 70;
  world.demandTier = 'SAAL';
  world.guestsServed = 12;
  const visitorRef = actorRefOfVisitor(visitor.id);
  shift(world, visitorRef, 'player', { trust: 4, sympathy: 1 }, 10);
  const context = buildTriggerContext(world, ledger, fact);
  return { world, visitor, visitorRef, fact, ledger, context };
}

const complaint: TriggerCondition = { op: 'all', conditions: [
  { op: 'fact', kind: 'VISITOR_RETURNED' },
  { op: 'visitor-memory', valence: 'BAD' },
  { op: 'house-at-most', amount: fromVC(25) },
  { op: 'damaged-device' },
  { op: 'actor-role', role: 'visitor' },
  { op: 'relationship-at-least', from: 'visitor:1', to: 'player', dimension: 'trust', value: 4 },
  { op: 'fact-within', ticks: 10 },
] };

describe('Narrative Trigger', () => {
  it('kombiniert Rueckkehr, Erinnerung, Hauskasse, Zustand und Beziehung ohne Mutation', () => {
    const { world, visitorRef, fact, context } = fixture();
    const before = JSON.stringify(world.narrative);
    const evaluated = evaluateTrigger(complaint, context);
    expect(evaluated.matched).toBe(true);
    expect(evaluated.reasons.length).toBeGreaterThan(0);
    expect(JSON.stringify(world.narrative)).toBe(before);
    expect(actorRefsOfFact(fact)).toEqual([visitorRef]);
    const match = evaluateTriggerDefinition({ id: 'complaint', condition: complaint }, context);
    expect(match).toMatchObject({
      triggerId: 'complaint',
      matched: true,
      factId: fact.id,
      participants: [visitorRef],
    });
  });

  it('faellt bei fehlender Erinnerung auf Alternativen und Negation zurueck', () => {
    const { world, ledger, fact, context } = fixture();
    expect(evaluateTrigger({ op: 'visitor-memory', valence: 'GOOD' }, context).matched).toBe(false);
    const fallingBack: TriggerCondition = { op: 'any', conditions: [
      { op: 'visitor-memory', valence: 'BAD' },
      { op: 'not', condition: { op: 'fact', kind: 'VISIT_ENDED' } },
    ] };
    expect(evaluateTrigger(fallingBack, context).matched).toBe(true);
    world.visitors = [];
    const cleared = buildTriggerContext(world, ledger, fact);
    expect(evaluateTrigger({ op: 'visitor-memory', valence: 'BAD' }, cleared).matched).toBe(false);
    expect(evaluateTrigger({ op: 'actor-role', role: 'visitor' }, cleared).matched).toBe(true);
  });

  it('wertet jeden Operator an seinen Grenzen aus', () => {
    const { context, visitorRef } = fixture();
    const cases: readonly (readonly [TriggerCondition, boolean])[] = [
      [{ op: 'fact', kind: 'VISITOR_RETURNED' }, true],
      [{ op: 'fact', kind: 'VISIT_ENDED' }, false],
      [{ op: 'visitor-memory', valence: 'BAD' }, true],
      [{ op: 'house-at-most', amount: 0 }, true],
      [{ op: 'house-at-least', amount: 0 }, true],
      [{ op: 'house-at-least', amount: 1 }, false],
      [{ op: 'house-band', band: 'LOW' }, true],
      [{ op: 'damaged-device' }, true],
      [{ op: 'charisma-at-least', level: 3 }, true],
      [{ op: 'charisma-at-least', level: 4 }, false],
      [{ op: 'reputation-at-least', value: 70 }, true],
      [{ op: 'reputation-at-least', value: 71 }, false],
      [{ op: 'demand-tier-at-least', tier: 'SAAL' }, true],
      [{ op: 'demand-tier-at-least', tier: 'KONZERN' }, false],
      [{ op: 'guests-served-at-least', count: 12 }, true],
      [{ op: 'guests-served-at-least', count: 13 }, false],
      [{ op: 'flag-at-least', flag: 'open', value: 2 }, true],
      [{ op: 'flag-at-least', flag: 'open', value: 3 }, false],
      [{ op: 'flag-present', flag: 'open' }, true],
      [{ op: 'flag-present', flag: 'missing' }, false],
      [{ op: 'flag-absent', flag: 'missing' }, true],
      [{ op: 'flag-absent', flag: 'open' }, false],
      [{ op: 'fact-within', ticks: 10 }, true],
      [{ op: 'fact-within', ticks: 9 }, false],
      [{ op: 'recent-fact', kind: 'VISITOR_RETURNED', ticks: 10 }, true],
      [{ op: 'recent-fact', kind: 'VISITOR_RETURNED', minCount: 2 }, false],
      [{ op: 'recent-fact', kind: 'VISIT_ENDED' }, false],
      [{ op: 'actor-is', ref: visitorRef }, true],
      [{ op: 'actor-is', ref: 'player' }, false],
      [{ op: 'actor-role', role: 'visitor' }, true],
      [{ op: 'actor-role', role: 'staff' }, false],
      [{ op: 'relationship-at-least', from: visitorRef, to: 'player', dimension: 'trust', value: 4 }, true],
      [{ op: 'relationship-at-least', from: visitorRef, to: 'player', dimension: 'trust', value: 5 }, false],
      [{ op: 'relationship-at-most', from: visitorRef, to: 'player', dimension: 'sympathy', value: 1 }, true],
      [{ op: 'relationship-at-most', from: visitorRef, to: 'player', dimension: 'sympathy', value: 0 }, false],
      [{ op: 'relationship-at-least', from: visitorRef, to: 'staff:1', dimension: 'trust', value: -10 }, false],
    ];
    for (const [condition, expected] of cases) {
      expect(evaluateTrigger(condition, context).matched).toBe(expected);
    }
  });

  it('verwirft ungueltige Direktaufrufe und leere Kombinationen fail-closed', () => {
    const { context } = fixture();
    expect(evaluateTrigger({ op: 'all', conditions: [] }, context).matched).toBe(false);
    expect(evaluateTrigger({ op: 'any', conditions: [] }, context).matched).toBe(false);
    expect(evaluateTrigger({ op: 'fact-within', ticks: -1 }, context).matched).toBe(false);
    expect(evaluateTrigger({ op: 'house-at-most', amount: -1 }, context).matched).toBe(false);
    expect(evaluateTrigger({ op: 'flag-at-least', flag: 'open', value: Number.POSITIVE_INFINITY }, context).matched).toBe(false);
  });
});
