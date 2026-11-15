/**
 * @test-target: src/core/sim/narrative/hot-event-score.ts
 * @error-code: ERR-2001
 *
 * Der Hot-Event-Score ist eine reine Ableitung: Alltag bleibt unter der
 * Schwelle, belegte Konflikte kommen darueber, derselbe Zustand ergibt
 * denselben Score, und ein Fact loest hoechstens einen Ausloeser aus.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../../economy/ledger';
import { createWorld } from '../../templates';
import type { WorldState } from '../../types';
import { emitFact } from '../facts';
import { HOT_EVENT_CONFIG, validateHotEventConfig } from '../hot-event-config';
import {
  HOT_EVENT_ID, hotEventCandidates, hotEventScore, hotEventTriggers, scheduleHotEvents,
} from '../hot-event-score';
import { processNarrativeRuntime } from '../runtime';
import type { NarrativeFact } from '../types';

function lastFact(world: WorldState): NarrativeFact {
  const fact = world.narrative.pending[world.narrative.pending.length - 1];
  if (!fact) throw new Error('Der Test hat keinen Fact erzeugt.');
  return fact;
}

function conflictWorld(): { readonly world: WorldState; readonly fact: NarrativeFact } {
  const world = createWorld('SMALL');
  emitFact(world, {
    kind: 'VISITOR_CONFLICT',
    actorRefs: ['visitor:1', 'visitor:2'],
    initiator: 'visitor:1',
    severity: 2,
  });
  return { world, fact: lastFact(world) };
}

describe('Hot-Event-Score (#806)', () => {
  it('laesst einen niedrigreichweitigen Alltag-Fact unter der Schwelle', () => {
    const world = createWorld('SMALL');
    emitFact(world, { kind: 'VISITOR_RETURNED', visitorId: 1, visits: 2 });
    const score = hotEventScore(world, lastFact(world));

    expect(score.hot).toBe(false);
    expect(score.total).toBeLessThan(score.threshold);
    expect(score.contributions.map((entry) => entry.factor)).not.toContain('conflict');
  });

  it('hebt einen belegten Streit ueber die Schwelle und erklaert jeden Punkt', () => {
    const { world, fact } = conflictWorld();
    const score = hotEventScore(world, fact);

    expect(score.hot).toBe(true);
    expect(score.total).toBeGreaterThanOrEqual(score.threshold);
    expect(score.contributions.map((entry) => entry.factor)).toContain('conflict');
    expect(score.contributions.some((entry) => entry.reason.includes('Severity 2'))).toBe(true);
    const sum = score.contributions.reduce((total, entry) => total + entry.points, 0);
    expect(Math.round(sum * 1000) / 1000).toBe(score.total);
    expect(score.contributions.every((entry) => entry.reason.length > 0)).toBe(true);
  });

  it('liefert bei gleichem Zustand und Fact denselben Score', () => {
    const { world, fact } = conflictWorld();
    expect(hotEventScore(world, fact)).toEqual(hotEventScore(world, fact));
  });

  it('loest pro Fact hoechstens eine Instanz aus und behaelt die Fact-Referenz', () => {
    const { world, fact } = conflictWorld();
    const created = scheduleHotEvents(world, [fact]);

    expect(created).toHaveLength(1);
    expect(created[0]!.eventId).toBe(HOT_EVENT_ID);
    expect(created[0]!.sourceFactId).toBe(fact.id);
    expect(scheduleHotEvents(world, [fact])).toHaveLength(0);
    expect(hotEventTriggers(world)).toHaveLength(1);
  });

  it('gehorcht einer geaenderten Schwelle ohne Sonderlogik im Scheduler', () => {
    const { world, fact } = conflictWorld();
    const strict = { ...HOT_EVENT_CONFIG, thresholds: {}, defaultThreshold: 99 };

    expect(hotEventCandidates(world, [fact], strict)).toHaveLength(0);
    expect(hotEventCandidates(world, [fact])).toHaveLength(1);
  });

  it('weist ungueltige Konfigurationen ab, statt sie still zu schlucken', () => {
    expect(validateHotEventConfig({ weights: { reach: -1 } }).ok).toBe(false);
    expect(validateHotEventConfig({ thresholds: { UNBEKANNT: 3 } }).ok).toBe(false);
    expect(validateHotEventConfig({ noveltySaturation: 0 }).ok).toBe(false);
    expect(validateHotEventConfig(HOT_EVENT_CONFIG).ok).toBe(true);
  });

  it('plant den Ausloeser im echten Fact-Lauf der Runtime', () => {
    const { world, fact } = conflictWorld();
    processNarrativeRuntime(world, new Ledger());

    const trigger = hotEventTriggers(world).find((event) => event.sourceFactId === fact.id) ?? null;
    expect(trigger?.eventId ?? '').toBe(HOT_EVENT_ID);
    expect(trigger?.participants ?? ['?']).toEqual([]);
  });
});
