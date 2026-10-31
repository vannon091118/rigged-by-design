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
}

interface WorkflowJob {
  readonly name?: string;
  readonly needs?: string | readonly string[];
  readonly uses?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly 'timeout-minutes'?: number;
  readonly if?: string;
  readonly steps?: readonly WorkflowStep[];
  readonly with?: Readonly<Record<string, unknown>>;
}

interface WorkflowTrigger {
  readonly pull_request?: {
    readonly branches?: readonly string[];
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
  readonly workflow_dispatch?: unknown;
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
  it('prueft Pushes auf main und Pull Requests gegen main', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    expect(ci.on?.pull_request?.['branches-ignore']).toBeUndefined();
    expect(ci.on?.push?.branches).toEqual(['**']);
    expect(ci.permissions?.contents).toBe('read');
    expect(ci.jobs?.verify?.name).toBe('Fail-Closed Gates');
    expect(stepWith(ci, 'verify', 'npm run verify:all')?.env?.RBD_VERIFY_AUDIT).toBe('1');
    expect(stepWith(ci, 'verify', 'npm run verify:release')).toBeUndefined();
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
