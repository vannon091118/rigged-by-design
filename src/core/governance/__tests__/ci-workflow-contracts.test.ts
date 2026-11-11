/**
 * @test-target: .github/workflows/auto-version-release.yml
 * @error-code: ERR-4008
 *
 * Die Workflows um das Main-Gate: Release, Langlauf, Cleanup, APK und der
 * duenne Lane-Push. Sie werden als YAML-Baum geprueft, nicht als Zeichenkette.
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
  readonly with?: Readonly<Record<string, unknown>>;
}

interface Job {
  readonly name?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly 'timeout-minutes'?: number;
  readonly strategy?: { readonly matrix?: string; readonly 'fail-fast'?: boolean };
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
    readonly workflow_dispatch?: { readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>> };
    readonly workflow_call?: { readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>> };
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
  it('taggt erst nach erfolgreichem CI-Verify-Lauf ohne zweite Suite', () => {
    const release = workflow('auto-version-release.yml');
    expect(release.on?.workflow_run?.workflows).toEqual(['CI Verify']);
    expect(release.on?.workflow_run?.types).toEqual(['completed']);
    expect(release.on?.workflow_run?.branches).toEqual(['main']);
    expect(release.on?.push).toBeUndefined();

    const condition = release.jobs?.release?.if ?? '';
    expect(condition).toContain("workflow_run.conclusion == 'success'");
    expect(condition).toContain("workflow_run.event == 'push'");
    expect(condition).toContain("workflow_run.head_branch == 'main'");

    const verified = stepWith(release, 'release', 'npm run verify:release');
    expect(verified?.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(stepIndex(release, 'release', 'ci-tag-release.mjs'))
      .toBeGreaterThan(stepIndex(release, 'release', 'npm run verify:release'));

    // APK-Relevanz kommt aus dem Produkt-Impact, nicht aus `scripts/`.
    expect(stepWith(release, 'release', 'release-impact.mjs')?.id).toBe('relevance');
    const tagStep = stepWith(release, 'release', 'ci-tag-release.mjs');
    expect(tagStep?.run).toContain('--github-output');
    expect(tagStep?.env?.RELEASE_SHA).toContain('github.event.workflow_run.head_sha');
  });

  it('delegiert die langen Nachweise an einen eigenen Workflow', () => {
    const long = workflow('long-checks.yml');
    expect(long.on?.workflow_dispatch?.inputs?.soak_ticks?.default).toBe('100000');
    expect(long.permissions?.contents).toBe('read');
    expect(long.jobs?.verify?.name).toBe('Long Verify');
    expect(stepWith(long, 'verify', 'npm run verify:all')?.env?.RBD_VERIFY_AUDIT).toBe('1');
    const statistics = stepWith(long, 'statistics', 'round-rtp-high.test.ts');
    expect(statistics?.run).toContain('poker-distribution.test.ts');
    expect(stepWith(long, 'soak', 'soak.test.ts')?.env?.RBD_SOAK_TICKS).toBe("${{ inputs.soak_ticks || '100000' }}");
    expect(long.on?.schedule?.[0]?.cron).toBe('0 3 * * 1');
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

  it('startet den APK-Build aus dem Release und wartet auf das Artefakt', () => {
    const release = workflow('auto-version-release.yml');
    const apkJob = release.jobs?.apk;
    expect(apkJob?.uses).toBe('./.github/workflows/build-apk.yml');
    expect(apkJob?.with?.tag).toBe('${{ needs.release.outputs.tag }}');
    expect(apkJob?.with?.skip_verify).toBe(true);

    const apk = workflow('build-apk.yml');
    expect(apk.on?.workflow_call?.inputs?.skip_verify?.type).toBe('boolean');
    expect(apk.on?.push?.tags).toEqual(['v*.*.*']);
    expect(apk.jobs?.apk?.['timeout-minutes']).toBe(40);
    expect(stepWith(apk, 'apk', 'npm run verify:release')?.if).toContain('inputs.skip_verify');
  });

  it('startet den Verify-Workflow auch von Hand', () => {
    expect(workflow('ci-verify.yml').on?.workflow_dispatch).not.toBeUndefined();
  });

  it('laesst Lane-Pushes nur den PR anlegen oder aktualisieren', () => {
    const ensure = workflow('ensure-pr.yml');
    expect(ensure.on?.push?.branches).toEqual(['lane/**']);
    expect(ensure.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    const step = steps(ensure, 'ensure-pr').find((entry) => entry.run?.includes("'pr', 'create'"));
    expect(step?.env?.GH_TOKEN).toContain('steps.app.outputs.token');
    expect(steps(ensure, 'ensure-pr').some((entry) => entry.uses?.startsWith('actions/create-github-app-token@'))).toBe(true);
  });
});
