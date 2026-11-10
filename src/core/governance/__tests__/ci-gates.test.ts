/**
 * @test-target: .github/workflows/ci-verify.yml
 * @error-code: ERR-4008
 *
 * Ebene A des Main-Gates: der Zustand entscheidet, welche Gates laufen, und der
 * Pflichtstatus darf nur gruen sein, wenn das Required-Set wirklich gelaufen
 * ist und jeder Job das Ergebnis hat, das sein Zustand vorsieht. Der Workflow
 * wird als YAML-Baum geprueft, nicht als Zeichenkette.
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
  readonly needs?: string | readonly string[];
  readonly outputs?: Readonly<Record<string, string>>;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly if?: string;
  readonly strategy?: { readonly matrix?: string; readonly 'fail-fast'?: boolean };
  readonly steps?: readonly Step[];
}

interface Workflow {
  readonly on?: {
    readonly pull_request?: { readonly branches?: readonly string[] };
    readonly push?: { readonly branches?: readonly string[] };
    readonly workflow_dispatch?: unknown;
  };
  readonly permissions?: Readonly<Record<string, string>>;
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (name: string): Workflow =>
  parse(readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')) as Workflow;
const steps = (flow: Workflow, job: string): readonly Step[] => flow.jobs?.[job]?.steps ?? [];
const stepWith = (flow: Workflow, job: string, needle: string): Step | undefined =>
  steps(flow, job).find((step) => step.run?.includes(needle));

describe('Main-Gate', () => {
  it('prueft granular: ein Status je Gate und ein Aggregat als Pflichtstatus', () => {
    const ci = workflow('ci-verify.yml');
    expect(ci.on?.pull_request?.branches).toEqual(['main']);
    // Nur ein Push auf main behaelt den Vollauf; Lanes laufen ueber ensure-pr.
    expect(ci.on?.push?.branches).toEqual(['main']);
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

    // Ein Lane-Push startet keinen zweiten Vollauf; der PR-Lauf ist die Wahrheit.
    expect(stepWith(ci, 'plan', 'gh pr list --head')).toBeUndefined();
    const control = steps(ci, 'plan').find((step) => step.name === 'Kontrollebene aus der Basis');
    expect(control?.env?.BASE_SHA).toContain('github.event.pull_request.base.sha');
    expect(control?.run).not.toContain('github.event.before');
    expect(control?.run).toContain("'HEAD^'");
    // Kontrollebene == Pruefobjekt ist ein echter No-op, kein harter Abbruch.
    expect(control?.run).toContain('noop=true');
    expect(control?.run).toContain('independent=false');

    // Der Freeze-Checker kommt aus der Basis, das Pruefobjekt bleibt der Kandidat.
    const freeze = steps(ci, 'plan').find((step) => step.name === 'Governance-Freeze');
    expect(freeze?.env?.CONTROL_SCRIPTS).toContain('steps.control.outputs.scripts');
    expect(freeze?.env?.RBD_ROOT).toContain('steps.control.outputs.root');
    expect(freeze?.env?.GH_TOKEN).toBeUndefined();
    expect(freeze?.run).toContain('$CONTROL_SCRIPTS/verify-governance-freeze.mjs');
    expect(freeze?.run).not.toContain('gh api -X DELETE');

    // Ein Verstoss wird ein BLOCKED-Issue; der Branch bleibt bestehen.
    const issue = ci.jobs?.['governance-issue'];
    expect(issue?.if).toContain("needs.plan.outputs.freeze == 'corruption'");
    expect(issue?.permissions?.issues).toBe('write');
    expect(issue?.permissions?.contents).toBe('read');
    expect(ci.jobs?.plan?.permissions?.contents).toBe('read');

    const plan = ci.jobs?.plan;
    // Die Basis-Kontrollebene liefert die Metadaten erst nach dem Merge;
    // `compat` fuellt sie aus der Matrix, ohne die Gate-Auswahl zu ersetzen.
    expect(plan?.outputs?.state).toBe('${{ steps.compat.outputs.state }}');
    expect(plan?.outputs?.required).toBe('${{ steps.compat.outputs.required }}');
    expect(plan?.outputs?.run).toBe('${{ steps.compat.outputs.run }}');
    expect(plan?.outputs?.noop).toBe('${{ steps.compat.outputs.noop }}');
    expect(plan?.outputs?.independent).toBe('${{ steps.control.outputs.independent }}');

    // Der Plan liest den echten Diff: Basis und Kopf aus der Kontrollebene.
    const range = steps(ci, 'plan').find((step) => step.id === 'range');
    expect(range?.env?.CONTROL_BASE).toContain('steps.control.outputs.base');
    expect(range?.env?.CONTROL_HEAD).toContain('steps.control.outputs.head');

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
    expect(validation?.run).toContain('required.length === 0');

    // Impact waehlt lange Nachweise auf dem exakten PR-Kopf, nicht auf main.
    expect(ci.jobs?.long?.strategy?.matrix).toContain('needs.plan.outputs.long_matrix');
    expect(ci.jobs?.long?.if).toContain("long_count != '0'");
    const longStep = stepWith(ci, 'long', 'run-selected-tests.mjs');
    expect(longStep?.env?.RBD_TEST_FILES).toBe('${{ matrix.file }}');
    expect(longStep?.env?.RBD_NARRATIVE_LONGRUN).toBe('1');
    for (const job of ['plan', 'gate', 'light', 'long', 'claims', 'commitmsg']) {
      expect(steps(ci, job)[0]?.with?.ref).toContain('github.event.pull_request.head.sha');
    }

    // Claim-Sperre nur mit echtem PR-Diff; Commit-Notes nur auf main.
    expect(stepWith(ci, 'claims', 'verify-lane-claims.mjs --ci')).not.toBeUndefined();
    expect(ci.jobs?.claims?.if).toContain("state == 'PR'");
    expect(ci.jobs?.commitmsg?.if).toContain("state == 'MAIN'");
  });

  it('fuehrt die Zustands-Aggregate strikt zusammen', () => {
    const run = stepWith(workflow('ci-verify.yml'), 'verify', 'required ist leer')?.run ?? '';
    // Jeder Job muss genau das Ergebnis haben, das sein Zustand vorsieht.
    expect(run).toContain('gleich "gate" "$GATES" success');
    expect(run).toContain('gleich "light" "$LIGHT" skipped');
    expect(run).toContain('gleich "claims" "$CLAIMS" success');
    expect(run).toContain('gleich "commitmsg" "$COMMITMSG" success');
    // Lange Nachweise sind bei Impact-Pflicht success, sonst skipped.
    expect(run).toContain('"$LONG_COUNT" != "0"');
    expect(run).toContain('gleich "long" "$LONG" success');
    expect(run).toContain('"$INDEPENDENT" != "true"');
    expect(run).toContain('exit "$fail"');
  });
});
