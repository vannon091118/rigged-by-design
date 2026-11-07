/**
 * @test-target: scripts/lib/ci-plan.mjs
 * @error-code: ERR-4008
 *
 * Der CI-Plan ist die einzige Auswahl fuer Gates und Tests. Diese Datei belegt
 * die zwei Grenzen, die nicht aus dem Workflow-Text ablesbar sind: lange
 * Nachweise kommen in eine eigene Matrix, und auf main wird die Suite bei
 * Runtime-/Testaenderungen vollstaendig, ohne reine Doku aufzublaehen.
 */
import { describe, expect, it } from 'vitest';
import { buildPlan, selectTests } from '../../../../scripts/lib/ci-plan.mjs';

describe('CI-Testplan', () => {
  it('delegiert den Narrative-Langlauf als langen Nachweis statt als schnellen Test', () => {
    const plan = selectTests(['src/core/sim/tick.ts'], { profile: 'full', impact: true });
    expect(plan.long).toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
    expect(plan.files).not.toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
    expect(plan.runAll).toBe(false);
  });

  it('erzwingt auf main die vollstaendige Suite fuer Runtimeaenderungen', () => {
    const plan = selectTests(['src/core/sim/tick.ts'], {
      profile: 'full',
      impact: true,
      fullTests: true,
    });
    expect(plan.runAll).toBe(true);
    expect(plan.files).toEqual([]);
    expect(plan.long).toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
  });

  it('laesst reine Doku auf main leicht und ohne Langlauf', () => {
    const plan = selectTests(['docs/ROADMAP.md'], {
      profile: 'full',
      impact: true,
      fullTests: true,
    });
    expect(plan.runAll).toBe(false);
    expect(plan.files).toEqual([]);
    expect(plan.long).toEqual([]);
  });

  it('plant ohne Impact das volle Profil und behaelt die langen Nachweise', () => {
    const plan = selectTests(['src/core/sim/tick.ts'], { profile: 'full', impact: false });
    expect(plan.runAll).toBe(true);
    expect(plan.files).toEqual([]);
    expect(plan.long).toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
  });

  it('erzwingt im Profil all die vollstaendige Suite auch mit Impact', () => {
    const plan = selectTests(['src/core/sim/tick.ts'], { profile: 'all', impact: true });
    expect(plan.runAll).toBe(true);
    expect(plan.files).toEqual([]);
  });

  it('vollzieht die PR-Regression fuer CI-Aenderungen vollstaendig', () => {
    const plan = selectTests(['.github/workflows/ci-verify.yml'], { profile: 'full', impact: true, fullTests: true });
    expect(plan.runAll).toBe(true);
    expect(plan.files).toEqual([]);
  });

  it('faellt bei leerem oder unbekanntem Diff auf die vollstaendige Suite zurueck', () => {
    expect(selectTests([], { profile: 'all', impact: true }).runAll).toBe(true);
    expect(selectTests(['src/core/unbekannt.ts'], { profile: 'all', impact: true }).runAll).toBe(true);
  });

  it('fuehrt den langen Nachweis im Gesamtplan mit', () => {
    const plan = buildPlan(['src/core/sim/tick.ts'], { profile: 'full', impact: true });
    expect(plan.tests.long).toContain('src/core/sim/__tests__/narrative-longrun.test.ts');
    expect(plan.tests.runAll).toBe(false);
  });
});
