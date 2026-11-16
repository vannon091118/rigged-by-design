/**
 * @test-target: scripts/lib/compact.mjs
 * @error-code: ERR-4019
 *
 * Log-Vertrag: Dateien entstehen nur mit `--log` UND nur fuer fehlerhafte
 * Laeufe; die erste Zeile traegt einen Error Code. Ein gruener Lauf mit
 * `--log` hinterlaesst keine Datei. Die Schrittschreiber (`precommit`,
 * `ci:local`) schreiben erst im Fehlerzweig mit Code.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(process.cwd());
const COMPACT = pathToFileURL(join(ROOT, 'scripts/lib/compact.mjs')).href;

function probe({ exitCode, body, logPath, log }: { exitCode: number; body: string; logPath: string; log: boolean }) {
  const source = `
    import { captureConsole } from ${JSON.stringify(COMPACT)};
    captureConsole({ label: 'probe', logPath: process.env.PROBE_LOG });
    process.stdout.write(${JSON.stringify(body)});
    process.exit(${exitCode});
  `;
  // `--log` ist im Kind ueber RBD_LOG=1 gesetzt: dasselbe Gate, ohne dass
  // node die Option vor `-e` selbst interpretiert. `log: false` laesst es weg
  // und raeumt RBD_LOG aus der Umgebung, damit kein Elternlauf es erbt.
  const env: NodeJS.ProcessEnv = { ...process.env, PROBE_LOG: logPath };
  env.RBD_LOG = log ? '1' : '0';
  return spawnSync(process.execPath, ['-e', source], { encoding: 'utf8', env });
}

describe('Logs nur bei Fehlschlag und nur mit --log', () => {
  it('schreibt bei Exit 0 keine Datei, auch mit --log', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-log-ok-'));
    const logPath = join(dir, 'probe.log');
    const result = probe({ exitCode: 0, body: 'PASS · alles gut', logPath, log: true });
    expect(result.status).toBe(0);
    expect(existsSync(logPath)).toBe(false);
  });

  it('schreibt bei Exit 1 eine Datei mit Error Code in der ersten Zeile', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-log-fail-'));
    const logPath = join(dir, 'probe.log');
    const result = probe({ exitCode: 1, body: 'FAIL · etwas ist rot\nmehr Kontext', logPath, log: true });
    expect(result.status).toBe(1);
    expect(existsSync(logPath)).toBe(true);
    expect(readFileSync(logPath, 'utf8').split('\n')[0]).toContain('[ERR-');
  });

  it('verdoppelt einen vorhandenen Error Code nicht', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-log-code-'));
    const logPath = join(dir, 'probe.log');
    probe({ exitCode: 1, body: '[ERR-4001] schon benannt', logPath, log: true });
    const text = readFileSync(logPath, 'utf8');
    // Zeile 1 nennt den Code; ein zweiter, abweichender Code entsteht nicht.
    expect(text.split('\n')[0]).toContain('[ERR-4001]');
    expect(new Set(text.match(/ERR-\d{4}/g) ?? [])).toEqual(new Set(['ERR-4001']));
  });

  it('schreibt bei Exit 1 ohne --log keine einzige Datei, Fehler bleibt sichtbar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-log-off-'));
    const logPath = join(dir, 'probe.log');
    const result = probe({ exitCode: 1, body: 'FAIL · ohne Flag', logPath, log: false });
    expect(result.status).toBe(1);
    expect(readdirSync(dir)).toEqual([]);
    expect(existsSync(logPath)).toBe(false);
    // Der Befund bleibt sichtbar (stdout oder stderr), auch ohne Logdatei.
    expect(`${result.stdout ?? ''}${result.stderr ?? ''}`).toContain('FAIL · ohne Flag');
  });

  it('erzeugt bei Exit 1 mit --log genau eine Datei', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-log-one-'));
    const logPath = join(dir, 'probe.log');
    probe({ exitCode: 1, body: 'FAIL · mit Flag', logPath, log: true });
    expect(readdirSync(dir)).toEqual(['probe.log']);
    expect(readFileSync(logPath, 'utf8').split('\n')[0]).toMatch(/^\[ERR-\d{4}\]/);
  });

  it('schreibt precommit und ci:local erst im Fehlerzweig mit Code', () => {
    for (const file of ['scripts/precommit.mjs', 'scripts/local-ci.mjs']) {
      const source = readFileSync(join(ROOT, file), 'utf8');
      const writeAt = source.indexOf('writeFileSync(log');
      const failAt = source.indexOf('result.status !== 0');
      expect(writeAt, `${file}: kein Log-Schreiber`).toBeGreaterThan(failAt);
      expect(source).toContain("?? 'ERR-4019'");
      expect(source).toContain('[${code}]');
    }
  });

  it('gate-runner schreibt nur rote Gates und traegt den Schritt-Code', () => {
    const source = readFileSync(join(ROOT, 'scripts/lib/gate-runner.mjs'), 'utf8');
    expect(source).toContain("if (!LOGS || status === 'PASS') return null;");
    expect(source).toContain('[${step.code}] ${step.name}');
  });
});
