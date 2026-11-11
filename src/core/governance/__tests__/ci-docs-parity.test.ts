/**
 * @test-target: scripts/lib/pipeline-plan.mjs
 * @error-code: ERR-4017
 *
 * Die Doku nennt dieselbe Gate-Wahrheit wie der Plan. Der Test liest die
 * Tabelle in `docs/CI.md` und vergleicht sie mit `REQUIRED_CI_GATES`: ein
 * neues Gate ohne Doku-Zeile (oder eine alte Zahl) wird rot, bevor ein Agent
 * nach einer veralteten Anleitung arbeitet.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { QUICK_GATES, REQUIRED_CI_GATES } from '../../../../scripts/lib/pipeline-plan.mjs';

const doc = readFileSync(resolve(process.cwd(), 'docs', 'CI.md'), 'utf8');

/** Die Gate-Namen der Required-Tabelle: `| 3 | `typecheck` | ... |`. */
const documented = (): readonly string[] =>
  [...doc.matchAll(/^\|\s*\d+\s*\|\s*`([a-z:-]+)`\s*\|/gm)]
    .map((match) => String(match[1] ?? ''))
    // Nur die Tabelle der Required-Gates; spaetere Tabellen nennen keine Skripte.
    .filter((name) => (REQUIRED_CI_GATES as readonly string[]).includes(name));

describe('docs/CI.md und der Gate-Plan', () => {
  it('dokumentiert jedes Required-Gate genau einmal', () => {
    expect(REQUIRED_CI_GATES.length).toBe(15);
    expect(documented()).toEqual([...REQUIRED_CI_GATES]);
  });

  it('nennt dieselbe Zahl fuer Quick und Voll', () => {
    expect(doc).toContain(`Der Required-Plan besteht aus fünfzehn Gates`);
    expect(doc).toContain(`\`verify:quick\` = vierzehn Gates`);
    expect(doc).toContain(`\`verify:all\` = fünfzehn Required plus Audit (sechzehn Läufe)`);
    expect(QUICK_GATES.length).toBe(14);
  });
});
