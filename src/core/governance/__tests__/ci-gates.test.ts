/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Local-first: Der optionale PR-Job traegt genau einen schnellen PR-Check. Die
 * vollstaendigen Release-Gates laufen lokal; die Cloud prueft PR-Body,
 * Commit-Konvention, Governance-Freeze, Light-Gates, Debug-APK und
 * Release-Version-Bump des Artefakts.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly id?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, string>>;
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
  it('hat genau einen schnellen optionalen PR-Job ohne Matrix und ohne Push-Lauf', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    expect(ci.on?.pull_request?.types).toEqual(['opened', 'synchronize', 'reopened']);
    expect(ci.on?.push).toBeUndefined();
    expect(ci.on?.workflow_dispatch).toBeUndefined();
    expect(ci.permissions?.contents).toBe('read');
    expect(ci.permissions?.['pull-requests']).toBe('read');

    expect(Object.keys(ci.jobs ?? {})).toEqual(['verify']);
    expect(ci.jobs?.verify?.name).toBe('Fail-Closed Gates');
    expect(ci.jobs?.verify?.strategy).toBeUndefined();
    expect(ci.jobs?.verify?.needs).toBeUndefined();
  });

  it('prueft PR-Body und Commit-Konvention vor dem lokalen Gate', () => {
    const ci = workflow('ci-verify.yml');
    const body = steps(ci, 'verify').find((step) => step.name === 'PR-Body');
    expect(body?.if).toContain("github.event_name == 'pull_request'");
    expect(body?.run).toContain('gh pr view');
    expect(body?.run).toContain('PR_BODY="$body" node scripts/verify-pr-body.mjs');

    const commit = stepWith(ci, 'verify', 'verify-commit-msg.mjs --head');
    expect(commit).not.toBeUndefined();

    expect(steps(ci, 'verify').find((step) => step.name === 'Governance-Freeze')).toBeUndefined();

    const gate = stepWith(ci, 'verify', 'pnpm run verify:light');
    expect(gate).not.toBeUndefined();

    const version = stepWith(ci, 'verify', 'version-bump.mjs');
    expect(version).not.toBeUndefined();

    const apk = stepWith(ci, 'verify', 'android:apk');
    expect(apk).not.toBeUndefined();

    const artifact = steps(ci, 'verify').find((step) => step.uses?.includes('upload-artifact'));
    expect(artifact).not.toBeUndefined();
    expect(artifact?.with?.path).toContain('artifacts/rigged-by-design-debug.apk');
  });

  it('laesst keine Matrix, Langlaeufe oder Claim-Jobs im optionalen PR-Job', () => {
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
