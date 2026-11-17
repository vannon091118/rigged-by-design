/**
 * @test-target: scripts/lib/doc-core.mjs
 * @error-code: ERR-4017
 *
 * Der Doku-Kern: fünf Pflichtdokus, ein Token-Budget, ein Cross-Check.
 * Der Test hält die Zahlen und die Merge-Stabilität; die Strukturprüfung
 * bleibt in `scripts/verify-docs.mjs`.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CORE_DOCS,
  CORE_TOKEN_BUDGET,
  READING_DOCS,
  READING_TOKEN_BUDGET,
  auditDocs,
  commandFindings,
  docCoreProblems,
  countTokens,
  kernBlock,
  lastChangesProblems,
  ownershipProblems,
  referenceProblems,
  volatileFindings,
} from '../../../../scripts/lib/doc-core.mjs';

type CoreDoc = { path: string; title: string; scope: string; sections: string[] };
type LoadedDoc = CoreDoc & { text: string };

const ROOT = process.cwd();
const CORE = CORE_DOCS as CoreDoc[];
const docs: LoadedDoc[] = CORE.map((doc) => ({
  ...doc,
  text: readFileSync(join(ROOT, doc.path), 'utf8'),
}));

const budgeted = (doc: LoadedDoc): string =>
  doc.scope === 'document' ? doc.text : (kernBlock(doc.text) ?? '');

describe('Doku-Kern: Budget und Struktur', () => {
  it('hat genau fünf eindeutige Pflichtdokus', () => {
    expect(CORE).toHaveLength(5);
    expect(new Set(CORE.map((doc) => doc.path)).size).toBe(5);
  });

  it('bleibt je Dokument unter 500 Token', () => {
    for (const doc of docs) {
      expect(countTokens(budgeted(doc)), doc.path).toBeLessThanOrEqual(CORE_TOKEN_BUDGET);
    }
  });

  it('bleibt im vollständigen 10k-Lesepfad', () => {
    const reading = (READING_DOCS as CoreDoc[]).map((doc) => ({
      ...doc,
      text: readFileSync(join(ROOT, doc.path), 'utf8'),
    }));
    expect(reading).toHaveLength(7);
    const total = reading.reduce((sum: number, doc: LoadedDoc) => sum + countTokens(budgeted(doc)), 0);
    expect(total).toBeLessThanOrEqual(READING_TOKEN_BUDGET);
    for (const doc of reading) {
      expect(countTokens(budgeted(doc)), doc.path).toBeLessThanOrEqual(CORE_TOKEN_BUDGET);
    }
  });

  it('hat in jedem Dokument einen Kern', () => {
    for (const doc of docs) expect(kernBlock(doc.text), doc.path).not.toBeNull();
  });
});

describe('Doku-Kern: Merge-Stabilität', () => {
  it('nennt im Kern keine Version, keinen SHA und keinen generierten Block', () => {
    for (const doc of docs) {
      expect(volatileFindings(kernBlock(doc.text) ?? ''), doc.path).toEqual([]);
    }
  });

  it('erkennt volatile Angaben', () => {
    expect(volatileFindings('Version 0.3.288')).toContain('Versionsnummer');
    expect(volatileFindings('deadbeef')).toContain('Commit-SHA');
    expect(volatileFindings('<!-- generated:start -->')).toContain('generierter Block');
  });
});

describe('Doku-Kern: Cross-Checks', () => {
  it('ist im echten Baum grün', () => {
    expect(docCoreProblems()).toEqual([]);
  });

  it('meldet unbekannte Kommandos und RBD-Routen', () => {
    const findings = commandFindings(
      '`pnpm run gibt-es-nicht`, `node scripts/gibt-es-nicht.mjs` und `rbd verify ligth`',
      { scripts: { docs: 'x' }, fileExists: () => false },
    );
    expect(findings).toHaveLength(3);
    expect(findings.join('\n')).toContain('rbd verify ligth');
  });

  it('meldet verwaiste Referenzen', () => {
    const problems = referenceProblems({
      index: '[INDEX](INDEX.md)',
      tracked: ['docs/governance/INDEX.md', 'docs/NEU.md'],
    });
    expect(problems.join('\n')).toContain('docs/NEU.md');
  });

  it('prüft Ordner-Owner und Karte', () => {
    expect(ownershipProblems()).toEqual([]);
  });

  it('prüft Last Changes gegen das Changelog', () => {
    expect(lastChangesProblems()).toEqual([]);
  });

  it('liefert eine vollständige Audit-Messung', () => {
    const report = auditDocs();
    expect(report.core).toHaveLength(5);
    expect(report.reading).toHaveLength(7);
    expect(report.overviewTokens).toBeLessThanOrEqual(READING_TOKEN_BUDGET);
    expect(report.problems).toEqual([]);
  });
});
