/**
 * @test-target: src/core/sim/narrative/fact-schema.ts
 * @error-code: ERR-2001
 *
 * Neue Beziehungs-Facts tragen ActorRefs statt einer Pflicht-visitorId.
 * Das Laden akzeptiert sie und verwirft falsche Rollen- oder Rivalenbezüge.
 */
import { describe, expect, it } from 'vitest';
import { isFact } from '../narrative/fact-schema';
import { normalizeNarrativeState } from '../narrative/state';

const base = { id: 1, tick: 0, day: 0 } as const;

describe('Narrative Fact-Schema', () => {
  it('akzeptiert Konflikt, Service und Rivalenbegegnung ohne visitorId', () => {
    expect(isFact({
      ...base, kind: 'VISITOR_CONFLICT',
      actorRefs: ['visitor:1', 'visitor:2'], initiator: 'visitor:1', severity: 1,
    })).toBe(true);
    expect(isFact({
      ...base, kind: 'VISITOR_SERVICE',
      actorRefs: ['visitor:1', 'staff:7'], service: 'CASHIER', valence: 'GOOD',
    })).toBe(true);
    expect(isFact({
      ...base, kind: 'RIVAL_ENCOUNTER',
      actorRefs: ['rival:HAFENKLAUSE', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: -1000,
    })).toBe(true);
  });

  it('lädt die neuen Facts aus einem Save ohne visitorId', () => {
    const state = normalizeNarrativeState({
      factSeq: 4, processedId: 0, pending: [
        { ...base, kind: 'VISITOR_CONFLICT', actorRefs: ['visitor:1', 'visitor:2'], initiator: 'visitor:2', severity: 2 },
        { ...base, id: 2, kind: 'VISITOR_SERVICE', actorRefs: ['visitor:1', 'staff:7'], service: 'CASHIER', valence: 'BAD' },
        { ...base, id: 3, kind: 'RIVAL_ENCOUNTER', actorRefs: ['rival:GOLDENE_HAND', 'player'], rivalId: 'GOLDENE_HAND', netToHouse: 500 },
      ],
    });
    expect(state.pending.map((fact) => fact.kind)).toEqual([
      'VISITOR_CONFLICT', 'VISITOR_SERVICE', 'RIVAL_ENCOUNTER',
    ]);
  });

  it('verwirft falsche Rollen, Selbstbezug und nicht passende Rivalenreferenzen', () => {
    expect(isFact({
      ...base, kind: 'VISITOR_CONFLICT',
      actorRefs: ['visitor:1', 'staff:2'], initiator: 'visitor:1', severity: 1,
    })).toBe(false);
    expect(isFact({
      ...base, kind: 'VISITOR_CONFLICT',
      actorRefs: ['visitor:1', 'visitor:1'], initiator: 'visitor:1', severity: 1,
    })).toBe(false);
    expect(isFact({
      ...base, kind: 'VISITOR_SERVICE',
      actorRefs: ['visitor:1', 'player'], service: 'CASHIER', valence: 'GOOD',
    })).toBe(false);
    expect(isFact({
      ...base, kind: 'RIVAL_ENCOUNTER',
      actorRefs: ['rival:GOLDENE_HAND', 'player'], rivalId: 'HAFENKLAUSE', netToHouse: 500,
    })).toBe(false);
  });
});
