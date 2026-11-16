/**
 * @test-target: scripts/lib/merge-gate.mjs
 * @error-code: ERR-4019
 *
 * Das Merge-Gate ist nur so gut wie seine Lesart der echten Antwort. Der Test
 * nimmt die aufgezeichnete Branch-Protection von `main` und belegt: Schutz
 * vorhanden, PR-Zwang, enforce_admins, Force-Push und Loeschen blockiert.
 * Jede Abschwaechung wird als Befund rot, ohne Netz.
 */
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  mergeGateVerdict as rawVerdict,
  parseProtection as rawParseProtection,
  parseRulesets as rawParseRulesets,
} from '../../../../scripts/lib/merge-gate.mjs';

type Protection = {
  required_status_checks?: { contexts?: string[]; strict?: boolean } | null;
  required_pull_request_reviews?: { required_approving_review_count?: number } | null;
  enforce_admins?: { enabled?: boolean };
  allow_force_pushes?: { enabled?: boolean };
  allow_deletions?: { enabled?: boolean };
};

const ROOT = resolve(process.cwd());
const parseProtection = rawParseProtection as unknown as (data: unknown) => {
  prRequired: boolean;
  approvals: number;
  enforceAdmins: boolean;
  forcePushBlocked: boolean;
  deletionsBlocked: boolean;
  requiredChecks: string[];
} | null;
const parseRulesets = rawParseRulesets as unknown as (data: unknown) => string[];
const verdict = rawVerdict as unknown as (input: {
  protection: unknown;
  rulesets?: unknown;
  branch?: string;
}) => { ok: boolean; state: string; findings: string[]; facts: Record<string, unknown> };

const REAL = JSON.parse(
  readFileSync(join(ROOT, 'docs/evidence/github-branch-protection-main-2026-11-16.json'), 'utf8'),
) as Protection;
const clone = (): Protection => JSON.parse(JSON.stringify(REAL)) as Protection;

describe('Merge-Gate', () => {
  it('liest die echte Branch-Protection von main', () => {
    const parsed = parseProtection(REAL);
    expect(parsed).not.toBeNull();
    expect(parsed?.prRequired).toBe(true);
    expect(parsed?.enforceAdmins).toBe(true);
    expect(parsed?.forcePushBlocked).toBe(true);
    expect(parsed?.deletionsBlocked).toBe(true);
  });

  it('ist mit der echten Antwort gruen (Checks sind ein Befund, kein Verstoss)', () => {
    const result = verdict({ protection: REAL, rulesets: [] });
    expect(result.ok).toBe(true);
    expect(result.state).toBe('VERIFIED');
    expect(result.facts.requiredChecks).toEqual([]);
  });

  it('wird rot, wenn Admins den Schutz umgehen koennen', () => {
    const broken = clone();
    broken.enforce_admins = { enabled: false };
    const result = verdict({ protection: broken, rulesets: [] });
    expect(result.ok).toBe(false);
    expect(result.findings.join('\n')).toContain('enforce_admins');
  });

  it('wird rot, wenn Force-Push oder Loeschen erlaubt sind', () => {
    const force = clone();
    force.allow_force_pushes = { enabled: true };
    expect(verdict({ protection: force, rulesets: [] }).findings.join('\n')).toContain('Force-Push');
    const del = clone();
    del.allow_deletions = { enabled: true };
    expect(verdict({ protection: del, rulesets: [] }).findings.join('\n')).toContain('Loeschen');
  });

  it('wird rot, wenn der Schutz ganz fehlt', () => {
    const result = verdict({ protection: { present: false }, rulesets: [] });
    expect(result.ok).toBe(false);
    expect(result.findings.join('\n')).toContain('Schutz fehlt');
  });

  it('nennt vorhandene Required-Checks und Rulesets', () => {
    const withChecks = clone();
    withChecks.required_status_checks = { contexts: ['verify'], strict: true };
    const result = verdict({ protection: withChecks, rulesets: [{ name: 'main' }] });
    expect(result.facts.requiredChecks).toEqual(['verify']);
    expect(result.facts.rulesets).toBe(1);
    expect(parseRulesets([{ name: 'main' }])).toEqual(['main']);
  });
});
