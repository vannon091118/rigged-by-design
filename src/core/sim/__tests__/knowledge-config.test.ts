/**
 * @test-target: src/core/sim/narrative/knowledge-config.ts
 * @error-code: ERR-2001
 *
 * P-23: Weitergabe und Quellenrang sind balancebar. Die Schwellen liegen in
 * der Influence-Matrix, die Ranggewichte in der Knowledge-Config; keine
 * zweite lokale Kopie und keine hartkodierte Beziehungsformel.
 */
import { describe, expect, it } from 'vitest';
import { INFLUENCE_CONFIG, type InfluenceValues } from '../influence';
import { KNOWLEDGE_CONFIG, validateKnowledgeConfig } from '../narrative/knowledge-config';
import { gossipStanding } from '../narrative/knowledge-gossip';
import { willingToShare } from '../narrative/knowledge-share';
import { shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import { recordVisitor } from '../visitors';

const HIGH: InfluenceValues = {
  mood: 90, sociability: 90, thirst: 0, rumor: 0.8, trust: 8, sympathy: 8, conflict: 0,
};
const LOW: InfluenceValues = {
  mood: 0, sociability: 0, thirst: 100, rumor: -1, trust: -10, sympathy: -10, conflict: 10,
};

describe('Wissens-Config (P-23)', () => {
  it('fuehrt die Weitergabe als zentralen Matrix-Kontext statt als lokale Kopie', () => {
    expect(INFLUENCE_CONFIG.contexts.share?.threshold).toBe(0.38);
    expect(willingToShare(HIGH)).toBe(true);
    expect(willingToShare(LOW)).toBe(false);
  });

  it('macht die Weitergabe ueber eine geaenderte Schwelle balancebar', () => {
    const closed = {
      ...INFLUENCE_CONFIG,
      contexts: {
        ...INFLUENCE_CONFIG.contexts,
        share: { ...INFLUENCE_CONFIG.contexts.share!, threshold: 1 },
      },
    };
    expect(willingToShare(HIGH, closed)).toBe(false);
    expect(willingToShare(HIGH)).toBe(true);
  });

  it('rangiert Quellen ueber konfigurierbare Gossip-Gewichte', () => {
    const world = createWorld('SMALL');
    const visitor = recordVisitor(world, { name: 'Geruecht', persona: 'STREET', tick: 0 });
    const ref = `visitor:${visitor.id}` as const;
    shift(world, ref, 'player', { trust: 2, sympathy: 2, conflict: 2 }, 0);
    expect(gossipStanding(world, ref, 'player')).toBe(2);
    const withoutConflict = { ...KNOWLEDGE_CONFIG, gossip: { trust: 1, sympathy: 1, conflict: 0 } };
    expect(gossipStanding(world, ref, 'player', withoutConflict)).toBe(4);
  });

  it('weist ein Gossip-Gewicht ausserhalb der Grenze fail-closed ab', () => {
    expect(() => validateKnowledgeConfig({
      ...KNOWLEDGE_CONFIG,
      gossip: { trust: 6, sympathy: 1, conflict: 1 },
    })).toThrow('Geruechtegewicht');
  });
});
