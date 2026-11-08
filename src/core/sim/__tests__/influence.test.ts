/**
 * @test-target: src/core/sim/influence.ts
 * @error-code: ERR-1002
 *
 * Einfluss-Matrix: Config-Validierung, Kontexte, Cross-Kanten, Determinismus.
 */
import { describe, expect, it } from 'vitest';
import {
  INFLUENCE_CONFIG,
  evaluateInfluence,
  influenceScore,
  type InfluenceConfig,
  type InfluenceValues,
} from '../influence';

const NEUTRAL: InfluenceValues = { mood: 50, sociability: 50, thirst: 50, rumor: 0 };

function variant(overrides: Partial<InfluenceConfig>): InfluenceConfig {
  return { ...INFLUENCE_CONFIG, ...overrides };
}

describe('Einfluss-Matrix', () => {
  it('gewichtet denselben Zustand je Kontext unterschiedlich', () => {
    const thirsty: InfluenceValues = { mood: 40, sociability: 60, thirst: 95, rumor: 0.4 };
    const bar = evaluateInfluence('bar', thirsty);
    const slot = evaluateInfluence('slot', thirsty);
    expect(bar.triggered).toBe(true);
    expect(slot.triggered).toBe(false);
  });

  it('laesst Zuwendung am Slot wirkungslos, an der Bar aber nicht', () => {
    const sated: InfluenceValues = { mood: 5, sociability: 50, thirst: 5, rumor: 0 };
    const happy: InfluenceValues = { mood: 95, sociability: 50, thirst: 5, rumor: 0 };
    expect(influenceScore('slot', happy)).toBe(influenceScore('slot', sated));
    expect(influenceScore('bar', happy)).toBeGreaterThan(influenceScore('bar', sated));
    const weights = INFLUENCE_CONFIG.contexts.slot!.weights;
    expect(weights.mood).toBe(0);
    expect(weights.thirst).toBe(0);
    expect(weights.sociability).toBe(0);
  });

  it('wendet Cross-Kanten an, bevor gewichtet wird', () => {
    const dry: InfluenceValues = { mood: 50, sociability: 0, thirst: 0, rumor: 0 };
    const thirsty: InfluenceValues = { mood: 50, sociability: 0, thirst: 100, rumor: 0 };
    // Durst senkt die Laune ueber die Kante thirst->mood, obwohl mood unveraendert ist.
    const dryTrace = evaluateInfluence('bar', dry).contributions;
    const thirstyTrace = evaluateInfluence('bar', thirsty).contributions;
    expect(dryTrace[0]).not.toBe(thirstyTrace[0]);
    expect(influenceScore('bar', thirsty)).toBeGreaterThan(influenceScore('bar', dry));
  });

  it('ist deterministisch und liefert einen Factor-Trace', () => {
    const first = evaluateInfluence('bar', NEUTRAL);
    const second = evaluateInfluence('bar', NEUTRAL);
    expect(first.score).toBe(second.score);
    expect(first.contributions).toEqual(second.contributions);
    expect(first.factor.id).toBe('influence_bar');
    expect(first.factor.contributions).toEqual(first.contributions);
    expect(first.triggered).toBe(first.score >= first.threshold);
  });

  it('lehnt unbekannte Kontexte und kaputte Gewichte ab', () => {
    expect(() => evaluateInfluence('nirgendwo', NEUTRAL)).toThrow(/unbekannter Kontext/);
    const badWeight = variant({
      contexts: { bar: { label: 'Bar', weights: { ...INFLUENCE_CONFIG.contexts.bar!.weights, mood: 2 }, threshold: 0.5 } },
    });
    expect(() => evaluateInfluence('bar', NEUTRAL, badWeight)).toThrow(/ungueltig/);
    const badEdge = variant({ cross: [{ from: 'mood', to: 'thirst', weight: -3 }] });
    expect(() => evaluateInfluence('bar', NEUTRAL, badEdge)).toThrow(/Cross-Kante/);
    const badRange = variant({ factors: { ...INFLUENCE_CONFIG.factors, mood: { min: 10, max: 10 } } });
    expect(() => evaluateInfluence('bar', NEUTRAL, badRange)).toThrow(/Wertebereich/);
  });

  it('bleibt ohne Gewicht im Kontext ein Fehler, kein stilles Null-Ergebnis', () => {
    const empty = variant({
      contexts: {
        bar: {
          label: 'Bar',
          weights: { mood: 0, sociability: 0, thirst: 0, rumor: 0 },
          threshold: 0.5,
        },
      },
    });
    expect(() => evaluateInfluence('bar', NEUTRAL, empty)).toThrow(/kein Gewicht/);
  });
});
