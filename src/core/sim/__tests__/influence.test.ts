/**
 * @test-target: src/core/sim/influence.ts
 * @error-code: ERR-1002
 *
 * Einfluss-Matrix: Config-Validierung, Kontexte, Cross-Kanten, Determinismus,
 * Untereinfluesse und die kontextgebundene Treat-Synergie.
 */
import { describe, expect, it } from 'vitest';
import {
  INFLUENCE_CONFIG,
  evaluateInfluence,
  influenceScore,
  treatInfluence,
  type InfluenceConfig,
  type InfluenceValues,
} from '../influence';
import { RAW_INFLUENCE_MATRIX } from '../influence-matrix';
import { buildInfluenceConfig } from '../influence-schema';

const NEUTRAL: InfluenceValues = {
  mood: 50, sociability: 50, thirst: 50, rumor: 0, trust: 0, sympathy: 0, conflict: 0,
  satisfaction: 0,
};

function variant(overrides: Partial<InfluenceConfig>): InfluenceConfig {
  return { ...INFLUENCE_CONFIG, ...overrides };
}

describe('Einfluss-Matrix', () => {
  it('gewichtet denselben Zustand je Kontext unterschiedlich', () => {
    const thirsty: InfluenceValues = { mood: 40, sociability: 60, thirst: 95, rumor: 0.4, trust: 0, sympathy: 0, conflict: 0 };
    const bar = evaluateInfluence('bar', thirsty);
    const slot = evaluateInfluence('slot', thirsty);
    expect(bar.triggered).toBe(true);
    expect(slot.triggered).toBe(false);
  });

  it('laesst Zuwendung am Slot wirkungslos, an der Bar aber nicht', () => {
    const sated: InfluenceValues = { mood: 5, sociability: 50, thirst: 5, rumor: 0, trust: 0, sympathy: 0, conflict: 0 };
    const happy: InfluenceValues = { mood: 95, sociability: 50, thirst: 5, rumor: 0, trust: 0, sympathy: 0, conflict: 0 };
    expect(influenceScore('slot', happy)).toBe(influenceScore('slot', sated));
    expect(influenceScore('bar', happy)).toBeGreaterThan(influenceScore('bar', sated));
    const weights = INFLUENCE_CONFIG.contexts.slot!.weights;
    expect(weights.mood).toBe(0);
    expect(weights.thirst).toBe(0);
    expect(weights.sociability).toBe(0);
  });

  it('liest genau ein geaendertes Rohgewicht aus der Config-Datei', () => {
    const values: InfluenceValues = { ...NEUTRAL, mood: 90, sociability: 10, thirst: 10 };
    const raw = structuredClone(RAW_INFLUENCE_MATRIX);
    raw.contexts.bar.weights.mood = 0.9;
    const changed = buildInfluenceConfig(raw);
    expect(influenceScore('bar', values, changed)).not.toBe(influenceScore('bar', values));
  });

  it('liest ein geaendertes Kontextgewicht aus der Config', () => {
    const values: InfluenceValues = { ...NEUTRAL, mood: 90, sociability: 10, thirst: 10 };
    const bar = INFLUENCE_CONFIG.contexts.bar!;
    const changed = variant({
      contexts: {
        ...INFLUENCE_CONFIG.contexts,
        bar: { ...bar, weights: { ...bar.weights, mood: 0.9 } },
      },
    });
    expect(influenceScore('bar', values, changed)).not.toBe(influenceScore('bar', values));
  });

  it('liest Grundgewicht und Untereinfluss aus dem Faktor-Katalog', () => {
    const values: InfluenceValues = { ...NEUTRAL, satisfaction: 100 };
    const mood = INFLUENCE_CONFIG.factors.mood;
    const childChanged = variant({
      factors: {
        ...INFLUENCE_CONFIG.factors,
        mood: {
          ...mood,
          children: mood.children.map((child) => (child.id === 'mood.zufriedenheit'
            ? { ...child, weight: 0 } : child)),
        },
      },
    });
    const weightChanged = variant({
      factors: { ...INFLUENCE_CONFIG.factors, mood: { ...mood, baseWeight: 0.5 } },
    });
    const base = influenceScore('bar', values);
    expect(influenceScore('bar', values, childChanged)).not.toBe(base);
    expect(influenceScore('bar', values, weightChanged)).not.toBe(base);
  });

  it('wendet Cross-Kanten an, bevor gewichtet wird', () => {
    const dry: InfluenceValues = { mood: 50, sociability: 0, thirst: 0, rumor: 0, trust: 0, sympathy: 0, conflict: 0 };
    const thirsty: InfluenceValues = { mood: 50, sociability: 0, thirst: 100, rumor: 0, trust: 0, sympathy: 0, conflict: 0 };
    // Durst senkt die Laune ueber die Kante thirst->mood, obwohl mood unveraendert ist.
    const dryTrace = evaluateInfluence('bar', dry).contributions;
    const thirstyTrace = evaluateInfluence('bar', thirsty).contributions;
    expect(dryTrace[0]).not.toBe(thirstyTrace[0]);
    expect(influenceScore('bar', thirsty)).toBeGreaterThan(influenceScore('bar', dry));
  });

  it('macht die Treat-Cross-Kante kontextabhaengig und config-sensitiv', () => {
    const values: InfluenceValues = { ...NEUTRAL, satisfaction: 100 };
    const bar = treatInfluence('bar', values);
    expect(bar).toBeGreaterThan(0);
    expect(treatInfluence('slot', values)).toBe(0);

    const withoutEdge = variant({
      cross: INFLUENCE_CONFIG.cross.filter((edge) => edge.from !== 'satisfaction'),
    });
    expect(treatInfluence('bar', values, withoutEdge)).toBeLessThan(bar);

    const slot = INFLUENCE_CONFIG.contexts.slot!;
    const slotOpen = variant({
      contexts: {
        ...INFLUENCE_CONFIG.contexts,
        slot: { ...slot, weights: { ...slot.weights, mood: 0.3 } },
      },
    });
    expect(treatInfluence('slot', values, slotOpen)).toBeGreaterThan(0);
  });

  it('ist deterministisch und liefert einen Factor-Trace mit Kindern', () => {
    const first = evaluateInfluence('bar', NEUTRAL);
    const second = evaluateInfluence('bar', NEUTRAL);
    expect(first.score).toBe(second.score);
    expect(first.contributions).toEqual(second.contributions);
    expect(first.factor.id).toBe('influence_bar');
    expect(first.factor.category).toBe('MATRIX');
    expect(first.factor.children.length).toBeGreaterThan(0);
    expect(first.factor.contributions).toEqual(first.contributions);
    expect(first.triggered).toBe(first.score >= first.threshold);
  });

  it('lehnt unbekannte Kontexte und kaputte Gewichte ab', () => {
    expect(() => evaluateInfluence('nirgendwo', NEUTRAL)).toThrow(/unbekannter Kontext/);
    const badWeight = variant({
      contexts: { bar: { label: 'Bar', weights: { ...INFLUENCE_CONFIG.contexts.bar!.weights, mood: 2 }, threshold: 0.5 } },
    });
    expect(() => evaluateInfluence('bar', NEUTRAL, badWeight)).toThrow(/Gewicht bar\.mood/);
    const badEdge = variant({ cross: [{ from: 'mood', to: 'thirst', weight: -3 }] });
    expect(() => evaluateInfluence('bar', NEUTRAL, badEdge)).toThrow(/Gewicht mood->thirst/);
    const badRange = variant({ factors: { ...INFLUENCE_CONFIG.factors, mood: { ...INFLUENCE_CONFIG.factors.mood, range: { min: 10, max: 10 } } } });
    expect(() => evaluateInfluence('bar', NEUTRAL, badRange)).toThrow(/Wertebereich/);
  });

  it('koppelt Beziehungen ueber Faktoren und Cross-Kanten an den Score', () => {
    const neutral: InfluenceValues = { ...NEUTRAL, trust: 0, sympathy: 0, conflict: 0 };
    const trusted: InfluenceValues = { ...neutral, trust: 9, sympathy: 6 };
    const hostile: InfluenceValues = { ...neutral, conflict: 9 };
    expect(influenceScore('bar', trusted)).toBeGreaterThan(influenceScore('bar', neutral));
    expect(influenceScore('bar', hostile)).toBeLessThan(influenceScore('bar', neutral));
    const weights = INFLUENCE_CONFIG.contexts.bar!.weights;
    expect(weights.trust).toBeGreaterThan(0);
    // Konflikt wirkt absichtlich nur ueber die Cross-Kante, nicht als eigener Bar-Aufschlag.
    expect(weights.conflict).toBe(0);
    expect(INFLUENCE_CONFIG.cross.some((edge) => edge.from === 'conflict' && edge.to === 'sociability')).toBe(true);
  });

  it('bleibt ohne Gewicht im Kontext ein Fehler, kein stilles Null-Ergebnis', () => {
    const empty = variant({
      contexts: {
        bar: {
          label: 'Bar',
          weights: { mood: 0, sociability: 0, thirst: 0, rumor: 0, trust: 0, sympathy: 0, conflict: 0, satisfaction: 0 },
          threshold: 0.5,
        },
      },
    });
    expect(() => evaluateInfluence('bar', NEUTRAL, empty)).toThrow(/kein Gewicht/);
  });
});
