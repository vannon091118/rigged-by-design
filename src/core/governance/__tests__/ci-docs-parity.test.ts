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
import { checkDocParity, documentedOwners, verifyDocParity } from '../../../../scripts/lib/doc-parity.mjs';

const root = process.cwd();
const doc = readFileSync(resolve(root, 'docs', 'CI.md'), 'utf8');
const agents = readFileSync(resolve(root, 'AGENTS.md'), 'utf8');
const governance = readFileSync(resolve(root, 'docs', 'GOVERNANCE.md'), 'utf8');

/** Die Gate-Namen der Required-Tabelle: `| 3 | `typecheck` | ... |`. */
const documented = (): readonly string[] =>
  [...doc.matchAll(/^\|\s*\d+\s*\|\s*`([a-z:-]+)`\s*\|/gm)]
    .map((match) => String(match[1] ?? ''))
    // Nur die Tabelle der Required-Gates; spaetere Tabellen nennen keine Skripte.
    .filter((name) => (REQUIRED_CI_GATES as readonly string[]).includes(name));

describe('docs/CI.md und der Gate-Plan', () => {
  it('dokumentiert jedes Required-Gate genau einmal', () => {
    expect(REQUIRED_CI_GATES.length).toBe(16);
    expect(documented()).toEqual([...REQUIRED_CI_GATES]);
  });

  it('nennt dieselbe Zahl fuer Quick und Voll', () => {
    expect(doc).toContain(`Der Required-Plan besteht aus sechzehn Gates`);
    expect(doc).toContain(`\`verify:quick\` = fünfzehn Gates`);
    expect(doc).toContain(`\`verify:all\` = sechzehn Required plus Audit (siebzehn Läufe)`);
    expect(QUICK_GATES.length).toBe(15);
  });

  it('ist im echten Baum paritaetisch (AGENTS.md, CI.md, GOVERNANCE.md)', () => {
    expect(verifyDocParity(root)).toEqual([]);
    expect(documentedOwners(governance)).toHaveLength(9);
  });

  it('erkennt die alte AGENTS-Zahl als Fehler', () => {
    const drifted = agents.replace('16 lokale Required-Gates', '15 lokale Required-Gates');
    const problems = checkDocParity({ ciText: doc, agentsText: drifted, governanceText: governance });
    expect(problems.join('\n')).toContain('15 lokale Required-Gates, der Plan 16');
  });

  it('erkennt eine fehlende Light-Gate-Nennung als Fehler', () => {
    const drifted = doc.replace('`test-placement`, `tree`', '`tree`');
    const problems = checkDocParity({ ciText: drifted, agentsText: agents, governanceText: governance });
    expect(problems.join('\n')).toContain('verify:light');
  });

  it('erkennt eine Rolle ausserhalb des Rosters als Fehler', () => {
    const drifted = governance.replace('**Architektur-Owner**', '**UI-Owner**');
    const problems = checkDocParity({ ciText: doc, agentsText: agents, governanceText: drifted });
    expect(problems.join('\n')).toContain('weichen von OWNERS');
  });
});
