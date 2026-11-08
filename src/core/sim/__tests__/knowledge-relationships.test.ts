/**
 * @test-target: src/core/sim/narrative/knowledge.ts
 * @error-code: ERR-2001
 *
 * Beziehungen sind Teil der Matrix: Konflikt stoppt die Weitergabe, Vertrauen
 * oeffnet sie. Die Quelle wird nach Beziehung gewaehlt, und empfangenes Wissen
 * veraendert begrenzt die Kante zur Quelle und zum Subjekt.
 */
import { describe, expect, it } from 'vitest';
import { KNOWLEDGE_CONFIG, type KnowledgeConfig } from '../narrative/knowledge-config';
import { recordFirstHand, reportKnowledge } from '../narrative/knowledge';
import { hearRumor } from '../narrative/knowledge-gossip';
import { relationshipBetween, shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import type { WorldState } from '../types';
import { recordVisitor } from '../visitors';

const SEED = 20261108;
const quiet: KnowledgeConfig = {
  ...KNOWLEDGE_CONFIG,
  distance: { ...KNOWLEDGE_CONFIG.distance, lossPerStep: 0, distortionPerStep: 0 },
};
const ref = (id: number): `visitor:${number}` => `visitor:${id}`;
const world = (): WorldState => createWorld('SMALL');

function visitor(w: WorldState, name: string): number {
  return recordVisitor(w, { name, persona: 'STAMMGAST', tick: 0 }).id;
}

const speaker = { mood: 50, sociability: 50, thirst: 0, rumor: -0.5 } as const;

describe('Wissen und Beziehungen', () => {
  it('blockiert die Weitergabe bei Konflikt und oeffnet sie bei Vertrauen', () => {
    const hostile = world();
    const a = visitor(hostile, 'Ayla');
    const c = visitor(hostile, 'Cleo');
    recordFirstHand(hostile, { actor: ref(a), factId: 1, sentiment: -0.8, tick: 0 });
    shift(hostile, ref(a), ref(c), { conflict: 9 }, 1);
    expect(reportKnowledge(hostile, {
      from: ref(a), to: ref(c), tick: 1, seed: SEED, speaker,
    }, quiet)).toBeNull();

    const trusting = world();
    const a2 = visitor(trusting, 'Ayla');
    const c2 = visitor(trusting, 'Cleo');
    recordFirstHand(trusting, { actor: ref(a2), factId: 1, sentiment: -0.8, tick: 0 });
    shift(trusting, ref(a2), ref(c2), { trust: 9, sympathy: 6 }, 1);
    expect(reportKnowledge(trusting, {
      from: ref(a2), to: ref(c2), tick: 1, seed: SEED, speaker,
    }, quiet)).not.toBeNull();
  });

  it('waehlt die naehere, weitergabebereite Quelle statt der neuesten', () => {
    const w = world();
    const a = visitor(w, 'Ayla');
    const b = visitor(w, 'Benno');
    const c = visitor(w, 'Cleo');
    recordFirstHand(w, { actor: ref(a), factId: 1, sentiment: -0.6, tick: 0 });
    recordFirstHand(w, { actor: ref(b), factId: 2, sentiment: -0.7, tick: 0 });
    // A ist die neueste Quelle, steht aber im Konflikt mit Cleo; Benno ist nah und bereit.
    shift(w, ref(a), ref(c), { conflict: 9 }, 1);
    shift(w, ref(b), ref(c), { trust: 9, sympathy: 6 }, 1);
    shift(w, ref(c), ref(b), { trust: 9, sympathy: 6 }, 1);
    const heard = hearRumor(w, ref(c), 5, quiet);
    expect(heard).not.toBeNull();
    expect(heard!.sourceActor).toBe(ref(b));
    expect(heard!.originActor).toBe(ref(b));
  });

  it('schreibt empfangenes Wissen begrenzt auf Quelle und Subjekt zurueck', () => {
    const w = world();
    const a = visitor(w, 'Ayla');
    const c = visitor(w, 'Cleo');
    recordFirstHand(w, { actor: ref(a), factId: 9, sentiment: -0.8, tick: 0 });
    const heard = reportKnowledge(w, { from: ref(a), to: ref(c), tick: 2, seed: SEED }, quiet);
    expect(heard).not.toBeNull();

    const toSource = relationshipBetween(w, ref(c), ref(a));
    expect(toSource).not.toBeNull();
    expect(toSource!.trust).toBeGreaterThan(0);
    const toSubject = relationshipBetween(w, ref(c), 'player');
    expect(toSubject).not.toBeNull();
    expect(toSubject!.sympathy).toBeLessThan(0);
    expect(toSubject!.sympathy).toBeGreaterThanOrEqual(-2);
  });

  it('bleibt bei gleichem Seed und gleicher Beziehung deterministisch', () => {
    const build = () => {
      const w = world();
      const a = visitor(w, 'Ayla');
      const c = visitor(w, 'Cleo');
      shift(w, ref(c), ref(a), { trust: 4 }, 0);
      recordFirstHand(w, { actor: ref(a), factId: 12, sentiment: -0.7, tick: 0 });
      const heard = reportKnowledge(w, { from: ref(a), to: ref(c), tick: 3, seed: SEED }, quiet);
      return {
        confidence: heard?.confidence,
        trust: relationshipBetween(w, ref(c), ref(a))?.trust,
        sympathy: relationshipBetween(w, ref(c), 'player')?.sympathy,
      };
    };
    expect(build()).toEqual(build());
  });
});
