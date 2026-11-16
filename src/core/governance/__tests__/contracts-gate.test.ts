/**
 * @test-target: scripts/verify-contracts.mjs
 * @error-code: ERR-4019
 *
 * Die Vertragsliste kommt aus `docs/contracts/`, nicht aus einer zweiten
 * Liste. Der Test belegt: der echte Baum ist paritaetisch, und jede Luecke —
 * fehlende Tabellenzeile, fehlender Vertragstest, fremder Owner, zwei
 * schreibende Claims — wird als Befund erkannt.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  checkContracts as rawCheckContracts,
  contractIds as rawContractIds,
  parseIndex as rawParseIndex,
} from '../../../../scripts/lib/contracts.mjs';

type Row = { id: string; link: string; owner: string; writer: string; test: string };
type Claim = { id: string; status: string; contracts: { id: string; mode: string }[] };
type CheckInput = { root: string; ids: readonly string[]; rows: readonly Row[]; claims?: readonly Claim[] };

const ROOT = resolve(process.cwd());
const contractIds = rawContractIds as unknown as (root: string) => string[];
const parseIndex = rawParseIndex as unknown as (markdown: string) => Row[];
const checkContracts = rawCheckContracts as unknown as (input: CheckInput) => string[];
const IDS = contractIds(ROOT);
const ROWS = parseIndex(readFileSync(join(ROOT, 'docs', 'contracts', 'README.md'), 'utf8'));
const clone = (rows: readonly Row[]): Row[] => rows.map((row) => ({ ...row }));

describe('Vertragseinhaltung', () => {
  it('ist im echten Baum paritaetisch', () => {
    expect(IDS.length).toBeGreaterThan(0);
    expect(ROWS.map((row) => row.id).sort()).toEqual([...IDS].sort());
    expect(checkContracts({ root: ROOT, ids: IDS, rows: ROWS })).toEqual([]);
  });

  it('erkennt eine Vertragsdatei ohne Tabellenzeile', () => {
    const findings = checkContracts({ root: ROOT, ids: [...IDS, 'neu'], rows: ROWS });
    expect(findings.join('\n')).toContain('docs/contracts/neu.md: keine Zeile');
  });

  it('erkennt einen fehlenden Vertragstest', () => {
    const rows = clone(ROWS).map((row, index) => (index === 0 ? { ...row, test: 'src/core/contracts/__tests__/fehlt.test.ts' } : row));
    expect(checkContracts({ root: ROOT, ids: IDS, rows }).join('\n')).toContain('Vertragstest');
  });

  it('erkennt einen Owner ausserhalb des Rosters', () => {
    const rows = clone(ROWS).map((row, index) => (index === 0 ? { ...row, owner: 'Niemand' } : row));
    expect(checkContracts({ root: ROOT, ids: IDS, rows }).join('\n')).toContain("steht nicht im Roster");
  });

  it('erkennt zwei schreibende Claims auf denselben Vertrag', () => {
    const id = ROWS[0]?.id ?? '';
    const claims: Claim[] = [
      { id: 'lane/a', status: 'open', contracts: [{ id, mode: 'write' }] },
      { id: 'lane/b', status: 'open', contracts: [{ id, mode: 'write' }] },
    ];
    expect(checkContracts({ root: ROOT, ids: IDS, rows: ROWS, claims }).join('\n')).toContain('mehrere schreibende Claims');
  });

  it('laeuft als Gate gruen und bleibt im Budget', () => {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'verify-contracts.mjs')], { cwd: ROOT, encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(output).toContain('GRUEN');
    expect(Math.ceil(Buffer.byteLength(output, 'utf8') / 3)).toBeLessThanOrEqual(500);
  });
});
