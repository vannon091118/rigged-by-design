/**
 * @test-target: scripts/lib/narrative-blocks.mjs
 * @error-code: ERR-4022
 *
 * Quality-First: Der Bestand wird nicht nach Poolgroesse, sondern nach
 * tatsaechlicher Verwendung und Funktion geprueft. Der Test misst exakte und
 * nahe Duplikate mit nachvollziehbarer Schwelle, verbietet austauschbare
 * Standardenden, verlangt fuer jeden Pool einen belegten Consumer und prueft
 * die Bindung der Template-Kontexte an das kontrollierte Vokabular.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { poolReport } from '../../../../scripts/lib/narrative-blocks.mjs';
import { EVENT_TEMPLATES } from '../../sim/narrative/events/definitions';

const ROOT = resolve(process.cwd());
const NEAR_DUPLICATE_THRESHOLD = 0.75;
const CANNED = /die spannung bleibt im raum stehen|der abend nimmt seinen lauf|die nacht ist jung/i;

interface Fragment {
  readonly contributionId: string;
  readonly slot: string;
  readonly text: string;
  readonly contexts: readonly string[];
}

interface Classification {
  readonly slots: Record<string, string>;
  readonly composerSlots: Record<string, readonly string[]>;
  readonly contexts: Record<string, string>;
  readonly nonComposableSlots: readonly string[];
}

const registry = JSON.parse(
  readFileSync(join(ROOT, 'content/narrative/registry/fragments.json'), 'utf8'),
) as { fragments: Fragment[] };
const classification = JSON.parse(
  readFileSync(join(ROOT, 'content/narrative/vocabulary/classification.json'), 'utf8'),
) as Classification;
const fragments = registry.fragments;

/** Jeder Pool hat genau eine Stelle, die ihn liest; `null` ist ein belegter Befund. */
const CONSUMERS: Readonly<Record<string, string | null>> = {
  opening: 'src/core/sim/narrative/composer/select.ts',
  description: 'src/core/sim/narrative/composer/select.ts',
  'event-body': 'src/core/sim/narrative/composer/select.ts',
  'choice-preview': 'src/core/sim/narrative/composer/select.ts',
  reaction: 'src/core/sim/narrative/composer/select.ts',
  'city-scene': 'src/core/sim/city-model.ts',
  'city-night': 'src/core/sim/city-model.ts',
  'guest-voice-low': 'src/core/sim/narrative/guest-voice.ts',
  'guest-voice-mid': 'src/core/sim/narrative/guest-voice.ts',
  'guest-voice-high': 'src/core/sim/narrative/guest-voice.ts',
  // Bewusst kein Spieltext beziehungsweise noch kein Leser; siehe P-14.
  documentation: null,
  memory: null,
  rumor: null,
};

const tokensOf = (text: string): readonly string[] => text.toLocaleLowerCase('de')
  .replace(/[^a-z0-9äöüß]+/g, ' ').trim().split(' ').filter(Boolean);

function shingles(text: string): ReadonlySet<string> {
  const tokens = tokensOf(text);
  const grams = new Set<string>();
  for (let index = 0; index + 2 < tokens.length; index += 1) {
    grams.add(`${tokens[index]} ${tokens[index + 1]} ${tokens[index + 2]}`);
  }
  return grams;
}

function jaccard(left: ReadonlySet<string>, right: ReadonlySet<string>): number {
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** O(n^2) ist bei unter 1000 Fragmenten billig und dient als redaktioneller Befund. */
function nearDuplicates(threshold: number): readonly string[] {
  const grams = fragments.map((fragment) => shingles(fragment.text));
  const found: string[] = [];
  for (let left = 0; left < fragments.length; left += 1) {
    for (let right = left + 1; right < fragments.length; right += 1) {
      const score = jaccard(grams[left]!, grams[right]!);
      if (score >= threshold) {
        found.push(`${fragments[left]!.contributionId} ~ ${fragments[right]!.contributionId} (${score.toFixed(2)})`);
      }
    }
  }
  return found;
}

describe('Narrative Content Quality', () => {
  it('hat keine exakten Textduplikate', () => {
    expect(poolReport(fragments).duplicates).toEqual([]);
  });

  it('verbietet austauschbare Standardenden statt sie als Inhalt zu zaehlen', () => {
    const canned = fragments.filter((fragment) => CANNED.test(fragment.text))
      .map((fragment) => fragment.contributionId);
    expect(canned).toEqual([]);
  });

  it('meldet Near-Duplicates ab der dokumentierten Schwelle statt sie still zu dulden', () => {
    expect(nearDuplicates(NEAR_DUPLICATE_THRESHOLD)).toEqual([]);
  });

  it('gibt jedem Pool einen belegten Consumer oder einen ausdruecklichen Befund', () => {
    expect(Object.keys(CONSUMERS).sort()).toEqual(Object.keys(classification.slots).sort());
    const unwired = Object.entries(CONSUMERS).filter(([, file]) => file === null)
      .map(([slot]) => slot).sort();
    expect(unwired).toEqual(['documentation', 'memory', 'rumor']);
    for (const file of Object.values(CONSUMERS)) {
      if (file !== null) expect(existsSync(join(ROOT, file)), file).toBe(true);
    }
  });

  it('bindet jeden Template-Slot an einen komponierbaren Slot und ein bekanntes Vokabular', () => {
    for (const template of EVENT_TEMPLATES) {
      for (const slot of template.contentSlots) {
        const sources = classification.composerSlots[slot.kind];
        expect(sources?.length ?? 0, `${template.eventId}:${slot.id}`).toBeGreaterThan(0);
        for (const context of slot.requiredContexts ?? []) {
          expect(Object.hasOwn(classification.contexts, context), `${template.eventId}:${slot.id}:${context}`).toBe(true);
        }
      }
    }
  });

  it('haelt nicht komponierbare Pools aus dem Composer heraus', () => {
    const composerSources = new Set(Object.values(classification.composerSlots).flat());
    for (const slot of classification.nonComposableSlots) expect(composerSources.has(slot)).toBe(false);
    expect(fragments.filter((fragment) => classification.nonComposableSlots.includes(fragment.slot)).length)
      .toBeGreaterThan(0);
  });
});
