/**
 * @test-target: scripts/lib/pipeline-plan.mjs
 * @error-code: ERR-0911
 *
 * Red-Team der Test- und Gate-Lane. Der Test prueft nicht ein einzelnes Gate,
 * sondern die Lane selbst: Gate-Sammlung und Profile muessen unveraenderlich
 * bleiben, jedes Gate muss seinen urspruenglichen Pruefauftrag behalten, und
 * Planung und Matrix muessen bei gleichem Zustand identisch bleiben. Kein Lauf
 * darf den Quellbaum schreiben; der Runner muss den Exitcode lesen, nicht die
 * Ausgabe. Die `PURPOSE`-Tabelle ist absichtlich literal und nicht aus `GATES`
 * abgeleitet: Wer ein Gate vertauscht, kann die Erwartung nicht mitverschieben.
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { executeStep } from '../../../../scripts/lib/gate-runner.mjs';
import {
  CI_STATES,
  GATES,
  PROFILE_GATES,
  PROFILES,
  QUICK_GATES,
  REQUIRED_CI_GATES,
  planGates,
} from '../../../../scripts/lib/pipeline-plan.mjs';

interface GateDefinition {
  readonly name: string;
  readonly command: 'node' | 'pnpm';
  readonly script: string;
  readonly args?: readonly string[];
  readonly code: string;
  readonly timeoutMs: number;
}

interface PackageJson {
  readonly scripts?: Readonly<Record<string, string>>;
}

const ROOT = process.cwd();
const gates = GATES as unknown as Record<string, GateDefinition>;
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')) as PackageJson;
const stateDir = mkdtempSync(join(tmpdir(), 'rbd-red-team-gate-'));

afterAll(() => {
  rmSync(stateDir, { recursive: true, force: true });
});

/**
 * Der unveraenderliche Zweck jedes Gates. `packageToken` belegt fuer pnpm-Gates,
 * dass das Paketskript wirklich den erwarteten Pruefer aufruft; Node-Gates
 * werden ueber ihren Skriptpfad geprueft. Ein neuer Gate-Key ist hier ein
 * bewusster Vertragsaenderung, kein stiller Zusatz.
 */
const PURPOSE = {
  lint: { command: 'pnpm', script: 'lint', code: 'ERR-4011', packageToken: 'eslint' },
  'check:loc': { command: 'pnpm', script: 'check:loc', code: 'ERR-4012', packageToken: 'check-loc.mjs' },
  typecheck: { command: 'pnpm', script: 'typecheck', code: 'ERR-1005', packageToken: 'tsc' },
  'test-quality': { command: 'node', script: 'scripts/verify-test-quality.mjs', code: 'ERR-4002', packageToken: '' },
  'dead-code': { command: 'node', script: 'scripts/verify-dead-code.mjs', code: 'ERR-4003', packageToken: '' },
  docs: { command: 'node', script: 'scripts/verify-docs.mjs', code: 'ERR-4017', packageToken: '' },
  catalog: { command: 'node', script: 'scripts/test-catalog.mjs', code: 'ERR-4015', packageToken: '' },
  tree: { command: 'node', script: 'scripts/verify-tree.mjs', code: 'ERR-4019', packageToken: '' },
  'impact-graph': { command: 'node', script: 'scripts/verify-impact-graph.mjs', code: 'ERR-4019', packageToken: '' },
  redundancy: { command: 'node', script: 'scripts/verify-redundancy.mjs', code: 'ERR-4020', packageToken: '' },
  assets: { command: 'pnpm', script: 'verify:assets', code: 'ERR-4016', packageToken: 'verify-assets.mjs' },
  capabilities: { command: 'node', script: 'scripts/verify-capabilities.mjs', code: 'ERR-4025', packageToken: '' },
  narrative: { command: 'node', script: 'scripts/verify-narrative-blocks.mjs', code: 'ERR-4022', packageToken: '' },
  audit: { command: 'pnpm', script: 'audit:gate', code: 'ERR-4004', packageToken: 'pnpm audit' },
  tests: { command: 'pnpm', script: 'test:ci', code: 'ERR-4026', packageToken: 'run-selected-tests.mjs' },
  affected: { command: 'node', script: 'scripts/test-affected.mjs', code: 'ERR-4026', packageToken: '' },
  build: { command: 'pnpm', script: 'build', code: 'ERR-1005', packageToken: 'vite build' },
} as const;

function gateAt(key: string): GateDefinition {
  const gate = gates[key];
  if (!gate) throw new Error(`Gate fehlt: ${key}`);
  return gate;
}

function treeDigest(root: string): string {
  const hash = createHash('sha256');
  const walk = (dir: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile()) {
        hash.update(relative(root, full));
        hash.update(readFileSync(full));
      }
    }
  };
  walk(root);
  return hash.digest('hex');
}

function runNode(args: string[], env: Record<string, string> = {}): string {
  return execFileSync(process.execPath, args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GITHUB_STEP_SUMMARY: '', ...env },
  }).trim();
}

describe('Red-Team: Test- und Gate-Lane', () => {
  it('haelt Gate-Sammlung und Profile unveraenderlich und weist Mutationen ab', () => {
    // Ein tiefes Einfrieren der einzelnen Gate-Objekte wuerde scripts/lib/
    // aendern; das liegt hinter dem Governance-Freeze. Geprueft wird deshalb
    // die freigegebene Unveraenderlichkeit der Sammlung und der Profile.
    expect(Object.isFrozen(GATES)).toBe(true);
    expect(() => {
      (GATES as unknown as Record<string, unknown>).lint = { name: 'evil' };
    }).toThrow(TypeError);
    expect(gateAt('lint').script).toBe('lint');

    const profile = PROFILE_GATES.light as unknown as string[];
    expect(() => { profile.push('evil'); }).toThrow(TypeError);
    expect(QUICK_GATES).not.toContain('evil');
    expect(Object.isFrozen(QUICK_GATES)).toBe(true);
    expect(Object.isFrozen(REQUIRED_CI_GATES)).toBe(true);
    expect(Object.isFrozen(CI_STATES)).toBe(true);
  });

  it('haelt fuer jedes Gate Zweck, Befehl und einen echten, lesenden Pruefer fest', () => {
    expect(Object.keys(gates).sort()).toEqual(Object.keys(PURPOSE).sort());

    for (const [key, expected] of Object.entries(PURPOSE)) {
      const gate = gateAt(key);
      expect(gate.name).toBe(key);
      expect(gate.command).toBe(expected.command);
      expect(gate.script).toBe(expected.script);
      expect(gate.code).toBe(expected.code);
      expect(gate.timeoutMs).toBeGreaterThan(0);

      const invocation = [gate.script, ...(gate.args ?? [])].join(' ');
      expect(invocation).not.toMatch(/(^|\s)(--fix|--write|--apply|--force|autofix|rm|mv|tee|sed\s+-i)(\s|$)/);

      if (gate.command === 'node') {
        expect(readFileSync(resolve(ROOT, gate.script), 'utf8').length).toBeGreaterThan(0);
      } else {
        const command = packageJson.scripts?.[gate.script] ?? '';
        expect(command.length).toBeGreaterThan(0);
        expect(command).toContain(expected.packageToken);
      }
    }
  });

  it('plant jedes Gate in einem Profil und laesst keine Pflicht aus', () => {
    const planned = new Set<string>(Object.values(PROFILE_GATES).flatMap((value) => value as string[]));
    for (const key of Object.keys(gates)) {
      expect(planned.has(key), `${key} ist in keinem Profil geplant`).toBe(true);
    }

    const required = Object.keys(gates).filter((key) => key !== 'affected' && key !== 'audit').sort();
    expect([...REQUIRED_CI_GATES].sort()).toEqual(required);
    expect(planGates('quick')).toEqual([...QUICK_GATES]);
    expect(planGates('full')).toEqual([...REQUIRED_CI_GATES, 'audit']);

    for (const profile of PROFILES) {
      const plan = planGates(profile) ?? [];
      expect(new Set(plan).size, `${profile} enthaelt ein doppeltes Gate`).toBe(plan.length);
    }
  });

  it('erzeugt Matrix und CI-Plan bei gleichem Zustand identisch und ohne Quellmutation', () => {
    const before = `${treeDigest(resolve(ROOT, 'src'))}:${treeDigest(resolve(ROOT, 'scripts'))}`;

    const matrixA = runNode(['scripts/gate-matrix.mjs', '--profile=quick']);
    const matrixB = runNode(['scripts/gate-matrix.mjs', '--profile=quick']);
    expect(matrixB).toBe(matrixA);
    const matrix = JSON.parse(matrixA) as { include: { gate: string }[] };
    expect(matrix.include.map((entry) => entry.gate)).toEqual([...QUICK_GATES]);

    const planPath = join(stateDir, 'ci-plan.json');
    const planA = runNode(['scripts/ci-plan.mjs', '--event=workflow_dispatch', '--json=1'], { CI_PLAN_PATH: planPath });
    const planB = runNode(['scripts/ci-plan.mjs', '--event=workflow_dispatch', '--json=1'], { CI_PLAN_PATH: planPath });
    expect(planB).toBe(planA);
    const report = JSON.parse(planA) as { state: string; gates: string[] };
    expect(report.state).toBe('MANUAL');
    expect(report.gates).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES, 'audit']));

    const after = `${treeDigest(resolve(ROOT, 'src'))}:${treeDigest(resolve(ROOT, 'scripts'))}`;
    expect(after).toBe(before);
  });

  it('wertet den Exitcode eines Gates und nicht seine Ausgabe', async () => {
    const falsePass = join(stateDir, 'false-pass.mjs');
    const falseFail = join(stateDir, 'false-fail.mjs');
    writeFileSync(falsePass, "console.log('PASS'); process.exit(7);\n");
    writeFileSync(falseFail, "console.log('FAIL'); process.exit(0);\n");

    const failed = await executeStep({
      name: 'red-team-false-pass', command: 'node', script: falsePass, code: 'ERR-4026', timeoutMs: 30_000,
    });
    expect(failed.status).toBe(7);
    expect(failed.timedOut).toBe(false);

    const passed = await executeStep({
      name: 'red-team-false-fail', command: 'node', script: falseFail, code: 'ERR-4026', timeoutMs: 30_000,
    });
    expect(passed.status).toBe(0);
  });
});
