/**
 * @test-target: scripts/lib/work-claim.mjs
 * @error-code: ERR-4027
 *
 * #693: Kein Kommentar autorisiert sich selbst. Nur ein verifizierter Autor
 * mit passender Rolle und Claim-ID aendert den Board-Zustand; Rollen kommen aus
 * der Actor-Policy, nicht aus dem Text. Replay, fremde Claim-ID und unerlaubte
 * Reihenfolge bleiben Befunde, keine Zustandsaenderung.
 */
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { evaluateIssueClaim, readIssueClaim } from '../../../../scripts/lib/issue-claim.mjs';
import { evaluateWorkState } from '../../../../scripts/lib/work-claim.mjs';

/** Getrennte Principals: Worker duerfen nicht wie Maintainer aussehen. */
const ACTORS = { maintainers: ['maintainer'], users: ['owner'], workers: ['worker'] };
const comment = (id: number, login: string, body: string) => ({ id: String(id), author: { login }, body });
const reviewed = [
  comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1 identity=LIILITH'),
  comment(2, 'worker', 'DONE claim_id=wc-1'),
  comment(3, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
];

describe('Kommentar-Autorisierung', () => {
  it('akzeptiert ein Verdikt nur von einem getrennten Maintainer-Principal', () => {
    expect(evaluateWorkState(reviewed, { actors: ACTORS }).state).toBe('REVIEW_PENDING');
    const verdict = evaluateWorkState([...reviewed, comment(4, 'maintainer', 'ACCEPT claim_id=wc-1')], { actors: ACTORS });
    expect(verdict.state).toBe('ACCEPTED');
    const forged = evaluateWorkState([...reviewed, comment(4, 'worker', 'ACCEPT claim_id=wc-1')], { actors: ACTORS });
    expect(forged.state).toBe('REVIEW_PENDING');
    expect(forged.rejected).toContainEqual(expect.objectContaining({ kind: 'ACCEPT', reason: 'unauthorized-author' }));
  });

  it('ignoriert eine im Text behauptete Rolle eines unbekannten Autors', () => {
    const result = evaluateWorkState(
      [comment(1, 'mallory', 'WORK_CLAIM claim_id=wc-9 identity=MAINTAINER')],
      { actors: ACTORS },
    );
    expect(result.state).toBe('OPEN');
    expect(result.rejected[0]).toMatchObject({ reason: 'unknown-author' });
  });

  it('bindet Worker-Ereignisse an die aktive Claim-ID', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      comment(2, 'worker', 'DONE claim_id=wc-2'),
    ], { actors: ACTORS });
    expect(result.state).toBe('ACTIVE');
    expect(result.rejected).toContainEqual(expect.objectContaining({ kind: 'DONE', reason: 'claim-mismatch' }));
  });

  it('zaehlt ein Replay derselben Zeile genau einmal', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      { id: '2', author: { login: 'worker' }, body: 'DONE claim_id=wc-1\nDONE claim_id=wc-1' },
      comment(3, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
    ], { actors: ACTORS });
    expect(result.state).toBe('REVIEW_PENDING');
    expect(result.rejected.filter((entry: { reason: string }) => entry.reason === 'duplicate-event')).toHaveLength(1);
  });

  it('erzwingt die Uebergangstabelle', () => {
    const result = evaluateWorkState([
      comment(1, 'worker', 'WORK_CLAIM claim_id=wc-1'),
      comment(2, 'worker', 'REVIEW_PENDING claim_id=wc-1'),
    ], { actors: ACTORS });
    expect(result.state).toBe('ACTIVE');
    expect(result.rejected[0]).toMatchObject({ reason: 'transition-not-allowed' });
  });

  it('laesst ohne Actor-Policy kein Ereignis wirken', () => {
    const result = evaluateWorkState(reviewed);
    expect(result.state).toBe('OPEN');
    expect(result.rejected.every((entry: { reason: string }) => entry.reason === 'unknown-author')).toBe(true);
  });

  it('oeffnet und uebernimmt Issue-Claims nur fuer autorisierte Autoren', () => {
    const claim = (login: string) => ({
      id: '1', author: { login }, createdAt: '2026-11-14T00:00:00Z',
      body: 'CLAIM [A1] LIILITH 2026-11-14T00:00Z scope=src plan=x',
    });
    const unauthorized = evaluateIssueClaim({ comments: [claim('mallory')], agent: 'LIILITH', actors: ACTORS });
    expect(unauthorized.status).toBe('free');
    expect(unauthorized.rejected[0]).toMatchObject({ reason: 'unknown-author' });
    const authorized = evaluateIssueClaim({ comments: [claim('worker')], agent: 'LIILITH', actors: ACTORS });
    expect(authorized.status).toBe('claimed-self');
  });

  it('gibt einen fremden Issue-Claim erst ab 2 Stunden als stale frei', () => {
    const base = Date.parse('2026-11-11T00:00:00Z');
    const foreign = {
      id: '2', author: { login: 'worker' }, createdAt: '2026-11-11T00:00:00Z',
      body: 'CLAIM [A3] Shinon 2026-11-11T00:00Z scope=src plan=x',
    };
    const at = (hours: number) => evaluateIssueClaim({
      comments: [foreign], agent: 'LIILITH', actors: ACTORS, now: base + hours * 3_600_000,
    });
    expect(at(1)).toMatchObject({ status: 'claimed-other', holder: 'Shinon', ageHours: 1 });
    expect(at(2)).toMatchObject({ status: 'stale', holder: 'Shinon', ageHours: 2 });
    expect(at(3)).toMatchObject({ status: 'stale', ageHours: 3 });
  });

  it('meldet den eigenen alten Issue-Claim nicht als stale', () => {
    const base = Date.parse('2026-11-11T00:00:00Z');
    const own = {
      id: '3', author: { login: 'worker' }, createdAt: '2026-11-11T00:00:00Z',
      body: 'CLAIM [A4] LIILITH 2026-11-11T00:00Z scope=src plan=x',
    };
    const result = evaluateIssueClaim({
      comments: [own], agent: 'LIILITH', actors: ACTORS, now: base + 100 * 3_600_000,
    });
    expect(result).toMatchObject({ status: 'claimed-self', holder: 'LIILITH', ageHours: 100 });
  });

  it('wiederholt einen fehlgeschlagenen gh-Read genau einmal', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-gh-retry-'));
    const counter = join(dir, 'attempts');
    const script = join(dir, 'gh.mjs');
    writeFileSync(script, [
      "import { existsSync, readFileSync, writeFileSync } from 'node:fs';",
      `const file = ${JSON.stringify(counter)};`,
      "const attempt = existsSync(file) ? Number(readFileSync(file, 'utf8')) : 0;",
      "writeFileSync(file, String(attempt + 1));",
      "if (attempt === 0) { console.error('HTTP 429'); process.exit(1); }",
      "console.log(JSON.stringify({ number: 685, state: 'OPEN', labels: [], comments: [] }));",
    ].join('\n'));
    const previous = { bin: process.env.RBD_GH_BIN, script: process.env.RBD_GH_SCRIPT };
    process.env.RBD_GH_BIN = process.execPath;
    process.env.RBD_GH_SCRIPT = script;
    try {
      const result = readIssueClaim({ number: 685, agent: 'LIILITH', actors: ACTORS, cwd: dir });
      expect(result).toMatchObject({ checked: true, status: 'free' });
      expect(readFileSync(counter, 'utf8')).toBe('2');
    } finally {
      if (previous.bin === undefined) delete process.env.RBD_GH_BIN;
      else process.env.RBD_GH_BIN = previous.bin;
      if (previous.script === undefined) delete process.env.RBD_GH_SCRIPT;
      else process.env.RBD_GH_SCRIPT = previous.script;
    }
  });
});
