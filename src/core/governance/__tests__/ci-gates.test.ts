/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Ebene A des Main-Gates: `main` ist kein Sonderfall mehr, und der
 * Release-Workflow kennt keine Nachricht, die seine Pruefung abschaltet.
 * Die Workflows werden als YAML-Baum geprueft, nicht als Zeichenkette:
 * Schrittfolge, Rechte und Env-Verdrahtung sind Struktur, keine Textposition.
 * Ebene B (Ruleset, Pflichtstatus) ist eine GitHub-Einstellung; sie wird in
 * docs/CI-GATES.md beschrieben und von `npm run verify` nicht erzwungen.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface WorkflowStep {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
  readonly with?: Readonly<Record<string, string>>;
  readonly id?: string;
}

interface WorkflowJob {
  readonly name?: string;
  readonly needs?: string | readonly string[];
  readonly uses?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly 'timeout-minutes'?: number;
  readonly if?: string;
  readonly strategy?: { readonly matrix?: string; readonly 'fail-fast'?: boolean };
  readonly steps?: readonly WorkflowStep[];
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowTrigger {
  readonly pull_request?: {
    readonly branches?: readonly string[];
    readonly types?: readonly string[];
    readonly 'branches-ignore'?: unknown;
  };
  readonly push?: {
    readonly branches?: readonly string[];
    readonly tags?: readonly string[];
  };
  readonly workflow_run?: {
    readonly workflows?: readonly string[];
    readonly types?: readonly string[];
    readonly branches?: readonly string[];
  };
  readonly workflow_dispatch?: {
    readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>>;
  };
  readonly workflow_call?: {
    readonly inputs?: Readonly<Record<string, { readonly type?: string; readonly default?: unknown }>>;
  };
}

interface Workflow {
  readonly on?: WorkflowTrigger;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly jobs?: Readonly<Record<string, WorkflowJob>>;
}

const workflow = (name: string): Workflow =>
  parse(readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')) as Workflow;

const steps = (flow: Workflow, job: string): readonly WorkflowStep[] =>
  flow.jobs?.[job]?.steps ?? [];

const stepIndex = (flow: Workflow, job: string, needle: string): number =>
  steps(flow, job).findIndex((step) => step.run?.includes(needle) ?? false);

const stepWith = (flow: Workflow, job: string, needle: string): WorkflowStep | undefined =>
  steps(flow, job).find((step) => step.run?.includes(needle));

describe('Main-Gate', () => {
  it('prueft granular: ein Status je Gate und ein Aggregat als Pflichtstatus', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    expect(ci.on?.pull_request?.['branches-ignore']).toBeUndefined();
    expect(ci.on?.push?.branches).toEqual(['**']);
    expect(ci.permissions?.contents).toBe('read');
    expect(ci.permissions?.['pull-requests']).toBe('read');

    // Der Pflichtstatus bleibt genau einer: er fuehrt nur Ergebnisse zusammen.
    expect(ci.jobs?.verify?.name).toBe('Fail-Closed Gates');
    expect(ci.jobs?.verify?.if).toBe('always()');
    expect(ci.jobs?.verify?.needs).toEqual(['plan', 'gate', 'claims', 'commitmsg']);
    expect(stepWith(ci, 'verify', 'exit "$fail"')).not.toBeUndefined();

    // Die Arbeit steckt in der Matrix: ein Job, ein Gate, ein Status.
    const gate = ci.jobs?.gate;
    expect(gate?.name).toContain('matrix.gate');
    expect(gate?.strategy?.matrix).toContain('needs.plan.outputs.matrix');
    expect(gate?.strategy?.['fail-fast']).toBe(false);
    expect(stepWith(ci, 'gate', 'run-pipeline.mjs')?.run).toContain('--gate=${{ matrix.gate }}');
    expect(stepWith(ci, 'gate', 'verify:all')).toBeUndefined();

    // Ein Push mit offenem PR endet vor den Gates; der PR-Lauf ist die Wahrheit.
    expect(stepWith(ci, 'plan', 'gh pr list --head')?.id).toBe('dedupe');

    // Profil und Matrix kommen aus derselben Quelle wie `verify`.
    const profile = stepWith(ci, 'plan', 'GITHUB_EVENT_NAME');
    expect(profile?.id).toBe('profile');
    expect(profile?.run).toContain('name=all');
    expect(profile?.run).toContain('name=light');
    // Der Plan liest den echten Diff: Basis und Kopf aus dem Event, dann
    // waehlt `ci-plan.mjs` Gates und Tests. Unklarer Diff -> volles Profil.
    const range = stepWith(ci, 'plan', 'github.event.pull_request.base.sha');
    expect(range?.id).toBe('range');
    expect(range?.run).toContain('github.event.before');
    expect(stepWith(ci, 'plan', 'ci-plan.mjs')?.id).toBe('gates');
    expect(stepWith(ci, 'plan', 'gate-matrix.mjs')).toBeUndefined();
    expect(stepWith(ci, 'gate', 'run-pipeline.mjs')?.env?.RBD_TEST_FILES).toBe('${{ needs.plan.outputs.tests }}');

    // Die Claim-Sperre greift auch ohne lokale Hooks, mindestens im PR-Lauf.
    expect(stepWith(ci, 'claims', 'verify-lane-claims.mjs --ci')).not.toBeUndefined();
    expect(ci.jobs?.claims?.if).toContain("github.event_name == 'pull_request'");
  });

  it('taggt erst nach erfolgreichem CI-Verify-Lauf ohne zweite Suite', () => {
    const release = workflow('auto-version-release.yml');
    expect(release.on?.workflow_run?.workflows).toEqual(['CI Verify']);
    expect(release.on?.workflow_run?.types).toEqual(['completed']);
    expect(release.on?.workflow_run?.branches).toEqual(['main']);
    expect(release.on?.push).toBeUndefined();
    expect(release.permissions?.contents).toBe('write');

    const condition = release.jobs?.release?.if ?? '';
    expect(condition).toContain("workflow_run.conclusion == 'success'");
    expect(condition).toContain("workflow_run.event == 'push'");
    expect(condition).toContain("workflow_run.head_branch == 'main'");

    const verified = stepWith(release, 'release', 'npm run verify:release');
    expect(verified?.if).toContain("github.event_name == 'workflow_dispatch'");
    const verifyIndex = stepIndex(release, 'release', 'npm run verify:release');
    const tagged = stepIndex(release, 'release', 'ci-tag-release.mjs');
    expect(tagged).toBeGreaterThan(verifyIndex);

    // APK-Relevanz kommt aus dem Produkt-Impact, nicht aus `scripts/`.
    const relevance = stepWith(release, 'release', 'release-impact.mjs');
    expect(relevance?.id).toBe('relevance');
    expect(relevance?.run).toContain('--prev=');
    expect(stepWith(release, 'release', 'grep -qE')).toBeUndefined();

    const tagStep = stepWith(release, 'release', 'ci-tag-release.mjs');
    expect(tagStep?.if).toBeUndefined();
    expect(tagStep?.run).toContain('--github-output');
    expect(tagStep?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
    expect(tagStep?.env?.GH_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
    expect(tagStep?.env?.RELEASE_TOKEN).toBe('${{ secrets.RELEASE_TOKEN }}');
    expect(tagStep?.env?.RELEASE_SHA).toContain('github.event.workflow_run.head_sha');
  });

  it('startet den Verify-Workflow auch von Hand', () => {
    expect(workflow('ci-verify.yml').on?.workflow_dispatch).not.toBeUndefined();
  });

  it('delegiert die langen Nachweise an einen eigenen Workflow', () => {
    const long = workflow('long-checks.yml');
    expect(long.on?.workflow_dispatch?.inputs?.verify?.type).toBe('boolean');
    expect(long.on?.workflow_dispatch?.inputs?.soak_ticks?.default).toBe('100000');
    expect(long.on?.workflow_dispatch?.inputs?.balance_days?.default).toBe('40');
    expect(long.permissions?.contents).toBe('read');
    expect(stepWith(long, 'verify', 'npm run verify:all')?.env?.RBD_VERIFY_AUDIT).toBe('1');

    const statistics = stepWith(long, 'statistics', 'round-rtp-high.test.ts');
    expect(statistics?.run).toContain('poker-distribution.test.ts');
    expect(statistics?.run).toContain('slot-session-rtp.test.ts');
    expect(stepWith(long, 'soak', 'soak.test.ts')?.env?.RBD_SOAK_TICKS).toBe('${{ inputs.soak_ticks }}');
    expect(stepWith(long, 'balance', 'balance-run.mjs')?.run).toContain('--days=${{ inputs.balance_days }}');
    expect(stepWith(long, 'bench', 'pnpm run test:perf')?.run).toBe('pnpm run test:perf');
  });

  it('loescht Wegwerf-Branches nach einem Merge mit gruenen Gates', () => {
    const cleanup = workflow('pr-cleanup.yml');
    expect(cleanup.on?.pull_request?.types).toEqual(['closed']);
    expect(cleanup.permissions?.contents).toBe('write');

    const condition = cleanup.jobs?.['delete-branch']?.if ?? '';
    expect(condition).toContain('github.event.pull_request.merged == true');
    expect(condition).toContain("head.ref != 'main'");
    expect(condition).toContain('head.repo.full_name == github.repository');
    expect(condition).toContain('keep-branch');

    const step = steps(cleanup, 'delete-branch')[0];
    expect(step?.env?.BRANCH).toContain('head.ref');
    expect(step?.run).toContain('gh api -X DELETE');
  });

  it('startet den APK-Build aus dem Release und wartet auf das Artefakt', () => {
    const release = workflow('auto-version-release.yml');
    const apkJob = release.jobs?.apk;
    const needs = Array.isArray(apkJob?.needs) ? apkJob.needs : [apkJob?.needs];
    expect(needs).toContain('release');
    expect(apkJob?.uses).toBe('./.github/workflows/build-apk.yml');
    expect(apkJob?.permissions?.contents).toBe('write');
    expect(apkJob?.with?.tag).toBe('${{ needs.release.outputs.tag }}');
    expect(apkJob?.with?.skip_verify).toBe(true);

    const apk = workflow('build-apk.yml');
    expect(apk.on?.workflow_call).not.toBeUndefined();
    expect(apk.on?.workflow_call?.inputs?.skip_verify?.type).toBe('boolean');
    expect(apk.on?.workflow_dispatch).not.toBeUndefined();
    expect(apk.on?.push?.tags).toEqual(['v*.*.*']);
    expect(apk.permissions?.contents).toBe('write');
    expect(apk.jobs?.apk?.['timeout-minutes']).toBe(40);
    expect(stepIndex(apk, 'apk', "grep -qx 'rigged-by-design-debug.apk'")).toBeGreaterThan(-1);
    const apkGate = stepWith(apk, 'apk', 'npm run verify:release');
    expect(apkGate?.if).toContain('inputs.skip_verify');
    const apkBuild = stepWith(apk, 'apk', 'npm run build');
    expect(apkBuild?.if).toContain('inputs.skip_verify');
  });
});
