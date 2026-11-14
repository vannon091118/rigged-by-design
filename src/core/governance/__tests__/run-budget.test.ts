/**
 * @test-target: scripts/run-budget.mjs
 * @proof-class: governance
 * @error-code: ERR-4019
 *
 * Der Stop-Vertrag ist extern: Grenzen aus der Konfiguration, Ist-Werte aus
 * Git/Aufruf. Kill-Switch und jeder Grenzverstoss beenden den Lauf; das
 * Finding-Gate akzeptiert nur belegte, aktuelle und zugeordnete Befunde.
 */
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  decideRunBudget, readRunBudget, validateFinding, validateRunBudget,
} from '../../../../scripts/lib/run-budget.mjs';

const budget = {
  version: 1,
  killSwitch: false,
  maxIterations: 3,
  maxIssues: 2,
  maxCommits: 4,
  maxNewGovernanceIssues: 3,
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

  it('tickt neue Befunde zuerst und stoppt erst danach', () => {
    const result = decideRunBudget({
      commits: 1, iterations: 1, issues: 1, newGovernanceIssues: 4,
    }, budget);
    expect(result.state).toBe('BUDGET_EXHAUSTED');
    expect(result.reasons).toContain('new-governance-issues>3');
    expect(result.findingDuty).toBe('TICKET_THEN_STOP');
    expect(result.notes.join(' ')).toContain('ZU PRUEFEN');
  });

  it('akzeptiert kein Budget, das neue Befunde verbietet', () => {
    const result = validateRunBudget({ ...budget, maxNewGovernanceIssues: 0 });
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('mindestens 1');
  });

  it('haelt die echte Laufkonfiguration ticketing-faehig', () => {
    const configured = readRunBudget(resolve(process.cwd(), 'docs', 'run-budget.json'));
    expect(configured.maxNewGovernanceIssues).toBeGreaterThanOrEqual(1);
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
