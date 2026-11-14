/**
 * @test-target: scripts/run-budget.mjs
 * @proof-class: governance
 * @error-code: ERR-4019
 *
 * Der Stop-Vertrag ist extern: Grenzen aus der Konfiguration, Ist-Werte aus
 * Git/Aufruf. Kill-Switch und jeder Grenzverstoss beenden den Lauf; das
 * Finding-Gate akzeptiert nur belegte, aktuelle und zugeordnete Befunde.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decideRunBudget, parseGovernanceFindingCount, validateFinding, validateRunBudget,
} from '../../../../scripts/lib/run-budget.mjs';

const budget = {
  version: 1,
  killSwitch: false,
  maxIterations: 3,
  maxIssues: 2,
  maxCommits: 4,
  maxNewGovernanceIssues: 0,
  productProgress: { mergedProductPrs: 2, acceptedFindings: 1 },
};

const sha = '0123456789abcdef0123456789abcdef01234567';

describe('Laufbudget und Stop-Vertrag', () => {
  it('laeuft innerhalb aller Grenzen weiter und trennt Produkt von Governance', () => {
    const result = decideRunBudget({
      commits: 2, iterations: 1, issues: 1, newGovernanceIssues: 0,
    }, budget);
    expect(result.state).toBe('CONTINUE');
    expect(result.reasons).toEqual([]);
    expect(result.governanceChurn).toBe(0);
    expect(result.productProgress).toEqual({ mergedProductPrs: 2, acceptedFindings: 1 });
  });

  it('stoppt bei Commit-Budget und nennt den Grund', () => {
    const result = decideRunBudget({ commits: 5, iterations: 1, issues: 1 }, budget);
    expect(result.state).toBe('BUDGET_EXHAUSTED');
    expect(result.reasons).toContain('commits>4');
  });

  it('stoppt bei neuen Governance-Findings ohne Produktbeleg', () => {
    const result = decideRunBudget({
      commits: 1, iterations: 1, issues: 1, newGovernanceIssues: 1,
    }, budget);
    expect(result.state).toBe('BUDGET_EXHAUSTED');
    expect(result.reasons).toContain('new-governance-issues>0');
  });

  it('laesst den Kill-Switch jedes Budget ueberschreiben', () => {
    const result = decideRunBudget({ commits: 0, iterations: 0, issues: 0 }, { ...budget, killSwitch: true });
    expect(result.state).toBe('KILL_SWITCH');
    expect(result.reasons).toContain('kill-switch');
  });

  it('weist ungueltige Grenzen fail-closed ab', () => {
    expect(validateRunBudget({ ...budget, maxCommits: 0 }).ok).toBe(false);
    expect(validateRunBudget({ ...budget, maxIssues: -1 }).ok).toBe(false);
    expect(validateRunBudget({ ...budget, productProgress: null }).ok).toBe(false);
    expect(validateRunBudget({ ...budget, version: 2 }).ok).toBe(false);
  });

  it('liest die Befundzahl aus dem Aufruf und sonst unknown', () => {
    expect(parseGovernanceFindingCount(undefined)).toBeNull();
    expect(parseGovernanceFindingCount('unknown')).toBeNull();
    expect(parseGovernanceFindingCount('4')).toBe(4);
    expect(parseGovernanceFindingCount(0)).toBe(0);
    expect(() => parseGovernanceFindingCount('-1')).toThrow(/nichtnegative/);
  });

  it('erkennt die alte feste 0 im Pretask als Fehlverdrahtung', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts', 'pretask.mjs'), 'utf8');
    expect(source).not.toContain('newGovernanceIssues: 0');
    expect(source).toContain('new-governance-issues=unknown');
    expect(source).toContain('parseGovernanceFindingCount');
  });
});

describe('Finding-Gate', () => {
  const finding = {
    summary: 'Ledger-Pfad bucht ausserhalb des Ledger',
    evidence: 'src/core/sim/tick.ts:42',
    mainSha: sha,
    duplicateCheck: '#623, #624 geprueft',
    severity: 'P1',
    area: 'infrastructure',
  };

  it('akzeptiert einen belegten, aktuellen und zugeordneten Befund', () => {
    const result = validateFinding(finding);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('verlangt vollstaendigen Main-SHA, Beleg und Duplikatpruefung', () => {
    const result = validateFinding({ ...finding, mainSha: 'abc', evidence: '', duplicateCheck: '' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('mainSha');
    expect(result.errors.join(' ')).toContain('evidence');
    expect(result.errors.join(' ')).toContain('duplicateCheck');
  });

  it('verlangt fuer Produkt-Findings ein Produktziel', () => {
    const result = validateFinding({ ...finding, area: 'product' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('productGoal');
  });

  it('weist unbekannte Severity und Area ab', () => {
    const result = validateFinding({ ...finding, severity: 'P9', area: 'meta' });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('severity');
    expect(result.errors.join(' ')).toContain('area');
  });
});
