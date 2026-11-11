/**
 * @test-target: .github/workflows/promote.yml
 * @error-code: ERR-4019
 *
 * Local-first: Es gibt keinen automatischen Merge aus einem CI-Lauf. Der
 * Merge ist ein bewusster Schritt nach dem lokalen Integrationsnachweis; der
 * Watcher reagiert weiterhin nur auf `workflow_run`, und der PR-Body wird im
 * optionalen PR-Job geprueft.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly if?: string;
  readonly env?: Readonly<Record<string, string>>;
}

interface Job {
  readonly if?: string;
  readonly 'timeout-minutes'?: number;
  readonly steps?: readonly Step[];
}

interface Workflow {
  readonly on?: {
    readonly pull_request?: unknown;
    readonly push?: unknown;
    readonly workflow_run?: { readonly workflows?: readonly string[]; readonly types?: readonly string[] };
    readonly workflow_dispatch?: unknown;
  };
  readonly permissions?: Readonly<Record<string, string>>;
  readonly concurrency?: { readonly group?: string; readonly 'cancel-in-progress'?: boolean };
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflow = (name: string): Workflow =>
  parse(readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8')) as Workflow;
const workflowFile = (name: string): string =>
  readFileSync(resolve(process.cwd(), '.github', 'workflows', name), 'utf8');
const steps = (flow: Workflow, job: string): readonly Step[] => flow.jobs?.[job]?.steps ?? [];
const stepWith = (flow: Workflow, job: string, needle: string): Step | undefined =>
  steps(flow, job).find((step) => step.run?.includes(needle));

describe('Promotion-Workflows', () => {
  it('macht promote zu einem manuellen Status-/Notausgang ohne Plan-Artefakt', () => {
    const promote = workflow('promote.yml');
    const job = promote.jobs?.promote;
    expect(promote.on?.workflow_run).toBeUndefined();
    expect(promote.on?.workflow_dispatch).not.toBeUndefined();
    expect(job?.if).toContain("github.event_name == 'workflow_dispatch'");
    expect(promote.permissions?.issues).toBe('read');
    expect(promote.concurrency?.group).toBe('promote');
    expect(promote.concurrency?.['cancel-in-progress']).toBe(false);

    expect(stepWith(promote, 'promote', 'gh run download')).toBeUndefined();
    const run = stepWith(promote, 'promote', 'node scripts/promote.mjs');
    expect(run?.env?.MODE).toContain('inputs.mode');
    expect(run?.env?.INTEGRATE).toContain("inputs.mode == 'integrate'");
  });

  it('haelt den Watcher frei von pull_request-Triggern und PR-Body-Pruefung', () => {
    const watcher = workflow('pr-watcher.yml');
    expect(watcher.on?.pull_request).toBeUndefined();
    expect(watcher.on?.push).toBeUndefined();
    expect(watcher.on?.workflow_run?.workflows).toEqual(['CI Verify']);
    expect(workflowFile('pr-watcher.yml')).not.toContain('--pr-check');
  });

  it('prueft den PR-Body im optionalen PR-Job, nicht erst im Watcher', () => {
    const verify = workflow('ci-verify.yml');
    const body = steps(verify, 'verify').find((step) => step.name === 'PR-Body');
    expect(body?.if).toContain("github.event_name == 'pull_request'");
    expect(body?.run).toContain('gh pr view');
    expect(body?.run).toContain('PR_BODY="$body" node scripts/verify-pr-body.mjs');
    expect(body?.env?.PR_BODY).toBeUndefined();
  });

  it('verbietet Auto-Merge und erlaubt keinen Merge auf veralteter Basis', () => {
    const source = readFileSync(resolve(process.cwd(), 'scripts', 'promote.mjs'), 'utf8');
    expect(source).not.toContain('RBD_PROMOTE_AUTO_MERGE');
    expect(source).not.toContain("'--auto'");
    expect(source).toContain('update-branch');
    expect(source).toContain('holdMerge');
  });
});
