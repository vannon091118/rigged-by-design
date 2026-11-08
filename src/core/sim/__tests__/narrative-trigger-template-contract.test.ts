/**
 * @test-target: src/core/sim/narrative/events/trigger-definitions.ts
 * @error-code: ERR-2001
 *
 * C1: Die Spec-Regel „nur triggern, wo ein Template mit Mehrwert existiert“
 * gilt als getesteter Vertrag. Jede Trigger-Definition findet mindestens ein
 * Template, jedes Fact-Template ist an genau eine Definition gebunden, und der
 * Fact-Vertrag enthaelt keine neuen Kinds: Geraete-, Lager- und
 * Personal-Facts bleiben dokumentiert offen.
 */
import { describe, expect, it } from 'vitest';
import { EVENT_TEMPLATES } from '../narrative/events/definitions';
import { ENGINE_DEMAND_TRIGGER, ENGINE_POOL_TRIGGER, FOLLOW_UP_TRIGGER } from '../narrative/events/template-types';
import { EVENT_TRIGGER_DEFINITIONS } from '../narrative/events/trigger-definitions';
import { NARRATIVE_FACT_KINDS } from '../narrative/types';

describe('Trigger-Template-Vertrag (C1)', () => {
  it('laesst jede Trigger-Definition auf mindestens ein Template zeigen', () => {
    expect(EVENT_TRIGGER_DEFINITIONS.length).toBeGreaterThan(0);
    for (const definition of EVENT_TRIGGER_DEFINITIONS) {
      const eventIds = EVENT_TEMPLATES.filter((template) => template.triggerId === definition.id)
        .map((template) => template.eventId);
      expect(eventIds).not.toEqual([]);
    }
  });

  it('bindet jedes Fact-Template an genau eine Trigger-Definition', () => {
    // Folge-Templates haengen an Ketten, Pool- und Demand-Templates an der Engine.
    const factTemplates = EVENT_TEMPLATES.filter((template) => template.triggerId !== ENGINE_DEMAND_TRIGGER
      && template.triggerId !== ENGINE_POOL_TRIGGER && template.triggerId !== FOLLOW_UP_TRIGGER);
    expect(factTemplates.length).toBeGreaterThan(0);
    for (const template of factTemplates) {
      const definitions = EVENT_TRIGGER_DEFINITIONS.filter((definition) => definition.id === template.triggerId);
      expect(definitions).toHaveLength(1);
    }
  });

  it('fuehrt keine neuen Fact-Kinds ein', () => {
    expect([...NARRATIVE_FACT_KINDS].sort()).toEqual([
      'COMMAND_REJECTED', 'EVENT_RESOLVED', 'HOUSE_BALANCE', 'RIVAL_ACTION',
      'RIVAL_ENCOUNTER', 'START_POOL', 'VISITOR_CONFLICT', 'VISITOR_FIRST_SEEN',
      'VISITOR_RETURNED', 'VISITOR_SERVICE', 'VISIT_ENDED',
    ]);
  });
});
