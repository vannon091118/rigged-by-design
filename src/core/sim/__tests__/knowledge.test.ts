/**
 * @test-target: src/core/sim/narrative/knowledge.ts
 * @error-code: ERR-2001
 *
 * Wissenskette: Nur Erlebtes/Gesehenes/Gehoertes/Gelesenes darf berichtet werden.
 * Quellengewicht folgt der Beziehung, Distanz kostet deterministisch Substanz,
 * und das Gehoerte verschiebt eine echte Gastentscheidung.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { chooseActivity } from '../guest-choice';
import { guestAccount } from '../money';
import {
  KNOWLEDGE_CONFIG, knowledgeRisk, sourceWeightOf, validateKnowledgeConfig,
  type KnowledgeConfig,
} from '../narrative/knowledge-config';
import { ageKnowledge, recordFirstHand, reportKnowledge, rumorAbout } from '../narrative/knowledge';
import { relationshipBetween, shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import { makeGuest } from '../traits';
import type { Guest, WorldState } from '../types';
import { recordVisitor } from '../visitors';

const SEED = 20261108;
const quiet: KnowledgeConfig = {
  ...KNOWLEDGE_CONFIG,
  distance: { ...KNOWLEDGE_CONFIG.distance, lossPerStep: 0, distortionPerStep: 0 },
};

function world(): WorldState {
  return createWorld('SMALL');
}

describe('Wissenskette', () => {
  it('lehnt Berichte ohne eigene Erfahrung fail-closed ab', () => {
    const w = world();
    expect(() => reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 0, seed: SEED }))
      .toThrow(/kein Wissen/);
    recordFirstHand(w, { actor: 'visitor:1', factId: 1, sentiment: -0.8, tick: 0 });
    expect(() => reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 0, seed: SEED, entryId: 999 }))
      .toThrow(/kein Wissen/);
    const heard = reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 1, seed: SEED }, quiet);
    expect(heard).not.toBeNull();
    expect(heard!.actor).toBe('visitor:2');
    expect(heard!.sourceActor).toBe('visitor:1');
    expect(heard!.distance).toBe(1);
    expect(heard!.sourceKind).toBe('GEHOERT');
  });

  it('wiegt eine enge Bezugsperson schwerer als einen Fremden', () => {
    const w = world();
    shift(w, 'visitor:9', 'visitor:1', { trust: 9, sympathy: 6, influence: 4 }, 0);
    const close = relationshipBetween(w, 'visitor:9', 'visitor:1');
    expect(close).not.toBeNull();
    const fromMother = sourceWeightOf(KNOWLEDGE_CONFIG, 'GEHOERT', close);
    const fromStranger = sourceWeightOf(KNOWLEDGE_CONFIG, 'GEHOERT', null);
    expect(fromMother).toBeGreaterThan(fromStranger);
    expect(fromStranger).toBe(KNOWLEDGE_CONFIG.sourceWeight.GEHOERT);
    expect(fromMother).toBeLessThanOrEqual(1);
  });

  it('verliert und verdreht mit steigender Distanz, seedfest', () => {
    const risk = knowledgeRisk(KNOWLEDGE_CONFIG, 1);
    const far = knowledgeRisk(KNOWLEDGE_CONFIG, 3);
    expect(risk.loss).toBeLessThan(far.loss);
    expect(risk.distortion).toBeLessThan(far.distortion);

    const build = () => {
      const w = world();
      recordFirstHand(w, { actor: 'visitor:1', factId: 7, sentiment: -0.9, tick: 0 });
      const first = reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 1, seed: SEED }, quiet);
      const second = first ? reportKnowledge(w, { from: 'visitor:2', to: 'visitor:3', tick: 2, seed: SEED }, quiet) : null;
      return { w, first, second };
    };
    const a = build();
    const b = build();
    expect(a.first?.confidence).toBe(b.first?.confidence);
    expect(a.second?.confidence).toBe(b.second?.confidence);
    expect(a.first).not.toBeNull();
    expect(a.second).not.toBeNull();
    expect(a.second!.confidence).toBeLessThan(a.first!.confidence);
    expect(a.second!.distance).toBe(2);
  });

  it('verdreht eine Aussage deterministisch statt sie still zu bestaetigen', () => {
    const loud: KnowledgeConfig = {
      ...KNOWLEDGE_CONFIG,
      distance: { ...KNOWLEDGE_CONFIG.distance, lossPerStep: 0, distortionPerStep: 0.5 },
    };
    const w = world();
    recordFirstHand(w, { actor: 'visitor:1', factId: 11, sentiment: -0.9, tick: 0 });
    let flipped = null as ReturnType<typeof reportKnowledge>;
    for (let seed = 1; seed <= 64 && !flipped; seed += 1) {
      const heard = reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 1, seed }, loud);
      if (heard && heard.sentiment > 0) flipped = heard;
    }
    expect(flipped).not.toBeNull();
    expect(rumorAbout(w, 'visitor:2')).toBeGreaterThan(0);
  });

  it('validiert die Config fail-closed', () => {
    const badWeight = { ...KNOWLEDGE_CONFIG, sourceWeight: { ...KNOWLEDGE_CONFIG.sourceWeight, GEHOERT: 2 } };
    expect(() => validateKnowledgeConfig(badWeight)).toThrow(/Quellengewicht/);
    const badDistance = { ...KNOWLEDGE_CONFIG, distance: { ...KNOWLEDGE_CONFIG.distance, maxDistance: 0 } };
    expect(() => validateKnowledgeConfig(badDistance)).toThrow(/maxDistance/);
    const badDecay = { ...KNOWLEDGE_CONFIG, distance: { ...KNOWLEDGE_CONFIG.distance, confidenceDecay: -1 } };
    expect(() => validateKnowledgeConfig(badDecay)).toThrow(/Distanzwert/);
    const badConfidence = { ...KNOWLEDGE_CONFIG, limits: { ...KNOWLEDGE_CONFIG.limits, minConfidence: 2 } };
    expect(() => validateKnowledgeConfig(badConfidence)).toThrow(/minConfidence/);
  });

  it('verschiebt ueber das Gehoerte eine echte Bar-Entscheidung', () => {
    const w = world();
    const ledger = new Ledger();
    const bad = recordVisitor(w, { name: 'Bela', persona: 'STAMMGAST', tick: 0 });
    const neutral = recordVisitor(w, { name: 'Nina', persona: 'STAMMGAST', tick: 0 });
    recordFirstHand(w, { actor: `visitor:${bad.id}`, factId: 21, sentiment: -1, tick: 0 });
    expect(rumorAbout(w, `visitor:${bad.id}`)).toBeLessThan(0);
    expect(rumorAbout(w, `visitor:${neutral.id}`)).toBe(0);

    const bar = w.furniture.find((item) => item.kind === 'BAR')!;
    bar.stock = 4;

    const guestFor = (id: number, visitorId: number): Guest => {
      const guest = makeGuest({ id, persona: 'STAMMGAST', prng: new Prng(SEED), spawn: { x: 2, y: 13 } });
      guest.visitorId = visitorId;
      guest.mood = 43;
      guest.patience = 80;
      guest.sociability = 50;
      guest.addiction = 10;
      guest.thirst = 10;
      guest.bladder = 5;
      guest.need = 'play';
      ledger.transfer('EXTERNAL_WORLD', guestAccount(id), fromVC(5), 'test chips', 0);
      return guest;
    };
    const withRumor = guestFor(1, bad.id);
    const control = guestFor(2, neutral.id);
    chooseActivity(w, control, ledger, new Prng(SEED));
    chooseActivity(w, withRumor, ledger, new Prng(SEED));
    expect(control.state).toBe('DRINK');
    expect(withRumor.state).not.toBe('DRINK');
  });

  it('laesst eigene Erfahrung altern, aber nicht unter die Untergrenze fallen', () => {
    const w = world();
    recordFirstHand(w, { actor: 'visitor:1', factId: 31, sentiment: -0.8, tick: 0 });

    const dropped = ageKnowledge(w, 600);

    expect(dropped).toBe(0);
    expect(w.narrative.knowledge).toHaveLength(1);
    expect(w.narrative.knowledge[0]).toMatchObject({ sourceKind: 'ERLEBT', confidence: 0.5, distance: 0 });
    expect(rumorAbout(w, 'visitor:1')).toBeLessThan(0);
  });

  it('laesst gehoertes Wissen weiter altern und unter der Mindestkonfidenz fallen', () => {
    const w = world();
    recordFirstHand(w, { actor: 'visitor:1', factId: 32, sentiment: -0.8, tick: 0 });
    expect(reportKnowledge(w, { from: 'visitor:1', to: 'visitor:2', tick: 1, seed: SEED }, quiet)).not.toBeNull();

    const dropped = ageKnowledge(w, 600);

    expect(dropped).toBeGreaterThan(0);
    expect(w.narrative.knowledge.some((entry) => entry.actor === 'visitor:2')).toBe(false);
  });
});
