/**
 * @test-target: .github/workflows/ensure-pr.yml
 * @error-code: ERR-4008
 *
 * Workflows sind ausfuehrbarer Code. Seit der Local-first-Migration fuehren
 * sie keine Verifikation mehr aus: keine Shell-Interpolation in `run`-Zeilen,
 * keine bewegliche Action-Referenz, kein Test- oder Build-Kommando.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Step {
  readonly name?: string;
  readonly run?: string;
  readonly uses?: string;
}
interface Job {
  readonly steps?: readonly Step[];
}
interface Workflow {
  readonly jobs?: Readonly<Record<string, Job>>;
}

const workflowDir = resolve(process.cwd(), '.github', 'workflows');
const workflowFiles = (): string[] => readdirSync(workflowDir).filter((file) => file.endsWith('.yml')).sort();
const workflow = (file: string): Workflow => parse(readFileSync(resolve(workflowDir, file), 'utf8')) as Workflow;
const jobs = (flow: Workflow): readonly Job[] => Object.values(flow.jobs ?? {});
const usesOf = (flow: Workflow): string[] =>
  jobs(flow).flatMap((job) => (job.steps ?? []).flatMap((step) => (step.uses ? [step.uses] : [])));
const runsOf = (flow: Workflow): string[] =>
  jobs(flow).flatMap((job) => (job.steps ?? []).flatMap((step) => (step.run ? [step.run] : [])));

describe('workflow hardening (local only)', () => {
  it('pinnt jede Action auf einen vollen Commit-SHA', () => {
    const unpinned: string[] = [];
    for (const file of workflowFiles()) {
      for (const use of usesOf(workflow(file))) {
        if (use.startsWith('./')) continue;
        if (!/@[0-9a-f]{40}$/.test(use)) unpinned.push(`${file}: ${use}`);
      }
    }
    expect(unpinned).toEqual([]);
  });

  it('enthaelt keine Eingabe-Interpolation in Shell-Zeilen', () => {
    for (const file of workflowFiles()) {
      const runs = runsOf(workflow(file));
      expect(runs.filter((run) => run.includes('${{'))).toEqual([]);
    }
  });

  it('fuehrt in keinem Workflow Tests, Gates oder Builds aus', () => {
    for (const file of workflowFiles()) {
      const commands = runsOf(workflow(file)).join('\n');
      expect(commands, file).not.toMatch(/verify:|test:ci|run-pipeline|version-bump|android:apk|pnpm run/);
    }
  });

  it('verweist fuer die Testlinie auf den lokalen Runner', () => {
    const agents = readFileSync(resolve(process.cwd(), 'AGENTS.md'), 'utf8');
    expect(agents).toContain('pnpm run agent:pretask --json');
    expect(agents).toContain('docs/TESTING.md');
    expect(agents.match(/^\d+\. \*\*/gm)?.length ?? 0).toBe(10);
    expect(agents).toContain('pnpm run ci:local');

    const testing = readFileSync(resolve(process.cwd(), 'docs', 'TESTING.md'), 'utf8');
    expect(testing.match(/### Die eine Testlinie/g)?.length ?? 0).toBe(1);
    expect(testing).toContain('pnpm run test:mechanics');
  });
});
