/**
 * @test-target: .github/workflows/long-checks.yml
 * @error-code: ERR-4008
 *
 * Workflows sind ausfuehrbarer Code. Zwei Grenzen werden hier strukturell
 * geprueft: keine ungepruefte Eingabe in einer Shell-Zeile und keine bewegliche
 * Action-Referenz. Die langen Nachweise bleiben sonst unveraendert.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, string>>;
}

interface Job {
  readonly uses?: string;
  readonly outputs?: Readonly<Record<string, string>>;
  readonly steps?: readonly Step[];
}

interface Workflow {
  readonly permissions?: Readonly<Record<string, string>>;
  readonly on?: {
    readonly workflow_dispatch?: {
      readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>>;
    };
  };
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflowDir = resolve(process.cwd(), '.github', 'workflows');

const workflowFiles = (): string[] =>
  readdirSync(workflowDir).filter((file) => file.endsWith('.yml')).sort();

const workflow = (file: string): Workflow =>
  parse(readFileSync(resolve(workflowDir, file), 'utf8')) as Workflow;

const jobs = (flow: Workflow): readonly Job[] => Object.values(flow.jobs ?? {});

const usesOf = (flow: Workflow): string[] =>
  jobs(flow).flatMap((job) => [
    ...(job.uses ? [job.uses] : []),
    ...(job.steps ?? []).flatMap((step) => (step.uses ? [step.uses] : [])),
  ]);

const runsOf = (flow: Workflow): string[] =>
  jobs(flow).flatMap((job) => (job.steps ?? []).flatMap((step) => (step.run ? [step.run] : [])));

const stepWithRun = (flow: Workflow, needle: string): Step | undefined =>
  jobs(flow).flatMap((job) => job.steps ?? []).find((step) => step.run?.includes(needle) ?? false);

describe('workflow hardening', () => {
  it('pinnt jede Action auf einen vollen Commit-SHA', () => {
    const unpinned: string[] = [];
    for (const file of workflowFiles()) {
      for (const use of usesOf(workflow(file))) {
        if (use.startsWith('./')) continue;
        if (!/@[0-9a-f]{40}$/.test(use)) unpinned.push(`${file}: ${use}`);
      }
    }
    expect(unpinned).toEqual([]);
  });

  it('baut den Balance-Lauf ohne Eingabe in der Shell-Zeile', () => {
    const long = workflow('long-checks.yml');
    const runs = runsOf(long);
    expect(runs.length).toBeGreaterThan(0);
    expect(runs.filter((run) => run.includes('${{')).length).toBe(0);

    const balance = stepWithRun(long, 'balance-run.mjs');
    expect(balance?.run).toBe('node scripts/balance-run.mjs');
    expect(balance?.env?.RBD_DAYS).toBe("${{ inputs.balance_days || '40' }}");
  });

  it('pinnt den Langlauf auf den uebergebenen Commit', () => {
    const long = workflow('long-checks.yml');
    expect(long.on?.workflow_dispatch?.inputs?.sha?.type).toBe('string');
    expect(long.on?.workflow_dispatch?.inputs?.sha?.default).toBe('');
    const checkouts = jobs(long)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.uses?.startsWith('actions/checkout@') ?? false);
    expect(checkouts.length).toBe(6);
    for (const step of checkouts) {
      expect(step.with?.ref).toContain('inputs.sha');
      expect(step.with?.['fetch-depth']).toBe(0);
    }
  });

  it('plant den Langlauf ohne main-Zwang und ohne verify:all', () => {
    const plan = spawnSync(process.execPath, [resolve(process.cwd(), 'scripts', 'ci-long-checks.mjs'), '--plan', '--ref', 'lane/test/plan'], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });
    expect(plan.status).toBe(0);
    const parsed = JSON.parse(plan.stdout) as {
      workflow: string;
      ref: string;
      sha: string;
      inputs: { verify: boolean; sha: string };
    };
    expect(parsed.workflow).toBe('long-checks.yml');
    expect(parsed.ref).toBe('lane/test/plan');
    expect(parsed.inputs.verify).toBe(false);
    expect(parsed.sha).toBe(parsed.inputs.sha);
    expect(parsed.sha).toMatch(/^[0-9a-f]{40}$/);
  });

  it('gibt der Testsuite keinen Kontroll-Root, den Node-Gates aber schon', () => {
    const ci = workflow('ci-verify.yml');
    const gateStep = stepWithRun(ci, 'run-pipeline.mjs');
    expect(gateStep?.env?.RBD_CONTROL_ROOT).toContain("matrix.gate != 'tests'");
  });

  it('laesst keine Bootstrap-Ausnahme in der CI', () => {
    const ci = workflow('ci-verify.yml');
    const runs = runsOf(ci).join('\n');
    expect(runs).not.toContain('Bootstrap');
    expect(runs).not.toContain('scripts=$GITHUB_WORKSPACE/scripts');
    expect(runs).toContain('kennt RBD_ROOT nicht');
    const controls = jobs(ci)
      .flatMap((job) => job.steps ?? [])
      .filter((step) => step.name === 'Kontrollebene aus der Basis');
    expect(controls.length).toBeGreaterThanOrEqual(5);
    for (const step of controls) expect(step.env?.BASE_SHA).not.toContain('github.event.before');
  });

  it('fuehrt lange Tests mit der Kontrollebene aus', () => {
    const ci = workflow('ci-verify.yml');
    const long = ci.jobs?.long;
    const control = long?.steps?.find((step) => step.name === 'Kontrollebene aus der Basis');
    const run = long?.steps?.find((step) => step.name === 'Langen Nachweis ausfuehren');
    expect(control?.name).toBe('Kontrollebene aus der Basis');
    expect(run?.run).toContain('steps.control.outputs.scripts');
    expect(run?.env?.RBD_ROOT).toContain('steps.control.outputs.root');
    expect(run?.env?.RBD_REQUIRE_TESTS).toBe('1');
    expect(run?.env?.RBD_BALANCE).toBe('1');
  });

  it('haelt den Pflichtstatus in genau einem Workflow', () => {
    // `Fail-Closed Gates` ist der geschuetzte Statusname aus Ebene B. Trüge ihn
    // ein zweiter Workflow, gaebe es zwei Wahrheiten fuer denselben Status und
    // ein gruener Lauf koennte den anderen verdecken.
    const owners: string[] = [];
    for (const file of workflowFiles()) {
      for (const [id, job] of Object.entries(workflow(file).jobs ?? {})) {
        if ((job as { name?: string } | null)?.name === 'Fail-Closed Gates') owners.push(`${file}:${id}`);
      }
    }
    expect(owners).toEqual(['ci-verify.yml:verify']);
  });

  it('pflegt Action-Pins per Dependabot', () => {
    const text = readFileSync(resolve(process.cwd(), '.github', 'dependabot.yml'), 'utf8');
    expect(text).toContain('package-ecosystem: "github-actions"');
    expect(text).toContain('interval: "weekly"');
  });

  it('gibt Auto-Resolve das Schreibrecht fuer Wiederholungen', () => {
    const auto = workflow('auto-resolve.yml');
    expect(auto.permissions?.issues).toBe('write');
    expect(auto.permissions?.actions).toBe('write');
  });

  it('validiert die Langlauf-Eingaben vor dem Dispatch', () => {
    const bad = spawnSync(process.execPath, [
      resolve(process.cwd(), 'scripts', 'ci-long-checks.mjs'),
      '--plan', '--ref', 'lane/test/plan', '--soak-ticks', '0',
    ], { cwd: process.cwd(), encoding: 'utf8' });
    expect(bad.status).toBe(1);
    expect(bad.stderr).toContain('soak-ticks');
  });

  it('kompatibilisiert Plan-Metadaten mit der Basis-Kontrollebene', () => {
    const ci = workflow('ci-verify.yml');
    const plan = ci.jobs?.plan;
    const compat = plan?.steps?.find((step) => step.name === 'Plan-Metadaten kompatibilisieren');
    expect(compat?.run).toContain('state=PR');
    expect(compat?.run).toContain('required="$gates"');
    expect(plan?.outputs?.state).toContain('steps.compat.outputs.state');
    expect(plan?.outputs?.run).toContain('steps.compat.outputs.run');
    expect(plan?.outputs?.required).toContain('steps.compat.outputs.required');
    const validate = plan?.steps?.find((step) => step.name === 'Matrix validieren');
    expect(validate?.env?.STATE).toContain('steps.compat.outputs.state');
    expect(validate?.env?.REQUIRED).toContain('steps.compat.outputs.required');
  });

  it('verweist fuer die Testlinie auf docs/TESTING.md', () => {
    const agents = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf8');
    expect(agents).toContain('pnpm run agent:pretask --json');
    expect(agents).toContain('docs/TESTING.md');
    expect(agents.match(/### Die eine Testlinie/g)?.length ?? 0).toBe(0);
    expect(agents.match(/^\d+\. \*\*/gm)?.length ?? 0).toBe(10);

    const testing = readFileSync(resolve(process.cwd(), 'docs', 'TESTING.md'), 'utf8');
    expect(testing.match(/### Die eine Testlinie/g)?.length ?? 0).toBe(1);
    expect(testing).not.toContain('Keine lokalen Testlaeufe');
    expect(testing).not.toContain('Nicht mitten im Turn: `pnpm run test`');
  });
});
