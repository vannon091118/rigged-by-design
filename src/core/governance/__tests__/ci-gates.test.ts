/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Local-first: Der PR-Lauf traegt genau einen schnellen Pflichtstatus. Die
 * vollstaendigen Integration-Gates laufen lokal; die Cloud prueft PR-Body,
 * Commit-Konvention, Governance-Freeze und die Light-Gates.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly if?: string;
  readonly id?: string;
  readonly env?: Readonly<Record<string, string>>;
}

interface Job {
  readonly name?: string;
  readonly needs?: string | readonly string[];
  readonly strategy?: { readonly matrix?: string };
  readonly steps?: readonly Step[];
}

interface Workflow {
  readonly on?: {
    readonly pull_request?: { readonly branches?: readonly string[]; readonly types?: readonly string[] };
    readonly push?: unknown;
    readonly workflow_dispatch?: {
      readonly inputs?: Readonly<Record<string, { readonly default?: unknown; readonly type?: string }>>;
    };
  };
  readonly permissions?: Readonly<Record<string, string>>;
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (name: string): Workflow =>
  parse(readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')) as Workflow;
const steps = (flow: Workflow, job: string): readonly Step[] => flow.jobs?.[job]?.steps ?? [];
const stepWith = (flow: Workflow, job: string, needle: string): Step | undefined =>
  steps(flow, job).find((step) => step.run?.includes(needle));

describe('Local-first Main-Gate', () => {
  it('hat genau einen schnellen Pflichtjob ohne Matrix und ohne Push-Lauf', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    expect(ci.on?.pull_request?.types).toEqual(['opened', 'synchronize', 'reopened']);
    expect(ci.on?.push).toBeUndefined();
    expect(ci.on?.workflow_dispatch?.inputs?.profile?.default).toBe('light');
    expect(ci.permissions?.contents).toBe('read');
    expect(ci.permissions?.['pull-requests']).toBe('read');

    expect(Object.keys(ci.jobs ?? {})).toEqual(['verify']);
    expect(ci.jobs?.verify?.name).toBe('Fail-Closed Gates');
    expect(ci.jobs?.verify?.strategy).toBeUndefined();
    expect(ci.jobs?.verify?.needs).toBeUndefined();
  });

  it('prueft PR-Body, Commit-Konvention und Freeze vor dem lokalen Gate', () => {
    const ci = workflow('ci-verify.yml');
    const body = steps(ci, 'verify').find((step) => step.name === 'PR-Body');
    expect(body?.if).toContain("github.event_name == 'pull_request'");
    expect(body?.run).toContain('gh pr view');
    expect(body?.run).toContain('PR_BODY="$body" node scripts/verify-pr-body.mjs');

    const commit = stepWith(ci, 'verify', 'verify-commit-msg.mjs --head');
    expect(commit).not.toBeUndefined();

    const freeze = steps(ci, 'verify').find((step) => step.name === 'Governance-Freeze');
    expect(freeze?.run).toContain('.rbd-control/scripts/verify-governance-freeze.mjs');
    expect(freeze?.run).toContain('RBD_ROOT="$PWD"');
    expect(freeze?.run).not.toContain('github.event.before');

    const gate = stepWith(ci, 'verify', 'verify:${PROFILE}');
    expect(gate?.env?.PROFILE).toContain("inputs.profile || 'light'");
    expect(gate?.run).toBe('pnpm run "verify:${PROFILE}"');
  });

  it('laesst keine Matrix, Langlaeufe oder Claim-Jobs im Cloud-Pflichtcheck', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.jobs?.gate).toBeUndefined();
    expect(ci.jobs?.light).toBeUndefined();
    expect(ci.jobs?.long).toBeUndefined();
    expect(ci.jobs?.claims).toBeUndefined();
    expect(ci.jobs?.commitmsg).toBeUndefined();
    expect(ci.jobs?.plan).toBeUndefined();
    expect(ci.jobs?.verify?.steps?.some((step) => step.run?.includes('run-pipeline.mjs --profile='))).toBe(false);
  });
});
