/**
 * @test-target: scripts/lib/issue-scope.mjs
 * @error-code: ERR-4019
 *
 * Ein Scope-Label entscheidet, ob ein offenes Issue eine Lane blockiert.
 * `main` blockiert global, eine Lane nur sich selbst, eine Dependency nur ihre
 * Dependents; alles andere ist eine Warnung. Der Body traegt die Felder, die
 * `pretask`, Sweep und Auto-Resolve zum Zuordnen brauchen.
 */
import { describe, expect, it } from 'vitest';
import {
  classifyIssue,
  fingerprintOf,
  issueBody,
  labelNames,
  laneMatches,
  parseIssueBody,
  scopeLabel,
  scopeOf,
} from '../../../../scripts/lib/issue-scope.mjs';

const head = 'a'.repeat(40);

describe('issue-scope Labels', () => {
  it('leitet aus main und Lane das stabile Scope-Label ab', () => {
    expect(scopeLabel('main')).toBe('scope:main');
    expect(scopeLabel('lane/governance/ci')).toBe('scope:lane/governance/ci');
    expect(scopeLabel('fix/foo')).toBe('scope:lane/fix/foo');
    expect(scopeLabel('')).toBeNull();
  });

  it('liest neue und historische Schreibweisen als dieselbe Lane', () => {
    expect(scopeOf(['scope:lane/governance/ci'])).toEqual({ kind: 'lane', lane: 'lane/governance/ci' });
    expect(scopeOf(['scope:lane:lane/test/issue'])).toEqual({ kind: 'lane', lane: 'lane/test/issue' });
    expect(scopeOf(['lane:lane/test/issue'])).toEqual({ kind: 'lane', lane: 'lane/test/issue' });
    expect(scopeOf(['scope:main'])).toEqual({ kind: 'main', lane: null });
    expect(scopeOf(['scope:dependency:lane/a/b'])).toEqual({ kind: 'dependency', lane: 'lane/a/b' });
    expect(scopeOf([])).toEqual({ kind: 'none', lane: null });
  });

  it('vergleicht Lanes nur an Segmentgrenzen', () => {
    expect(laneMatches('lane/a', 'lane/a/b')).toBe(true);
    expect(laneMatches('lane/a/b', 'lane/a')).toBe(true);
    expect(laneMatches('lane/a', 'lane/ab')).toBe(false);
    expect(laneMatches('', 'lane/a')).toBe(false);
  });

  it('normalisiert Label-Objekte und Strings', () => {
    expect(labelNames([{ name: 'scope:main' }, 'remote-ci'])).toEqual(['scope:main', 'remote-ci']);
  });
});

describe('issue-scope Entscheidung', () => {
  const issue = (labels: string[], body = '') => ({ labels, body });

  it('blockiert scope:main global', () => {
    const decision = classifyIssue(issue(['scope:main']), { branch: 'lane/x/y' });
    expect(decision.disposition).toBe('blocker');
    expect(decision.reason).toBe('scope-main');
  });

  it('blockiert die eigene Lane, aber keine fremde', () => {
    const own = classifyIssue(issue(['scope:lane/governance/ci']), { branch: 'lane/governance/ci' });
    expect(own.disposition).toBe('blocker');
    expect(own.reason).toBe('scope-lane');
    const foreign = classifyIssue(issue(['scope:lane/other/task']), { branch: 'lane/governance/ci' });
    expect(foreign.disposition).toBe('warning');
  });

  it('blockiert eine deklarierte Dependency', () => {
    const decision = classifyIssue(issue(['scope:dependency:lane/a/b']), {
      branch: 'lane/x/y',
      dependencies: ['lane/a/b'],
    });
    expect(decision.disposition).toBe('blocker');
    expect(decision.reason).toBe('scope-dependency');
  });

  it('behandelt remote-ci, fehlenden Scope und bereits reparierte Befunde als Warnung', () => {
    expect(classifyIssue(issue(['remote-ci'])).reason).toBe('remote-ci');
    expect(classifyIssue(issue([])).reason).toBe('no-scope');
    const repaired = classifyIssue(issue(['scope:main'], `<!-- repair: ${head} -->`), {
      isAncestor: () => true,
    });
    expect(repaired.disposition).toBe('warning');
    expect(repaired.reason).toBe('repair-already-in-head');
  });
});

describe('issue-scope Body', () => {
  const fingerprint = fingerprintOf('ERR-4017', 'Doku-Marker fehlt');
  const body = issueBody({
    branch: 'lane/governance/ci',
    headSha: head,
    gate: 'Gate docs',
    code: 'ERR-4017',
    fingerprint,
    runUrl: 'https://example.test/run/1',
    report: 'Doku-Marker fehlt',
    repair: `<!-- autofix: ${head} -->`,
  });

  it('enthaelt Branch, Head-SHA, Gate, Code, Fingerprint und Repair-Marker', () => {
    expect(body).toContain('**Branch:** `lane/governance/ci`');
    expect(body).toContain(`**Head-SHA:** \`${head}\``);
    expect(body).toContain('**Gate:** `Gate docs`');
    expect(body).toContain('**Code:** `ERR-4017`');
    expect(body).toContain(`**Fingerprint:** \`${fingerprint}\``);
    expect(body).toContain(`<!-- autofix: ${head} -->`);
  });

  it('laesst sich wieder einlesen', () => {
    const parsed = parseIssueBody(body);
    expect(parsed.headSha).toBe(head);
    expect(parsed.gate).toBe('Gate docs');
    expect(parsed.code).toBe('ERR-4017');
    expect(parsed.fingerprint).toBe(fingerprint);
    expect(parsed.autofix).toBe(head);
    expect(parsed.repair).toBeNull();
  });
});
