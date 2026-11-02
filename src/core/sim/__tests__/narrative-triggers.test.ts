/** @test-target: src/core/sim/narrative/triggers.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { emitFact } from '../narrative/facts';
import { evaluateTrigger, type TriggerCondition } from '../narrative/triggers';
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
  return { world, visitor, fact, ledger, device };
}

const complaint: TriggerCondition = { op: 'all', conditions: [
  { op: 'fact', kind: 'VISITOR_RETURNED' },
  { op: 'visitor-memory', valence: 'BAD' },
  { op: 'house-at-most', amount: fromVC(25) },
  { op: 'damaged-device' },
] };

describe('Narrative Trigger', () => {
  it('kombiniert Rueckkehr, Erinnerung, Hauskasse und Zustand ohne Mutation', () => {
    const { world, ledger, fact, device } = fixture();
    const before = JSON.stringify(world.narrative);
    expect(evaluateTrigger(complaint, world, ledger, fact)).toBe(true);
    expect(JSON.stringify(world.narrative)).toBe(before);
    device.damaged = false;
    expect(evaluateTrigger(complaint, world, ledger, fact)).toBe(false);
  });

  it('unterstuetzt Alternativen und Negation bei unbekannten Besuchern', () => {
    const { world, ledger, fact } = fixture();
    world.visitors = [];
    const condition: TriggerCondition = { op: 'any', conditions: [
      { op: 'visitor-memory', valence: 'BAD' },
      { op: 'not', condition: { op: 'fact', kind: 'VISIT_ENDED' } },
    ] };
    expect(evaluateTrigger(condition, world, ledger, fact)).toBe(true);
    expect(evaluateTrigger({ op: 'visitor-memory', valence: 'BAD' }, world, ledger, fact)).toBe(false);
  });

  it('wertet Fristen, Flags und Spielerstufe an ihren Grenzen aus', () => {
    const { world, ledger, fact } = fixture();
    world.tick = 10;
    world.narrative.flags.open = 2;
    expect(evaluateTrigger({ op: 'fact-within', ticks: 10 }, world, ledger, fact)).toBe(true);
    expect(evaluateTrigger({ op: 'fact-within', ticks: 9 }, world, ledger, fact)).toBe(false);
    expect(evaluateTrigger({ op: 'fact-within', ticks: -1 }, world, ledger, fact)).toBe(false);
    expect(evaluateTrigger({ op: 'flag-at-least', flag: 'open', value: 2 }, world, ledger, fact)).toBe(true);
    expect(evaluateTrigger({ op: 'flag-at-least', flag: 'missing', value: 0 }, world, ledger, fact)).toBe(false);
    expect(evaluateTrigger({ op: 'charisma-at-least', level: world.player.rpg.charismaLevel }, world, ledger, fact)).toBe(true);
    expect(evaluateTrigger({ op: 'house-at-most', amount: -1 }, world, ledger, fact)).toBe(false);
  });
});
