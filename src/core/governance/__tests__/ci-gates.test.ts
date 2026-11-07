/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Ebene A des Main-Gates: der Zustand entscheidet, welche Gates laufen, und der
 * Pflichtstatus darf nur gruen sein, wenn das Required-Set wirklich gelaufen
 * ist. Die Workflows werden als YAML-Baum geprueft, nicht als Zeichenkette.
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
  readonly with?: Readonly<Record<string, unknown>>;
}

interface Job {
  readonly name?: string;
  readonly needs?: string | readonly string[];
  readonly outputs?: Readonly<Record<string, string>>;
  readonly uses?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly 'timeout-minutes'?: number;
  readonly if?: string;
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

describe('Main-Gate', () => {
  it('prueft granular: ein Status je Gate und ein Aggregat als Pflichtstatus', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    expect(ci.on?.push?.branches).toEqual(['**']);
    expect(ci.permissions?.contents).toBe('read');

    // Der Pflichtstatus bleibt genau einer: er fuehrt nur Ergebnisse zusammen.
    expect(ci.jobs?.verify?.name).toBe('Fail-Closed Gates');
    expect(ci.jobs?.verify?.if).toContain('always()');
    expect(ci.jobs?.verify?.needs).toEqual(['plan', 'gate', 'light', 'long', 'claims', 'commitmsg']);

    // Die Arbeit steckt in der Matrix: ein Job, ein Gate, ein Status.
    const gate = ci.jobs?.gate;
    expect(gate?.name).toContain('matrix.gate');
    expect(gate?.if).toContain("state != 'LIGHT'");
    expect(gate?.strategy?.matrix).toContain('needs.plan.outputs.matrix');
    expect(gate?.strategy?.['fail-fast']).toBe(false);
    expect(stepWith(ci, 'gate', 'run-pipeline.mjs')?.run).toContain('--gate=${{ matrix.gate }}');
    expect(stepWith(ci, 'gate', 'run-pipeline.mjs')?.run).toContain('--profile=${{ needs.plan.outputs.profile }}');

    // Der Light-Zustand hat einen eigenen Job und nie das Required-Set.
    expect(ci.jobs?.light?.name).toBe('Light Gates');
    expect(ci.jobs?.light?.if).toContain("state == 'LIGHT'");
    expect(stepWith(ci, 'light', 'run-pipeline.mjs')?.run).toContain('--profile=light');

    // Ein Push mit offenem PR endet vor den Gates; der PR-Lauf ist die Wahrheit.
    expect(stepWith(ci, 'plan', 'gh pr list --head')?.id).toBe('dedupe');
    const control = steps(ci, 'plan').find((step) => step.name === 'Kontrollebene aus der Basis');
    expect(control?.run).toMatch(/MAIN_REF[\s\S]*refs\/heads\/main/);
    // Kontrollebene == Pruefobjekt ist ein echter No-op, kein harter Abbruch.
    expect(control?.run).toContain('noop=true');
    expect(control?.run).toContain('independent=false');

    const plan = ci.jobs?.plan;
    // Die Basis-Kontrollebene liefert die Metadaten erst nach dem Merge;
    // `compat` fuellt sie aus der Matrix, ohne die Gate-Auswahl zu ersetzen.
    expect(plan?.outputs?.state).toBe('${{ steps.compat.outputs.state }}');
    expect(plan?.outputs?.required).toBe('${{ steps.compat.outputs.required }}');
    expect(plan?.outputs?.run).toBe('${{ steps.compat.outputs.run }}');
    expect(plan?.outputs?.noop).toBe('${{ steps.compat.outputs.noop }}');
    expect(plan?.outputs?.independent).toBe('${{ steps.control.outputs.independent }}');

    // Der Plan liest den echten Diff: Basis und Kopf aus dem Event.
    expect(stepWith(ci, 'plan', 'github.event.pull_request.base.sha')?.id).toBe('range');
    const gates = stepWith(ci, 'plan', 'ci-plan.mjs');
    expect(gates?.id).toBe('gates');
    expect(gates?.run).toContain('--event=');
    expect(gates?.run).toContain('--noop=');
    expect(gates?.run).toContain('--handoff=');
    expect(gates?.env?.RBD_VERIFY_AUDIT).toContain('workflow_dispatch');
    expect(stepWith(ci, 'plan', 'gate-matrix.mjs')).toBeUndefined();

    // Die Matrix wird gegen das Required-Set geprueft, nicht nur auf JSON.
    const validation = stepWith(ci, 'plan', 'process.env.REQUIRED');
    expect(validation?.env?.STATE).toBe('${{ steps.compat.outputs.state }}');
    expect(validation?.env?.REQUIRED).toBe('${{ steps.compat.outputs.required }}');

    // Impact waehlt lange Nachweise auf dem exakten PR-Kopf, nicht auf main.
    expect(ci.jobs?.long?.strategy?.matrix).toContain('needs.plan.outputs.long_matrix');
    expect(ci.jobs?.long?.if).toContain("long_count != '0'");
    const longStep = stepWith(ci, 'long', 'run-selected-tests.mjs');
    expect(longStep?.env?.RBD_TEST_FILES).toBe('${{ matrix.file }}');
    expect(longStep?.env?.RBD_NARRATIVE_LONGRUN).toBe('1');
    expect(steps(ci, 'long')[0]?.with?.ref).toContain('github.event.pull_request.head.sha');

    // Claim-Sperre nur mit echtem PR-Diff; Commit-Notes nur auf main.
    expect(stepWith(ci, 'claims', 'verify-lane-claims.mjs --ci')).not.toBeUndefined();
    expect(ci.jobs?.claims?.if).toContain("state == 'PR'");
    expect(ci.jobs?.commitmsg?.if).toContain("state == 'MAIN'");
  });

  it('fuehrt die Zustands-Aggregate getrennt zusammen', () => {
    const run = stepWith(workflow('ci-verify.yml'), 'verify', 'Required-Set muss laufen')?.run ?? '';
    expect(run).toContain('PR|MAIN|MANUAL|UNKNOWN');
    expect(run).toMatch(/GATES.*=.*"success"/);
    expect(run).toContain('NOOP');
    expect(run).toContain('"$NOOP" = "true"');
    expect(run).toContain('"$LIGHT" = "success"');
    expect(run).toContain('"$INDEPENDENT" != "true"');
    expect(run).toContain('exit "$fail"');
  });

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

  it('loescht keine Wegwerf-Branches mehr, sondern meldet sie', () => {
    const cleanup = workflow('pr-cleanup.yml');
    expect(cleanup.on?.pull_request?.types).toEqual(['closed']);
    expect(cleanup.permissions?.contents).toBe('read');
    expect(cleanup.jobs?.['delete-branch']).toBeUndefined();

    const job = cleanup.jobs?.['report-branch'];
    expect(job?.name).toBe('Head-Branch melden');
    expect(job?.if).toContain('github.event.pull_request.merged == true');
    expect(job?.if).toContain('keep-branch');
    const step = steps(cleanup, 'report-branch')[0];
    expect(step?.run).toContain('git push origin --delete');
    expect(step?.run).toContain('nicht** geloescht');
    for (const entry of steps(cleanup, 'report-branch')) {
      expect(entry.run ?? '').not.toContain('gh api -X DELETE');
    }
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
});
