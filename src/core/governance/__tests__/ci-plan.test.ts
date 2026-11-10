/**
 * @test-target: scripts/lib/ci-plan.mjs
 * @error-code: ERR-4008
 *
 * Der Zustand ist die eine Wahrheit: aus ihm folgen Required-Set, Gates und
 * Tests. Diese Datei belegt die Grenzen, die aus dem Workflow-Text nicht
 * ablesbar sind: kein Zustand ohne Gate ausser NOOP und PR_HANDOFF, main und
 * manuell fahren die vollstaendige Suite, und ein PR folgt dem Risiko seiner
 * Aenderung - Audit kommt nur aus dem Impact, nie aus einer Kuerzung.
 */
import { describe, expect, it } from 'vitest';
import { buildPlan, selectTests, stateFor } from '../../../../scripts/lib/ci-plan.mjs';
import { LIGHT_GATES, REQUIRED_CI_GATES } from '../../../../scripts/lib/pipeline-plan.mjs';

const pushMain = { event: 'push', ref: 'refs/heads/main' };
const pushFeature = { event: 'push', ref: 'refs/heads/lane/test/x' };
const aPR = (changed: string[] = ['src/core/sim/tick.ts']) => ({ event: 'pull_request', changed });

describe('CI-Zustand', () => {
  it('leitet den Zustand aus dem Ereignis ab und faellt sonst auf UNKNOWN', () => {
    expect(stateFor(pushMain)).toBe('MAIN');
    expect(stateFor(pushFeature)).toBe('LIGHT');
    expect(stateFor({ event: 'pull_request' })).toBe('PR');
    expect(stateFor({ event: 'workflow_dispatch' })).toBe('MANUAL');
    expect(stateFor({ event: 'pull_request', changed: [] })).toBe('NOOP');
    expect(stateFor({ event: 'push', ref: 'refs/heads/main', changed: [] })).toBe('NOOP');
    expect(stateFor({ handoff: true })).toBe('PR_HANDOFF');
    expect(stateFor({ state: 'light' })).toBe('LIGHT');
    expect(stateFor({})).toBe('UNKNOWN');
    expect(stateFor({ state: 'quatsch' })).toBe('UNKNOWN');
  });
});

describe('CI-Testplan', () => {
  it('gibt main und manuell das Required-Set und die vollstaendige Suite', () => {
    for (const options of [pushMain, { event: 'workflow_dispatch' }]) {
      const plan = buildPlan(['src/core/sim/tick.ts'], options);
      expect(plan.run).toBe(true);
      expect(plan.noop).toBe(false);
      expect(plan.required).toEqual([...REQUIRED_CI_GATES]);
      expect(plan.gateKeys).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES]));
      expect(plan.tests.runAll).toBe(true);
      expect(plan.tests.files).toEqual([]);
    }

    // Ein Runtime-PR traegt dasselbe Required-Set, faehrt aber nur die vom
    // Diff betroffenen Tests. Die vollstaendige Suite ist main und manuell.
    const pr = buildPlan(['src/core/sim/tick.ts'], aPR());
    expect(pr.run).toBe(true);
    expect(pr.required).toEqual([...REQUIRED_CI_GATES]);
    expect(pr.gateKeys).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES]));
    expect(pr.tests.runAll).toBe(false);
  }, 15_000);

  it('faehrt im Light-Zustand nur die schnellen Gates ohne Tests', () => {
    const plan = buildPlan(['src/core/sim/tick.ts'], pushFeature);
    expect(plan.state).toBe('LIGHT');
    expect(plan.gateKeys).toEqual([...LIGHT_GATES]);
    expect(plan.tests.runAll).toBe(false);
    expect(plan.tests.long).toEqual([]);
  });

  it('prueft NOOP und PR_HANDOFF nicht und liefert eine leere Matrix', () => {
    const noop = buildPlan([], { event: 'pull_request', changed: [] });
    expect(noop.state).toBe('NOOP');
    expect(noop.run).toBe(false);
    expect(noop.noop).toBe(true);
    expect(noop.gateKeys).toEqual([]);
    expect(noop.tests.runAll).toBe(false);

    const handoff = buildPlan(['src/core/sim/tick.ts'], { ...pushFeature, handoff: true });
    expect(handoff.state).toBe('PR_HANDOFF');
    expect(handoff.run).toBe(false);
    expect(handoff.noop).toBe(false);
    expect(handoff.gateKeys).toEqual([]);
    expect(handoff.tests.runAll).toBe(false);
  });

  it('laesst UNKNOWN nie leer und faehrt das volle Profil', () => {
    const plan = buildPlan(['src/core/sim/tick.ts'], {});
    expect(plan.state).toBe('UNKNOWN');
    expect(plan.run).toBe(true);
    expect(plan.gateKeys).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES, 'audit']));
    expect(plan.tests.runAll).toBe(true);
  });

  it('ergaenzt Audit nur aus dem Impact und kuertzt den PR auf betroffene Tests', () => {
    const deps = buildPlan(['src/Config/vite.config.ts'], { ...aPR(), impact: true });
    expect(deps.gateKeys).toContain('audit');
    expect(deps.required).not.toContain('audit');
    expect(deps.tests.runAll).toBe(true);

    const code = buildPlan(['src/core/sim/tick.ts'], { ...aPR(), impact: true });
    expect(code.gateKeys).not.toContain('audit');
    expect(code.tests.runAll).toBe(false);
    expect(Array.isArray(code.tests.files)).toBe(true);
  });

  it('delegiert den Narrative-Langlauf als langen Nachweis statt als schnellen Test', () => {
    const plan = selectTests(['src/core/sim/tick.ts'], pushMain);
    expect(plan.long).toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
    expect(plan.files).not.toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
    expect(plan.runAll).toBe(true);
  });

  it('gibt keinem Zustand ohne tests-Gate ein runAll', () => {
    expect(selectTests(['src/core/sim/tick.ts'], pushFeature).runAll).toBe(false);
    expect(selectTests([], { event: 'pull_request', changed: [] }).runAll).toBe(false);
    expect(selectTests(['src/core/sim/tick.ts'], { ...pushFeature, handoff: true }).runAll).toBe(false);
  });

  it('traegt das Required-Set in jedem nicht leeren Zustand', () => {
    for (const options of [aPR(), pushMain, { event: 'workflow_dispatch' }, {}]) {
      const plan = buildPlan(['src/core/sim/tick.ts'], options);
      for (const gate of plan.required) expect(plan.gateKeys).toContain(gate);
    }
  });
});
