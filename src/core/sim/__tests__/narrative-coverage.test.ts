/**
 * @test-target: src/core/sim/narrative/composer/index.ts
 * @error-code: ERR-4022
 *
 * B4: Jedes stabile Template muss `TITLE`, `BODY` und jedes angebotene
 * Choice-Label aus echten Fragmenten besetzen. `OUTCOME` bleibt bewusst beim
 * Content-Batch D1 und wird hier nicht verlangt.
 */
import { describe, expect, it } from 'vitest';
import { composeNarrative } from '../narrative/composer';
import { EVENT_TEMPLATES } from '../narrative/events/definitions';
import type { ChoiceRequirement, EventTemplate } from '../narrative/events/template-types';

/** Dieselbe Ableitung wie `composition-context.ts`, ohne Welt und Fact. */
function requiredFlagsOf(template: EventTemplate): string[] {
  const flags = new Set<string>();
  const visit = (requirements: readonly ChoiceRequirement[]): void => {
    for (const requirement of requirements) {
      if (requirement.op === 'flag-at-least' || requirement.op === 'flag-present') {
        flags.add(requirement.flag);
      } else if (requirement.op === 'all') {
        visit(requirement.requirements);
      }
    }
  };
  for (const choice of template.choices) visit(choice.requirements);
  return [...flags];
}

function composeTemplate(template: EventTemplate, contexts?: readonly string[]) {
  const slotContexts = template.contentSlots.flatMap((slot) => slot.requiredContexts ?? []);
  return composeNarrative({
    locale: 'de',
    slots: template.contentSlots,
    contexts: contexts ?? [...new Set(slotContexts)],
    requiredFlags: requiredFlagsOf(template),
  });
}

describe('Narrative Template-Abdeckung (B4)', () => {
  it('besetzt Titel, Text und jedes angebotene Choice-Label ohne Fallback', () => {
    expect(EVENT_TEMPLATES.length).toBeGreaterThanOrEqual(5);
    for (const template of EVENT_TEMPLATES) {
      const result = composeTemplate(template);
      const covered = result.slots.filter((slot) => slot.kind !== 'OUTCOME');
      expect(result.ok).toBe(true);
      expect(covered).toHaveLength(template.contentSlots.filter((slot) => slot.kind !== 'OUTCOME').length);
      expect(covered.filter((slot) => slot.fallback || slot.contributionId === null)).toEqual([]);
      expect(covered.every((slot) => slot.text.length > 0)).toBe(true);
    }
  });

  it('meldet fehlenden Content weiterhin als Fallback statt als Abdeckung', () => {
    const template = EVENT_TEMPLATES.find((entry) => entry.eventId === 'VISITOR_CONFLICT');
    if (!template) throw new Error('VISITOR_CONFLICT fehlt');
    const result = composeTemplate(template, ['kein-treffer']);
    expect(result.ok).toBe(true);
    expect(result.fallbacks).toEqual(template.contentSlots.map((slot) => slot.id));
    expect(result.degraded).toBe(true);
  });
});
