/**
 * @test-target: scripts/lib/github-rest.mjs
 * @error-code: ERR-4019
 *
 * Das Board-Gate darf nicht an einer angemeldeten `gh`-CLI haengen: viele
 * Arbeitsplaetze haben nur einen Git-Connector mit Token. Der Test haelt fest,
 * dass beide Pfade dieselbe Datenform liefern und der Fallback im echten
 * Claim-Leser greift.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { githubToken, rest, restForGhArgs } from '../../../../scripts/lib/github-rest.mjs';
import { readIssueClaimAny } from '../../../../scripts/lib/board-read.mjs';

const CLAIM_BODY = 'CLAIM [A1] Governance-Owner 2026-11-15T07:00:00Z scope=scripts plan=Gate bauen';
const ISSUE_VIEW = {
  number: 886,
  state: 'OPEN',
  labels: [{ name: 'prio-p1' }],
  comments: [{ body: CLAIM_BODY, createdAt: '2026-11-15T07:00:00Z', author: { login: 'vannon091118' } }],
};

/** Ein Stub-Helfer, der die REST-Antwort nachstellt; kein Netz im Test. */
function stubHelper(parent: string, payload: unknown): string {
  const dir = join(parent, 'bin');
  mkdirSync(dir, { recursive: true });
  const script = join(dir, 'rest-stub.mjs');
  writeFileSync(script, `process.stdout.write(${JSON.stringify(JSON.stringify(payload))});\n`);
  return script;
}

/** Ein Stub, der wie der echte Helfer mit Zustand auf stderr abbricht. */
function stubFailure(parent: string, state: string): string {
  const dir = join(parent, 'bin-fail');
  mkdirSync(dir, { recursive: true });
  const script = join(dir, 'rest-fail.mjs');
  writeFileSync(script, `process.stderr.write('${state}: Rate-Limit erreicht\\n'); process.exit(4);\n`);
  return script;
}

const savedEnv = { ...process.env };

beforeEach(() => {
  process.env = { ...savedEnv };
});

afterEach(() => {
  process.env = { ...savedEnv };
});

describe('github-rest', () => {
  it('liest den Token aus beiden ueblichen Variablen', () => {
    expect(githubToken({ GH_TOKEN: 'a' })).toBe('a');
    expect(githubToken({ GITHUB_TOKEN: 'b' })).toBe('b');
    expect(githubToken({})).toBe('');
  });

  it('uebersetzt die gh-Aufrufe des Gates in REST-Abfragen', () => {
    expect(restForGhArgs(['issue', 'view', '886', '--json', 'number,state'])).toEqual({
      kind: 'issue-view',
      params: { number: 886 },
    });
    expect(restForGhArgs(['issue', 'list', '--label', 'governance/blocked', '--state', 'open', '--limit', '50'])).toEqual({
      kind: 'issue-list',
      params: { label: 'governance/blocked', limit: 50, state: 'open' },
    });
    expect(restForGhArgs(['pr', 'view', 'lane/x', '--json', 'number,url'])).toEqual({
      kind: 'pull-for-branch',
      params: { branch: 'lane/x' },
    });
    expect(restForGhArgs(['pr', 'view', 'lane/x', '--json', 'number,headRefOid,comments,statusCheckRollup'])).toEqual({
      kind: 'ci-for-branch',
      params: { branch: 'lane/x' },
    });
    expect(restForGhArgs(['issue', 'comment', '1', '--body', 'x'])).toBeNull();
  });

  it('liest oeffentliche Daten ohne Token, statt den Start zu sperren', () => {
    // FREEZE-0 (#684): kein Pflicht-Token. Der anonyme Pfad ist erlaubt; nur
    // ein echter Lesefehler wird zum Zustand UNKNOWN und nie zu einer leeren Liste.
    const parent = mkdtempSync(join(tmpdir(), 'rbd-rest-anon-'));
    const savedToken = process.env.GH_TOKEN;
    const savedScript = process.env.RBD_REST_SCRIPT;
    try {
      delete process.env.GH_TOKEN;
      process.env.RBD_REST_SCRIPT = stubFailure(parent, 'UNKNOWN_RATE_LIMIT');
      const limited = rest('issue-view', { number: 886 });
      if (limited.ok) throw new Error('anonyme Anfrage haette als Zustand enden muessen');
      expect(limited.state).toBe('UNKNOWN_RATE_LIMIT');
      expect(limited.error).toContain('UNKNOWN_RATE_LIMIT');

      process.env.RBD_REST_SCRIPT = stubHelper(parent, ISSUE_VIEW);
      const ok = rest('issue-view', { number: 886 });
      expect(ok.ok).toBe(true);
      expect(ok.data.number).toBe(886);
    } finally {
      if (savedToken === undefined) delete process.env.GH_TOKEN; else process.env.GH_TOKEN = savedToken;
      if (savedScript === undefined) delete process.env.RBD_REST_SCRIPT; else process.env.RBD_REST_SCRIPT = savedScript;
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('liest ueber den Stub-Helfer dieselbe Form wie gh', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-rest-'));
    try {
      process.env.GH_TOKEN = 'test';
      process.env.RBD_REST_SCRIPT = stubHelper(parent, ISSUE_VIEW);
      const result = rest('issue-view', { number: 886 });
      expect(result.ok).toBe(true);
      expect(result.data.number).toBe(886);
      expect(result.data.comments[0].author.login).toBe('vannon091118');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('findet den eigenen Claim auch ohne gh, nur ueber den Token-Pfad', () => {
    const parent = mkdtempSync(join(tmpdir(), 'rbd-rest-claim-'));
    try {
      process.env.GH_TOKEN = 'test';
      process.env.RBD_REST_SCRIPT = stubHelper(parent, ISSUE_VIEW);
      // Ein gh-Ersatz, der immer scheitert: der Fallback muss greifen.
      const broken = join(parent, 'broken-gh.mjs');
      writeFileSync(broken, 'process.exit(1);\n');
      process.env.RBD_GH_BIN = process.execPath;
      process.env.RBD_GH_SCRIPT = broken;

      const actors = { maintainers: ['vannon091118'], users: ['vannon091118'], workers: ['vannon091118'] };
      const claim = readIssueClaimAny({ number: 886, agent: 'Governance-Owner', actors });
      expect(claim.source).toBe('rest');
      expect(claim.checked).toBe(true);
      expect(claim.status).toBe('claimed-self');
      expect(claim.claimId).toBe('A1');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});
