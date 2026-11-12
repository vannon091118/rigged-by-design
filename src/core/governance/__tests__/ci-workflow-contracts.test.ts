/**
 * @test-target: .github/workflows/ensure-pr.yml
 * @error-code: ERR-4008
 *
 * Die verbliebenen Workflows sind Repository-Verwaltung: Lane-PR anlegen,
 * gemergte Wegwerf-Branches loeschen, Promotion manuell anstossen. Sie fuehren
 * keine Tests, Gates oder Builds aus; das ist der lokale Runner.
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
  readonly name?: string;
  readonly if?: string;
  readonly permissions?: Readonly<Record<string, string>>;
  readonly steps?: readonly Step[];
}
interface Workflow {
  readonly on?: {
    readonly pull_request?: { readonly types?: readonly string[] };
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

describe('Repository-Workflow-Vertraege', () => {
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
    const step = steps(cleanup, 'delete-branch')[0];
    expect(step?.run).toContain('gh api -X DELETE');
    expect(step?.run).toContain('repos/${GITHUB_REPOSITORY}/git/refs/heads/${BRANCH}');

    const closeout = cleanup.jobs?.['post-merge-closeout'];
    expect(closeout?.if).toContain('github.event.pull_request.merged == true');
    expect(stepWith(cleanup, 'post-merge-closeout', 'post-merge-closeout.mjs')?.run).toContain('node scripts/post-merge-closeout.mjs');
  });

  it('laesst Lane-Pushes nur den PR anlegen oder aktualisieren', () => {
    const ensure = workflow('ensure-pr.yml');
    expect(ensure.on?.push?.branches).toEqual(['lane/**']);
    expect(ensure.permissions).toEqual({ contents: 'read', 'pull-requests': 'write' });
    const step = steps(ensure, 'ensure-pr').find((entry) => entry.run?.includes("'pr', 'create'"));
    expect(step?.env?.GH_TOKEN).toContain('steps.app.outputs.token');
  });

  it('haelt promote manuell und ohne Auto-Merge', () => {
    const promote = workflow('promote.yml');
    expect(promote.on?.workflow_dispatch).not.toBeUndefined();
    expect(promote.on?.pull_request).toBeUndefined();
    const source = readFileSync(resolve(process.cwd(), 'scripts', 'promote.mjs'), 'utf8');
    expect(source).not.toContain('RBD_PROMOTE_AUTO_MERGE');
    expect(source).not.toContain("'--auto'");
    expect(source).toContain('update-branch');
    expect(source).toContain('holdMerge');
  });
});
