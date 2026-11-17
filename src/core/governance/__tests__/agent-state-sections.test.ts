/**
 * @test-target: scripts/agent-cause.mjs
 * @error-code: ERR-4019
 * @also-covers: scripts/test-affected.mjs
 *
 * Beide migrierten Pfade schreiben ihren Abschnitt in `.verify-cache/state.json`
 * und lesen ihn beim naechsten Lauf wieder: `agent:cause` legt den CI-Befund
 * als `cause` ab (ein zweiter Lauf ohne `gh` muss ihn aus dem Zustand lesen),
 * `test:affected` legt lange Nachweise als `delegated` ab. Die Fixtures sind
 * echte Git-Repos; `gh` ist ein deterministischer Shim, damit der Pfad offline
 * und ohne Netz laeuft.
 */
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { diagnoseLog } from '../../../../scripts/agent-cause.mjs';
import { readSection } from '../../../../scripts/lib/verify-state.mjs';

const CAUSE = resolve(process.cwd(), 'scripts', 'agent-cause.mjs');
const AFFECTED = resolve(process.cwd(), 'scripts', 'test-affected.mjs');
const MECHANIC = 'src/core/games/__tests__/slot-session-rtp.test.ts';
const SYSTEM_PATH = '/usr/local/bin:/usr/bin:/bin';
const HEADER = '/**\n * @test-target: src/core/games/slot.ts\n */\nexport const x = 1;\n';

type CauseBody = { ci: { cached?: boolean; runId?: number } | null; findings: { gate: string | null }[] };
type CauseRecord = { head?: string; runId?: number };
type Delegated = { tests?: string[]; proof?: string[]; dispatched?: boolean };

const dirs: string[] = [];

const git = (cwd: string, args: readonly string[]): string => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
};

/** Frisches Repo; HEAD ist die Basis des Diffs, `origin/main` folgt spaeter. */
const repo = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-state-writer-'));
  dirs.push(root);
  for (const args of [['init', '-q'], ['config', 'user.name', 'Test Agent'], ['config', 'user.email', 'test@example.invalid']]) {
    git(root, args);
  }
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  const setup = [['add', 'README.md'], ['commit', '-q', '-m', 'fixture'], ['remote', 'add', 'origin', 'https://github.com/fixture/repo.git']];
  for (const args of setup) git(root, args);
  return root;
};

/** `gh`-Shim: feste Antworten fuer Lauf, Jobs und Log; der Kopf kommt aus der Umgebung. */
const fakeGh = (root: string): string => {
  const bin = join(root, 'bin');
  mkdirSync(bin, { recursive: true });
  const shim = [
    '#!/bin/sh',
    'case "$1 $2" in',
    `  "run list") printf '[{"databaseId":7,"headSha":"%s","conclusion":"failure","status":"completed","url":"https://example.invalid/run/7"}]' "$RBD_FAKE_HEAD" ;;`,
    `  "api repos/fixture/repo/actions/runs/7/jobs") printf '{"jobs":[{"id":11,"name":"Gate lint","conclusion":"failure","steps":[{"name":"Gate lint","conclusion":"failure"}]}]}' ;;`,
    `  "api repos/fixture/repo/actions/jobs/11/logs") printf '[IDX-0002] [ERR-4011] pipeline/lint: Gate fehlgeschlagen\\n' ;;`,
    '  *) exit 1 ;;',
    'esac',
    '',
  ].join('\n');
  writeFileSync(join(bin, 'gh'), shim);
  chmodSync(join(bin, 'gh'), 0o755);
  return bin;
};

const runCause = (root: string, path: string, extra: Record<string, string> = {}) =>
  spawnSync(process.execPath, [CAUSE, '--json'], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...extra, RBD_ROOT: root, PATH: path },
  });

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('Zustandsabschnitte der CLI-Schreiber', () => {
  it('schreibt cause und liest ihn im naechsten Lauf ohne gh wieder', () => {
    const root = repo();
    const head = git(root, ['rev-parse', 'HEAD']).trim();

    // Derselbe Parser, den die CLI auf das Job-Log anwendet: der Befund ist nicht nur im JSON, sondern auch als Zeile belegt.
    const [diagnosed] = diagnoseLog('[IDX-0002] [ERR-4011] pipeline/lint: Gate fehlgeschlagen');
    expect([diagnosed?.gate, diagnosed?.code]).toEqual(['lint', 'ERR-4011']);

    const first = runCause(root, `${fakeGh(root)}:${SYSTEM_PATH}`, { RBD_FAKE_HEAD: head });
    const firstBody = JSON.parse(first.stdout) as CauseBody;
    const record = readSection('cause', { root }) as CauseRecord | null;
    expect([first.status, firstBody.ci?.cached, firstBody.findings[0]?.gate]).toEqual([1, false, 'lint']);
    expect([record?.head, record?.runId]).toEqual([head, 7]);

    // Ohne gh kann der zweite Lauf nur aus dem gespeicherten Abschnitt antworten.
    const second = runCause(root, SYSTEM_PATH);
    const secondBody = JSON.parse(second.stdout) as CauseBody;
    expect([secondBody.ci?.cached, secondBody.ci?.runId, secondBody.findings[0]?.gate]).toEqual([true, 7, 'lint']);
  });

  it('schreibt lange Nachweise als delegated und liest sie wieder', () => {
    const root = repo();
    mkdirSync(join(root, 'src', 'core', 'games', '__tests__'), { recursive: true });
    writeFileSync(join(root, 'src', 'core', 'games', 'slot.ts'), 'export const slot = 1;\n');
    writeFileSync(join(root, MECHANIC), HEADER);
    const setup = [['add', '-A'], ['commit', '-q', '-m', 'mechanik'], ['update-ref', 'refs/remotes/origin/main', 'HEAD']];
    for (const args of setup) git(root, args);
    writeFileSync(join(root, MECHANIC), HEADER.replace('x = 1', 'x = 2'));

    const affected = spawnSync(process.execPath, [AFFECTED, '--list'], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, RBD_ROOT: root },
    });
    expect([affected.status, affected.stdout.includes('lange Nachweis(e) NICHT lokal ausgefuehrt')]).toEqual([0, true]);

    const delegated = readSection('delegated', { root }) as Delegated | null;
    expect([delegated?.tests, delegated?.proof, delegated?.dispatched]).toEqual([[MECHANIC], ['statistics'], false]);
  });
});
