/**
 * @test-target: src/core/sim/narrative/knowledge.ts
 * @error-code: ERR-2001
 *
 * Vier NPCs, ein Fakt, vier Zustaende: direkte Sicht, eigenes Geraeusch,
 * Weitergabe und Weitergabe mit Misstrauen. Dazu Alterung, Widerspruch und
 * die matrixgesteuerte Bereitschaft, ueberhaupt zu erzaehlen.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { KNOWLEDGE_CONFIG, type KnowledgeConfig } from '../narrative/knowledge-config';
import {
  ageKnowledge, contradictionsAbout, entriesAbout, recordFirstHand, recordSighting,
  reportKnowledge, rumorAbout,
} from '../narrative/knowledge';
import { willingToShare } from '../narrative/knowledge-share';
import { shift } from '../narrative/relationships';
import { createWorld } from '../templates';
import { makeGuest } from '../traits';
import type { Guest, WorldState } from '../types';
import { recordVisitor } from '../visitors';

const SEED = 20261108;
const quiet: KnowledgeConfig = {
  ...KNOWLEDGE_CONFIG,
  distance: { ...KNOWLEDGE_CONFIG.distance, lossPerStep: 0, distortionPerStep: 0 },
};

const world = (): WorldState => createWorld('SMALL');
const ref = (id: number): `visitor:${number}` => `visitor:${id}`;

function visitor(w: WorldState, name: string): number {
  return recordVisitor(w, { name, persona: 'STAMMGAST', tick: 0 }).id;
}

function guestFor(w: WorldState, visitorId: number): Guest {
  const guest = makeGuest({ id: visitorId, persona: 'STAMMGAST', prng: new Prng(SEED), spawn: { x: 2, y: 13 } });
  guest.visitorId = visitorId;
  guest.state = 'CHOOSE';
  w.guests.push(guest);
  return guest;
}

describe('Wissensdomäne', () => {
  it('erzeugt eine Sicht nur bei tatsaechlicher Anwesenheit', () => {
    const w = world();
    const a = visitor(w, 'Ayla');
    expect(recordSighting(w, {
      actor: ref(a), factId: 1, sentiment: -0.7, channel: 'SICHT', quality: 0.8, tick: 0,
    })).toBeNull();
    expect(w.narrative.observations).toHaveLength(0);

    guestFor(w, a);
    const seen = recordSighting(w, {
      actor: ref(a), factId: 1, sentiment: -0.7, channel: 'SICHT', quality: 0.8, tick: 0,
    });
    expect(seen).not.toBeNull();
    expect(seen!.sourceKind).toBe('GESEHEN');
    expect(seen!.confidence).toBe(0.8);
    expect(w.narrative.observations).toHaveLength(1);
    expect(w.narrative.observations[0]!.channel).toBe('SICHT');
  });

  it('gibt vier NPCs nach demselben Fakt vier verschiedene Zustaende', () => {
    const w = world();
    const a = visitor(w, 'Ayla');
    const b = visitor(w, 'Benno');
    const c = visitor(w, 'Cleo');
    const d = visitor(w, 'Dario');
    guestFor(w, a);
    guestFor(w, b);
    const factId = 42;

    const direct = recordFirstHand(w, { actor: ref(a), factId, sentiment: -0.8, tick: 0 });
    const noise = recordSighting(w, {
      actor: ref(b), factId, sentiment: -0.7, channel: 'GERAEUSCH', quality: 0.6, tick: 0,
    });
    const second = reportKnowledge(w, { from: ref(b), to: ref(c), tick: 1, seed: SEED }, quiet);
    shift(w, ref(d), ref(c), { trust: 0, sympathy: 0, conflict: 5, influence: 0 }, 1);
    const third = reportKnowledge(w, { from: ref(c), to: ref(d), tick: 2, seed: SEED }, quiet);

    expect(direct).not.toBeNull();
    expect(noise).not.toBeNull();
    expect(second).not.toBeNull();
    expect(third).not.toBeNull();
    expect(direct!.confidence).toBe(1);
    expect(noise!.confidence).toBe(0.6);
    expect(second!.confidence).toBeLessThan(noise!.confidence);
    expect(third!.confidence).toBeLessThan(second!.confidence);

    // Herkunft bleibt rekonstruierbar: Benno hoerte selbst, Cleo und Dario nur weiter.
    expect(second!.originActor).toBe(ref(b));
    expect(second!.sourceActor).toBe(ref(b));
    expect(second!.distance).toBe(1);
    expect(third!.originActor).toBe(ref(b));
    expect(third!.sourceActor).toBe(ref(c));
    expect(third!.distance).toBe(2);

    const states = [direct!, noise!, second!, third!].map((entry) => entry.confidence.toFixed(4));
    expect(new Set(states).size).toBe(4);
    expect(new Set([direct!.actor, noise!.actor, second!.actor, third!.actor]).size).toBe(4);
  });

  it('bewahrt widerspruechliche Quellen statt sie zu ueberschreiben', () => {
    const w = world();
    const a = visitor(w, 'Ayla');
    const e = visitor(w, 'Emil');
    const c = visitor(w, 'Cleo');
    recordFirstHand(w, { actor: ref(a), factId: 7, sentiment: -0.8, tick: 0 });
    recordFirstHand(w, { actor: ref(e), factId: 7, sentiment: 0.8, tick: 0 });
    const negative = reportKnowledge(w, { from: ref(a), to: ref(c), tick: 1, seed: 11 }, quiet);
    const positive = reportKnowledge(w, { from: ref(e), to: ref(c), tick: 1, seed: 12 }, quiet);

    expect(negative).not.toBeNull();
    expect(positive).not.toBeNull();
    expect(entriesAbout(w, ref(c))).toHaveLength(2);
    expect(contradictionsAbout(w, ref(c))).toHaveLength(1);
    expect(rumorAbout(w, ref(c))).toBeCloseTo(0, 5);
  });

  it('altert deterministisch, einmal je Tick und monoton', () => {
    const build = () => {
      const w = world();
      const a = visitor(w, 'Ayla');
      recordFirstHand(w, { actor: ref(a), factId: 3, sentiment: -0.6, tick: 0 });
      const before = w.narrative.knowledge[0]!.confidence;
      ageKnowledge(w, 20);
      return { w, before, after: w.narrative.knowledge[0]!.confidence };
    };
    const first = build();
    const second = build();
    expect(first.after).toBeLessThan(first.before);
    expect(first.after).toBeCloseTo(0.8, 5);
    expect(first.after).toBe(second.after);

    const again = ageKnowledge(first.w, 20);
    expect(again).toBe(0);
    expect(first.w.narrative.knowledge[0]!.confidence).toBe(first.after);
  });

  it('laesst die Matrix entscheiden, ob jemand ueberhaupt erzaehlt', () => {
    expect(willingToShare({ mood: 0, sociability: 0, thirst: 0, rumor: 0, trust: 0, sympathy: 0, conflict: 0 })).toBe(false);
    expect(willingToShare({ mood: 100, sociability: 100, thirst: 0, rumor: 0, trust: 0, sympathy: 0, conflict: 0 })).toBe(true);

    const w = world();
    const a = visitor(w, 'Ayla');
    const c = visitor(w, 'Cleo');
    recordFirstHand(w, { actor: ref(a), factId: 4, sentiment: -0.8, tick: 0 });
    const refused = reportKnowledge(w, {
      from: ref(a), to: ref(c), tick: 1, seed: SEED,
      speaker: { mood: 0, sociability: 0, thirst: 0, rumor: 0 },
    }, quiet);
    expect(refused).toBeNull();
    expect(w.narrative.knowledge.some((entry) => entry.actor === ref(c))).toBe(false);

    const shared = reportKnowledge(w, {
      from: ref(a), to: ref(c), tick: 1, seed: SEED,
      speaker: { mood: 100, sociability: 100, thirst: 0, rumor: 0 },
    }, quiet);
    expect(shared).not.toBeNull();
  });
});
