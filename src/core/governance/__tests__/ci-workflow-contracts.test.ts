/**
 * @test-target: .github/workflows/auto-version-release.yml
 * @error-code: ERR-4008
 *
 * Die Workflows um den Pflichtcheck: Debug-APK und Release-Bump laufen im
 * PR-Pflichtjob; der signierte APK-Fallback und Releases bleiben manuell,
 * Langlaeufe haben keinen Zeitplan; Cleanup und Lane-PR bleiben schlank.
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
  readonly uses?: string;
  readonly if?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly 'timeout-minutes'?: number;
  readonly strategy?: { readonly matrix?: string };
  readonly steps?: readonly Step[];
  readonly with?: Readonly<Record<string, unknown>>;
}

interface Workflow {
  readonly on?: {
    readonly pull_request?: { readonly branches?: readonly string[]; readonly types?: readonly string[] };
    readonly push?: { readonly branches?: readonly string[]; readonly tags?: readonly string[] };
    readonly workflow_run?: {
      readonly workflows?: readonly string[];
      readonly types?: readonly string[];
      readonly branches?: readonly string[];
    };
    readonly workflow_dispatch?: {
      readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>>;
    };
    readonly workflow_call?: unknown;
    readonly schedule?: readonly { readonly cron: string }[];
  };
  readonly permissions?: Readonly<Record<string, string>>;
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (name: string): Workflow =>
  parse(readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')) as Workflow;
const steps = (flow: Workflow, job: string): readonly Step[] => flow.jobs?.[job]?.steps ?? [];
const stepWith = (flow: Workflow, job: string, needle: string): Step | undefined =>
  steps(flow, job).find((step) => step.run?.includes(needle));
const stepIndex = (flow: Workflow, job: string, needle: string): number =>
  steps(flow, job).findIndex((step) => step.run?.includes(needle) ?? false);

describe('Workflow-Vertraege', () => {
  it('taggt nur nach einem manuellen Release-Lauf und baut keine Cloud-APK', () => {
    const release = workflow('auto-version-release.yml');
    expect(release.on?.workflow_run).toBeUndefined();
    expect(release.on?.workflow_dispatch).not.toBeUndefined();
    expect(release.jobs?.apk).toBeUndefined();

    const verified = stepWith(release, 'release', 'verify:release');
    expect(verified).not.toBeUndefined();
    expect(stepIndex(release, 'release', 'ci-tag-release.mjs'))
      .toBeGreaterThan(stepIndex(release, 'release', 'verify:release'));

    const tagStep = stepWith(release, 'release', 'ci-tag-release.mjs');
    expect(tagStep?.run).toContain('--github-output');
    expect(tagStep?.env?.RELEASE_SHA).toContain('github.sha');
  });

  it('haelt lange Nachweise ausschliesslich on-demand', () => {
    const long = workflow('long-checks.yml');
    expect(long.on?.schedule).toBeUndefined();
    expect(long.on?.workflow_dispatch?.inputs?.soak_ticks?.default).toBe('100000');
    expect(long.permissions?.contents).toBe('read');
    expect(long.jobs?.verify?.name).toBe('Long Verify');
    expect(stepWith(long, 'verify', 'verify:all')?.env?.RBD_VERIFY_AUDIT).toBe('1');
    const statistics = stepWith(long, 'statistics', 'round-rtp-high.test.ts');
    expect(statistics?.run).toContain('poker-distribution.test.ts');
    expect(stepWith(long, 'soak', 'soak.test.ts')?.env?.RBD_SOAK_TICKS).toBe("${{ inputs.soak_ticks || '100000' }}");
    expect(stepWith(long, 'bench', 'pnpm run test:perf')?.run).toBe('pnpm run test:perf');
  });

  it('loescht gemergte Wegwerf-Branches und schont geschuetzte Branches', () => {
    const cleanup = workflow('pr-cleanup.yml');
    expect(cleanup.on?.pull_request?.types).toEqual(['closed']);
    expect(cleanup.permissions?.contents).toBe('write');
    expect(cleanup.permissions?.['pull-requests']).toBe('write');

    const job = cleanup.jobs?.['delete-branch'];
    expect(job?.name).toBe('Gemergten Head-Branch loeschen');
    expect(job?.if).toContain('github.event.pull_request.merged == true');
    expect(job?.if).toContain('keep-branch');
    expect(job?.if).toContain("github.event.pull_request.head.ref != 'main'");
    expect(job?.if).toContain("github.event.pull_request.head.ref != 'integration'");
    expect(job?.if).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    const step = steps(cleanup, 'delete-branch')[0];
    expect(step?.run).toContain('gh api -X DELETE');
    expect(step?.run).toContain('repos/${GITHUB_REPOSITORY}/git/refs/heads/${BRANCH}');
    expect(step?.run).toContain('keep-branch');

    const closeout = cleanup.jobs?.['post-merge-closeout'];
    expect(closeout?.if).toContain('github.event.pull_request.merged == true');
    expect(closeout?.if).toContain('github.event.pull_request.head.repo.full_name == github.repository');
    expect(stepWith(cleanup, 'post-merge-closeout', 'post-merge-closeout.mjs')?.run).toContain('node scripts/post-merge-closeout.mjs');
    expect(stepWith(cleanup, 'post-merge-closeout', 'post-merge-closeout.mjs')?.env?.MERGE_SHA).toContain('merge_commit_sha');
  });

  it('haelt den signierten APK-Fallback manuell und ohne skip-verify-Abkürzung', () => {
    const apk = workflow('build-apk.yml');
    expect(apk.on?.workflow_call).toBeUndefined();
    expect(apk.on?.push).toBeUndefined();
    expect(apk.on?.workflow_dispatch).not.toBeUndefined();
    expect(apk.jobs?.apk?.['timeout-minutes']).toBe(40);
    const verify = stepWith(apk, 'apk', 'verify:release');
    expect(verify).not.toBeUndefined();
    expect(verify?.if).toBeUndefined();
  });

  it('startet den Pflichtcheck ausschliesslich bei PR und baut die Debug-APK', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.workflow_dispatch).toBeUndefined();
    expect(ci.on?.push).toBeUndefined();
    expect(ci.jobs?.verify?.strategy).toBeUndefined();
    expect(stepWith(ci, 'verify', 'android:apk')).not.toBeUndefined();
    expect(stepWith(ci, 'verify', 'version-bump.mjs')).not.toBeUndefined();
  });

  it('laesst Lane-Pushes nur den PR anlegen oder aktualisieren', () => {
    const ensure = workflow('ensure-pr.yml');
    expect(ensure.on?.push?.branches).toEqual(['lane/**']);
    expect(ensure.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    const step = steps(ensure, 'ensure-pr').find((entry) => entry.run?.includes("'pr', 'create'"));
    expect(step?.env?.GH_TOKEN).toContain('steps.app.outputs.token');
    expect(steps(ensure, 'ensure-pr').some((entry) => entry.name === 'App-Token')).toBe(true);
  });
});
