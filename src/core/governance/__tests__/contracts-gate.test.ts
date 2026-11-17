/**
 * @test-target: scripts/verify-contracts.mjs
 * @test-target-mode: process
 * @error-code: ERR-4019
 *
 * Die Vertragsliste kommt aus `docs/contracts/`, nicht aus einer zweiten
 * Liste. Der Test belegt: der echte Baum ist paritaetisch, und jede Luecke —
 * fehlende Tabellenzeile, fehlender Vertragstest, fremder Owner, zwei
 * schreibende Claims — wird als Befund erkannt.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
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

  it('erkennt einen Vertrag in einem verschachtelten Unterordner', () => {
    const root = mkdtempSync(join(tmpdir(), 'rbd-contracts-'));
    mkdirSync(join(root, 'docs', 'contracts', 'nested', 'tief'), { recursive: true });
    writeFileSync(join(root, 'docs', 'contracts', 'nested', 'tief', 'tmp.md'), '# tmp\n', 'utf8');
    expect(contractIds(root)).toEqual(['nested/tief/tmp']);
    const findings = checkContracts({ root, ids: contractIds(root), rows: [] });
    expect(findings.join('\n')).toContain('docs/contracts/nested/tief/tmp.md: keine Zeile');
    rmSync(root, { recursive: true, force: true });
  });

  it('meldet einen temporaeren Vertrag im echten Baum als Gate-Verstoss und raeumt ihn ab', () => {
    const dir = join(ROOT, 'docs', 'contracts', '__tmp_gate_probe__');
    try {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'wegwerf.md'), '# Wegwerf\n\n**Status:** aktiv\n', 'utf8');
      const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'verify-contracts.mjs')], { cwd: ROOT, encoding: 'utf8' });
      const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
      expect(result.status).toBe(1);
      expect(output).toContain('__tmp_gate_probe__/wegwerf.md');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    expect(contractIds(ROOT).some((id) => id.includes('__tmp_gate_probe__'))).toBe(false);
  });

  it('laeuft als Gate gruen und bleibt im Budget', () => {
    const result = spawnSync(process.execPath, [join(ROOT, 'scripts', 'verify-contracts.mjs')], { cwd: ROOT, encoding: 'utf8' });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    expect(result.status).toBe(0);
    expect(output).toContain('GRUEN');
    expect(Math.ceil(Buffer.byteLength(output, 'utf8') / 3)).toBeLessThanOrEqual(500);
  });
});
