/**
 * @test-target: scripts/lib/narrative-content.mjs
 * @error-code: ERR-4019
 *
 * Zwei Lanes, zwei Beitraege, ein Main: dieser Lauf belegt den serialisierten
 * Integrationspfad aus #629 reproduzierbar, ohne Netz und ohne echte Branches.
 * Er zieht genau die Grenze, die das Ticket verlangt:
 * - Nach der Integration beider Beitraege enthaelt die neu erzeugte Registry
 *   beide Fragmente; die Registry der ersten Lane ist dann nachweisbar veraltet.
 * - Manifest und Inbox bleiben paritaetisch: jeder Beitrag genau ein Turn.
 * - Generierte Konflikte verlangen einen Rebase mit Regeneration, sie werden
 *   nie als Handkonflikt verhandelt.
 */
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assessIntegration, INTEGRATION } from '../../../../scripts/lib/integration.mjs';
import { renderRegistry, validateCompiledRegistry } from '../../../../scripts/lib/narrative-compiler.mjs';
import { loadNarrativeSources } from '../../../../scripts/lib/narrative-content.mjs';

interface Lane {
  readonly slug: string;
  readonly at: string;
  readonly contexts: readonly string[];
  readonly text: string;
}

interface Compiled {
  readonly registry: {
    readonly fragments: readonly { readonly contributionId: string }[];
    readonly contentHash: string;
  };
  readonly text: string;
  readonly contributions: readonly unknown[];
  readonly manifest: { readonly turns: readonly unknown[] };
}

const VOCABULARY = resolve(process.cwd(), 'content', 'narrative', 'vocabulary');

/** Leerer, aber schema-treuer Ausgangsstand: nur Vokabular und ein leeres Manifest. */
const fixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-narrative-'));
  const narrative = join(root, 'content', 'narrative');
  for (const folder of ['contributions', 'vocabulary', 'turns']) {
    mkdirSync(join(narrative, folder), { recursive: true });
  }
  for (const file of ['classification.json', 'flags.json']) {
    copyFileSync(join(VOCABULARY, file), join(narrative, 'vocabulary', file));
  }
  writeFileSync(join(narrative, 'turns', 'manifest.json'), `${JSON.stringify({ version: 1, turns: [] }, null, 2)}\n`);
  return root;
};

/** Eine Lane liefert genau einen Beitrag plus seinen Manifest-Eintrag. */
const registerLane = (root: string, lane: Lane): string => {
  const narrative = join(root, 'content', 'narrative');
  const turnId = `2026-11-14T${lane.at}Z-${lane.slug}`;
  const contributionId = `${lane.slug}-01`;
  writeFileSync(
    join(narrative, 'contributions', `2026-11-14-${lane.slug}.json`),
    `${JSON.stringify({
      agentId: 'liilith',
      turnId,
      contributionId,
      role: 'BEOBACHTER',
      locale: 'de',
      slot: 'city-event',
      function: 'describe',
      contexts: lane.contexts,
      tone: 'sachlich',
      mood: 'neutral',
      relationship: 'neutral',
      personaRefs: [],
      flags: ['narrativ'],
      text: lane.text,
      directives: [],
    }, null, 2)}\n`,
  );
  const manifestPath = join(narrative, 'turns', 'manifest.json');
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  manifest.turns.push({ turnId, contributionId });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return contributionId;
};

/** Der Regenerationsschritt: Quellen lesen, Registry neu erzeugen, nichts von Hand. */
const compile = (root: string): Compiled => {
  const sources = loadNarrativeSources(root);
  expect(sources.issues).toEqual([]);
  return {
    registry: sources.compiled,
    text: renderRegistry(sources.compiled),
    contributions: sources.contributions,
    manifest: sources.manifest,
  };
};

const ids = (compiled: Compiled): string[] =>
  compiled.registry.fragments.map((fragment) => String(fragment.contributionId));

const ALPHA: Lane = {
  slug: 'lane-alpha',
  at: '09:10',
  contexts: ['service'],
  text: 'Zwei Kisten stehen vor der Theke, die eine mit Gläsern, die andere mit Quittungen. Die Quittungen kommen zuerst an, also wird zuerst gezählt, was niemand bestellt hat.',
};

const BETA: Lane = {
  slug: 'lane-beta',
  at: '09:20',
  contexts: ['aftermath'],
  text: 'Am Ende des Abends liegt auf der Theke ein Zettel mit zwei Summen. Beide sind richtig, aber sie stehen in verschiedenen Büchern, und der Wirt sucht das eine Buch noch.',
};

describe('Serieller Narrative-Integrationslauf', () => {
  it('erhaelt beide Beitraege, wenn zwei Lanes nacheinander integriert werden', () => {
    const root = fixture();
    try {
      const alpha = registerLane(root, ALPHA);
      const first = compile(root);
      expect(ids(first)).toEqual([alpha]);

      const beta = registerLane(root, BETA);
      const second = compile(root);

      // Keine verlorene Contribution: der zweite Lauf ist ein Superset des ersten.
      expect(ids(second)).toEqual([alpha, beta]);
      for (const fragment of first.registry.fragments) {
        expect(second.registry.fragments).toContainEqual(fragment);
      }

      // Registry und Manifest bleiben paritaetisch, der Hash ist reproduzierbar.
      expect(second.contributions).toHaveLength(2);
      expect(second.manifest.turns).toHaveLength(second.contributions.length);
      expect(validateCompiledRegistry(second.registry, second.registry, second.text)).toEqual([]);
      expect(compile(root).registry.contentHash).toBe(second.registry.contentHash);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('erkennt die nicht regenerierte Registry der ersten Lane nach der Integration', () => {
    const root = fixture();
    try {
      registerLane(root, ALPHA);
      const first = compile(root);
      registerLane(root, BETA);
      const second = compile(root);

      // Genau der Fall aus #629: der alte Stand ist syntaktisch gueltig, aber falsch.
      const issues = validateCompiledRegistry(JSON.parse(first.text), second.registry, first.text);
      expect(issues.length).toBeGreaterThan(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('verlangt fuer generierte Konflikte einen Rebase mit Regeneration', () => {
    const verdict = assessIntegration({
      behind: 1,
      conflicts: [
        'content/narrative/registry/fragments.json',
        'src/core/sim/narrative/composer/registry.generated.ts',
      ],
    });
    expect(verdict.status).toBe(INTEGRATION.REBASE_REQUIRED);
    expect(verdict.source).toEqual([]);
    expect(verdict.generated).toEqual([
      'content/narrative/registry/fragments.json',
      'src/core/sim/narrative/composer/registry.generated.ts',
    ]);
  });
});
