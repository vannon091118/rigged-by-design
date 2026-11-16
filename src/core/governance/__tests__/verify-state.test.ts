/**
 * @test-target: scripts/lib/verify-state.mjs
 * @error-code: ERR-4019
 *
 * Ein Cache, ein Besitzer: Altdateien wandern in die Abschnitte von
 * `.verify-cache/state.json`, ein kaputter Zustand blockiert nie, und der
 * TTL-Pfad raeumt alte Gates und Berichte auf.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import {
  clearSection,
  dropGate,
  gcVerifyState,
  migrateLegacy,
  readGates,
  readSection,
  readState,
  setSection,
  statePath,
  writeContextView,
  writeGate,
} from '../../../../scripts/lib/verify-state.mjs';

const dirs: string[] = [];
const tempRoot = (): { root: string; dir: string } => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-verify-state-'));
  dirs.push(root);
  const dir = join(root, '.verify-cache');
  mkdirSync(dir, { recursive: true });
  return { root, dir };
};
/** Feste Infrastrukturzeit: der Test rechnet nicht mit einer Uhr. */
const NOW = 1_000_000_000;

afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('verify-state', () => {
  it('migriert die alten Einzeldateien in die Abschnitte und entfernt sie', () => {
    const { root, dir } = tempRoot();
    writeFileSync(join(dir, 'task-state.json'), JSON.stringify({ version: 1, state: 'SCOPE_VALID', branch: 'lane/x' }));
    writeFileSync(join(dir, 'after-task.json'), JSON.stringify({ version: 1, state: 'TESTS_PASSED', head: 'a'.repeat(40) }));
    writeFileSync(join(dir, 'base-refresh.json'), JSON.stringify({ version: 2, ref: 'origin/main', sha: 'b'.repeat(40), at: 5 }));
    writeFileSync(join(dir, 'delegated.json'), JSON.stringify({ tests: ['src/x.test.ts'], proof: ['long'] }));
    writeFileSync(join(dir, 'ci-cause.json'), JSON.stringify({ head: 'c'.repeat(40), findings: [] }));
    writeFileSync(join(dir, 'lint.json'), JSON.stringify({ key: 'tree-abc', at: NOW }));

    const state = readState({ root });

    expect(state.task.state).toBe('SCOPE_VALID');
    expect((state.task.after as { state?: string }).state).toBe('TESTS_PASSED');
    expect(state.base?.sha).toBe('b'.repeat(40));
    expect((state.delegated as { tests?: string[] }).tests).toEqual(['src/x.test.ts']);
    expect(state.cause?.head).toBe('c'.repeat(40));
    expect(state.gates.lint?.key).toBe('tree-abc');
    for (const name of ['task-state.json', 'after-task.json', 'base-refresh.json', 'delegated.json', 'ci-cause.json', 'lint.json']) {
      expect(existsSync(join(dir, name)), name).toBe(false);
    }
    expect(JSON.parse(readFileSync(statePath(root), 'utf8')).version).toBe(1);
  });

  it('behandelt einen kaputten Zustand fail-open und legt ihn weg', () => {
    const { root } = tempRoot();
    writeFileSync(statePath(root), '{kaputt');

    const state = readState({ root });

    expect(state.version).toBe(1);
    expect(state.task).toEqual({});
    expect(existsSync(`${statePath(root)}.corrupt`)).toBe(true);
    setSection('cause', { head: 'e'.repeat(40) }, { root });
    expect(readSection('cause', { root })?.head).toBe('e'.repeat(40));
  });

  it('schreibt Gates atomar und loescht sie einzeln', () => {
    const { root } = tempRoot();
    writeGate('typecheck', { key: 'k1', at: NOW }, { root });
    writeGate('lint', { key: 'k2', at: NOW }, { root });
    expect(readGates({ root }).typecheck?.key).toBe('k1');
    expect(dropGate('typecheck', { root })).toBe(true);
    expect(readGates({ root }).typecheck).toBeUndefined();
    expect(readGates({ root }).lint?.key).toBe('k2');
    expect(existsSync(`${statePath(root)}.new`)).toBe(false);
  });

  it('entfernt per TTL alte Gates, alte Abschnitte und alte Logs', () => {
    const { root, dir } = tempRoot();
    writeGate('fresh', { key: 'k', at: NOW }, { root });
    writeGate('old', { key: 'k', at: NOW - 40 * 86_400_000 }, { root });
    setSection('cause', { head: 'f'.repeat(40) }, { root });
    const before = JSON.parse(readFileSync(statePath(root), 'utf8'));
    before.meta.cause = NOW - 40 * 86_400_000;
    writeFileSync(statePath(root), JSON.stringify(before));
    mkdirSync(join(dir, 'output'), { recursive: true });
    const oldLog = join(dir, 'output', 'alt.log');
    writeFileSync(oldLog, 'x');
    utimesSync(oldLog, 0, 0);

    const gc = gcVerifyState({ root, ttlDays: 1, now: NOW });
    const after = readState({ root });

    expect(gc.removed).toContain('gates.old');
    expect(after.gates.old).toBeUndefined();
    expect(after.gates.fresh?.key).toBe('k');
    expect(after.cause).toBeNull();
    expect(gc.removed.some((entry: string) => entry.includes('alt.log'))).toBe(true);
    expect(existsSync(oldLog)).toBe(false);
  });

  it('haelt den Pfad der Agentensicht stabil und schreibt sie atomar', () => {
    const { root } = tempRoot();
    const view = writeContextView({ systems: [] }, { root });
    expect(view.file).toBe('.verify-cache/agent-context.json');
    expect(view.bytes).toBeGreaterThan(0);
    expect(JSON.parse(readFileSync(join(root, '.verify-cache', 'agent-context.json'), 'utf8')).systems).toEqual([]);
  });

  /**
   * Zwei Prozesse, die gleichzeitig verschiedene Abschnitte schreiben, duerfen
   * sich nicht gegenseitig ueberschreiben: Der eine schreibt in `gates`,
   * waehrend der andere `delegated` (den Platz von `task`/`base`) fortschreibt.
   * Ohne Sperre liest jeder den Stand, den er zuletzt gesehen hat, und der
   * Rename des zweiten loescht die Eintraege des ersten.
   */
  it('verliert keine Eintraege bei gleichzeitigen Schreibern auf verschiedene Abschnitte', async () => {
    const { root } = tempRoot();
    const moduleUrl = pathToFileURL(join(process.cwd(), 'scripts', 'lib', 'verify-state.mjs')).href;
    const writer = `
      const { writeGate, updateSection } = await import(process.argv[1]);
      const [root, tag] = process.argv.slice(2);
      for (let i = 0; i < 20; i += 1) {
        writeGate('gate-' + tag + '-' + i, { key: 'k' + i, at: 1 }, { root });
        updateSection('delegated', { [tag + '-' + i]: i }, { root });
      }
    `;
    const tags = ['a', 'b', 'c', 'd'];
    await Promise.all(tags.map((tag) => new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, ['--input-type=module', '-e', writer, moduleUrl, root, tag], { stdio: 'inherit' });
      child.on('error', reject);
      child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`Schreiber ${tag} endete mit Code ${code}`))));
    })));

    const gates = readGates({ root });
    const delegated = readSection('delegated', { root }) as Record<string, number>;
    const missingGates = tags.flatMap((tag) => Array.from({ length: 20 }, (_, i) => `gate-${tag}-${i}`)).filter((name) => !(name in gates));
    const missingDelegated = tags.flatMap((tag) => Array.from({ length: 20 }, (_, i) => `${tag}-${i}`)).filter((key) => !(key in delegated));

    expect(missingGates).toEqual([]);
    expect(missingDelegated).toEqual([]);
    expect(Object.keys(gates)).toHaveLength(80);
    expect(delegated['a-0']).toBe(0);
    expect(delegated['d-19']).toBe(19);
  }, 30_000);

  it('migriert idempotent und laesst Unbekanntes liegen', () => {
    const { root, dir } = tempRoot();
    writeFileSync(join(dir, 'fremd.json'), JSON.stringify({ hello: 'world' }));
    const first = migrateLegacy({ root });
    const second = migrateLegacy({ root });
    expect(first.removed).toEqual([]);
    expect(second.removed).toEqual([]);
    expect(existsSync(join(dir, 'fremd.json'))).toBe(true);
    clearSection('delegated', { root });
    expect(readSection('delegated', { root })).toBeNull();
  });
});
