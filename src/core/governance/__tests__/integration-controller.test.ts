/**
 * @test-target: scripts/lib/integration.mjs
 * @error-code: ERR-4019
 *
 * Der Integrationscontroller muss die Ursache eines Konflikts erkennen, nicht
 * nur seine Existenz. Diese Datei belegt die drei Grenzen:
 * - Ein generiertes Artefakt wird regeneriert, eine Handdatei nie.
 * - Ein alter Versionsmarker wird kanonisch; die Roadmap-Zahl folgt der Registry.
 * - Ein PR bekommt Gates nach Risiko; Governance und unbekannt bleiben voll.
 */
import { describe, expect, it } from 'vitest';
import { applyMarker, markerOf } from '../../../../scripts/lib/doc-sync.mjs';
import {
  applyRoadmapProgress,
  classifyConflicts,
  generatedOnlyDiff,
  isGeneratedPath,
  roadmapProgress,
} from '../../../../scripts/lib/generated-files.mjs';
import { assessIntegration, INTEGRATION } from '../../../../scripts/lib/integration.mjs';
import { buildPlan, riskFor, selectTests } from '../../../../scripts/lib/ci-plan.mjs';
import { filterMergedCollisions } from '../../../../scripts/lib/claim-evidence.mjs';
import { REQUIRED_CI_GATES } from '../../../../scripts/lib/pipeline-plan.mjs';

const pr = (changed: string[]) => ({ event: 'pull_request', changed });

describe('Generierte Artefakte', () => {
  it('kennt genau die Dateien, die einen Generator besitzen', () => {
    expect(isGeneratedPath('docs/INVENTORY.md')).toBe(true);
    expect(isGeneratedPath('content/narrative/registry/fragments.json')).toBe(true);
    expect(isGeneratedPath('src/core/sim/narrative/composer/registry.generated.ts')).toBe(true);
    expect(isGeneratedPath('src/core/sim/tick.ts')).toBe(false);
    expect(isGeneratedPath('content/narrative/contributions/handwerk.json')).toBe(false);
  });

  it('normalisiert alte Versionsmarker auf genau einen kanonischen Marker', () => {
    const old = '# Titel\n\n<!-- rbd-doc: v0.3.199 | 2026-11-10 00:44 UTC -->\n\nText\n';
    const normalized = applyMarker(old);
    expect(normalized).toBe('# Titel\n\n<!-- rbd-doc: managed -->\n\nText\n');
    expect(markerOf(normalized)).toEqual({ managed: true });
    expect(applyMarker(normalized)).toBe(normalized);
    expect(markerOf(applyMarker('# Titel\n\nText\n'))).toEqual({ managed: true });
  });

  it('leitet die Roadmap-Zahl aus der Registry ab und ist idempotent', () => {
    const text = '| P-13 | 836/1500 Textbausteine | offen (Ziel) | 13 Pools |';
    expect(roadmapProgress(text)).toBe(836);
    const next = applyRoadmapProgress(text, 838);
    expect(next).toBe('| P-13 | 838/1500 Textbausteine | offen (Ziel) | 13 Pools |');
    expect(applyRoadmapProgress(next, 838)).toBe(next);
  });

  it('erlaubt in Meta-Dateien nur den generierten Anteil', () => {
    expect(generatedOnlyDiff('docs/ROADMAP.md', ['-| P-13 | 836/1500 Textbausteine | x', '+| P-13 | 838/1500 Textbausteine | x'])).toBe(true);
    expect(generatedOnlyDiff('docs/ROADMAP.md', ['-| P-14 | alt | offen', '+| P-14 | neu | offen'])).toBe(false);
    expect(generatedOnlyDiff('docs/INVENTORY.md', ['-entfernt', '+hinzugefuegt'])).toBe(true);
    expect(generatedOnlyDiff('package.json', ['-"version": "0.3.1",', '+"version": "0.3.2",'])).toBe(false);
    expect(generatedOnlyDiff('docs/ROADMAP.md', null)).toBe(false);
  });

  it('trennt generierte von fachlichen Konflikten', () => {
    const generated = classifyConflicts(['docs/INVENTORY.md', 'docs/ROADMAP.md']);
    expect(generated.status).toBe('REGENERATE');
    const mixed = classifyConflicts(['docs/INVENTORY.md', 'src/core/sim/tick.ts']);
    expect(mixed.status).toBe('MANUAL_CONFLICT');
    expect(mixed.source).toEqual(['src/core/sim/tick.ts']);
    expect(classifyConflicts([]).status).toBe('READY');
  });
});

describe('Integrationszustand', () => {
  it('ist READY, wenn die Basis enthalten ist und nichts kollidiert', () => {
    const verdict = assessIntegration({ behind: 0 });
    expect(verdict.status).toBe(INTEGRATION.READY);
  });

  it('verlangt einen Rebase, wenn der Branch hinter der Basis liegt', () => {
    const verdict = assessIntegration({ behind: 3 });
    expect(verdict.status).toBe(INTEGRATION.REBASE_REQUIRED);
    expect(verdict.reason).toContain('hinter');
  });

  it('regeneriert nur generierte Konflikte und blockiert Quellkonflikte', () => {
    const generated = assessIntegration({ conflicts: ['docs/INVENTORY.md'] });
    expect(generated.status).toBe(INTEGRATION.REBASE_REQUIRED);
    expect(generated.generated).toEqual(['docs/INVENTORY.md']);

    const source = assessIntegration({ conflicts: ['src/core/sim/tick.ts'] });
    expect(source.status).toBe(INTEGRATION.MANUAL_CONFLICT);
    expect(source.source).toEqual(['src/core/sim/tick.ts']);
  });

  it('faellt fail-closed aus, wenn die Konfliktpruefung nicht moeglich ist', () => {
    expect(assessIntegration({ known: false }).status).toBe(INTEGRATION.MANUAL_CONFLICT);
  });
});

describe('CI-Gates nach Risiko', () => {
  it('faehrt fuer reine Doku nur Doku, LOC und Struktur', () => {
    const plan = buildPlan(['docs/CI.md', 'docs/ROADMAP.md'], pr(['docs/CI.md', 'docs/ROADMAP.md']));
    expect(plan.state).toBe('PR');
    expect(plan.risk).toBe('docs');
    expect(plan.gateKeys).toEqual(['check:loc', 'docs', 'tree']);
    expect(plan.gateKeys).not.toContain('tests');
    expect(plan.tests.runAll).toBe(false);
  });

  it('faehrt fuer Narrative Registry, Content-Validierung und betroffene Tests', () => {
    const changed = ['content/narrative/contributions/2026-11-10-x.json'];
    const plan = buildPlan(changed, pr(changed));
    expect(plan.risk).toBe('narrative');
    expect(plan.gateKeys).toEqual(expect.arrayContaining(['narrative', 'tests']));
    expect(plan.gateKeys).not.toContain('build');
    expect(plan.tests.runAll).toBe(false);
  });

  it('faehrt fuer Runtime alle Required-Gates, aber nur betroffene Tests', () => {
    const plan = buildPlan(['src/core/sim/tick.ts'], pr(['src/core/sim/tick.ts']));
    expect(plan.risk).toBe('runtime');
    expect(plan.required).toEqual([...REQUIRED_CI_GATES]);
    expect(plan.tests.runAll).toBe(false);
  });

  it('faehrt fuer Governance und unbekanntes Risiko den vollen Nachweis', () => {
    const governance = buildPlan(['.githooks/pre-push'], pr(['.githooks/pre-push']));
    expect(governance.risk).toBe('governance');
    expect(governance.required).toEqual([...REQUIRED_CI_GATES]);
    expect(governance.tests.runAll).toBe(true);

    const unknown = buildPlan(['exotik/datei.bin'], pr(['exotik/datei.bin']));
    expect(unknown.risk).toBe('unknown');
    expect(unknown.gateKeys).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES, 'audit']));
    expect(unknown.tests.runAll).toBe(true);
  });

  it('laesst MAIN beim vollen Nachweis und Light ohne Tests', () => {
    const main = buildPlan(['docs/CI.md'], { event: 'push', ref: 'refs/heads/main' });
    expect(main.required).toEqual([...REQUIRED_CI_GATES]);
    expect(main.tests.runAll).toBe(true);

    const light = buildPlan(['src/core/sim/tick.ts'], { event: 'push', ref: 'refs/heads/lane/x/y' });
    expect(light.tests.runAll).toBe(false);
  });

  it('haelt genau einen Marker uebrig und zitierte unangetastet', () => {
    const dup = '# T\n\n<!-- rbd-doc: managed -->\n\nText\n\n<!-- rbd-doc: managed -->\n';
    expect(applyMarker(dup).match(/rbd-doc/g)).toHaveLength(1);
    const alt = '# T\n\n<!-- rbd-doc: v0.3.199 | 2026-11-10 00:44 UTC -->\n\nText\n\n<!-- rbd-doc: managed -->\n';
    expect(markerOf(applyMarker(alt))).toEqual({ managed: true });
    const zitat = '# T\n\n<!-- rbd-doc: managed -->\n\nText `<!-- rbd-doc: v0.3.144 | 2026-11-06 21:42 UTC -->` bleibt.\n';
    expect(applyMarker(zitat)).toBe(zitat);
  });

  it('ordnet Risiko fail-closed zu', () => {
    expect(riskFor({ empty: true })).toBe('none');
    expect(riskFor({ ci: true, docs: true })).toBe('governance');
    expect(riskFor({ runtime: true, content: true })).toBe('runtime');
    expect(riskFor({ content: true, tests: true })).toBe('narrative');
    expect(riskFor({ tests: true })).toBe('tests');
    expect(riskFor({ docsOnly: true })).toBe('docs');
    expect(riskFor({})).toBe('unknown');
    expect(selectTests(['docs/CI.md'], pr(['docs/CI.md'])).runAll).toBe(false);
  });
});

describe('Zusammengefuehrte Lanes', () => {
  const tip = (c: string) => c.repeat(40);
  const hit = { lane: 'lane/governance/y', reason: 'Pfad-Überschneidung in Allowlist', contractConflict: [] as string[] };
  const lanes = [{ id: 'lane/ci/x', branch: 'lane/ci/x' }, { id: 'lane/governance/y', branch: 'lane/governance/y' }];
  const gitMit = (log: string) => (args: readonly string[]) => {
    if (args[0] === 'rev-parse') return args[1] === 'origin/main' ? tip('a') : args[1] === '--verify' ? tip('b') : 'tree1';
    if (args[0] === 'log') return log;
    throw new Error('unerwarteter Git-Aufruf');
  };
  const ohneGh = () => { throw new Error('kein gh'); };
  it('filtert belegte Merges und haelt laufende Lanes zurueck', () => {
    const gemeldet: string[] = [];
    const meldung = { onMerged: (treffer: { lane: string }) => gemeldet.push(treffer.lane) };
    expect(filterMergedCollisions({ collisions: [hit], claims: lanes, git: gitMit(`${tip('c')} tree1\n${tip('a')} treeX`), gh: ohneGh, ...meldung })).toEqual([]);
    expect(gemeldet).toEqual(['lane/governance/y']);
    expect(filterMergedCollisions({ collisions: [hit], claims: lanes, git: gitMit(`${tip('a')} treeX`), gh: ohneGh, ...meldung })).toEqual([hit]);
    expect(gemeldet).toHaveLength(1);
  });
});
