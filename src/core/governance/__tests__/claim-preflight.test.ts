/**
 * @test-target: scripts/lib/claim-preflight.mjs
 * @error-code: ERR-4019
 *
 * Der Pre-Push-Audit muss offene Claims und Rest-WIP auch nach einem
 * Kontextverlust erklaeren: eigener WIP, paralleler Task, fehlendes Issue.
 * Nur aufloesbare Befunde blockieren; parallele Lanes bleiben eine Warnung.
 */
import { describe, expect, it } from 'vitest';
import {
  formatClaimPreflight,
  inspectClaimPreflight,
  parseStatusLines,
} from '../../../../scripts/lib/claim-preflight.mjs';

type Claim = {
  id: string;
  branch: string;
  owner: string;
  issue: number | null;
  status: string;
  task: string;
  baseSha: string;
  gateProfile: string;
  pathAllowlist: string[];
};

const claim = (patch: Partial<Claim> = {}): Claim => ({
  id: 'lane/feature/demo',
  branch: 'lane/feature/demo',
  owner: 'Integrator',
  issue: 635,
  status: 'open',
  task: 'Feature bauen',
  baseSha: 'a'.repeat(40),
  gateProfile: 'light',
  pathAllowlist: ['src/core/**'],
  ...patch,
});

const task = (phase = 'CI_PENDING') => ({
  file: '.lane-claims/tasks/feature-demo.json',
  contract: {
    claimId: 'lane/feature/demo',
    phase,
    findings: [] as { status: string; severity: string }[],
  },
});

describe('claim-preflight', () => {
  it('zerlegt Statuszeilen und ignoriert die Turn-Arbeitsdatei', () => {
    expect(
      parseStatusLines([
        ' M src/core/a.ts',
        '?? docs/neu.md',
        'R  docs/alt.md -> docs/neu.md',
        ' M .turn-notes.md',
      ]),
    ).toEqual([
      { code: ' M', path: 'src/core/a.ts', untracked: false },
      { code: '??', path: 'docs/neu.md', untracked: true },
      { code: 'R ', path: 'docs/neu.md', untracked: false },
    ]);
  });

  it('laesst einen sauberen eigenen Claim mit Task-Vertrag passieren', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim()],
      tasks: [task()],
    });
    expect(result.blockers).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.parallel).toEqual([]);
    expect(result.wip).toEqual([]);
    expect(formatClaimPreflight(result)).toContain('CI_PENDING');
    expect(formatClaimPreflight(result)).toContain('push-bereit');
  });

  it('blockiert Rest-WIP und nennt die Pruef-Frage', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim()],
      tasks: [task()],
      status: [' M src/core/a.ts', '?? docs/neu.md'],
    });
    expect(result.wip).toHaveLength(2);
    expect(result.blockers.join('\n')).toContain('2 Restdatei');
    const message = formatClaimPreflight(result);
    expect(message).toContain('Rest-WIP: 2 Datei(en), davon 1 untracked');
    expect(message).toContain('Pruefe: Ist der Rest-WIP deine Arbeit oder ein paralleler Task?');
    expect(message).toContain('Offene Arbeit ohne Issue: Issue anlegen und verlinken.');
  });

  it('meldet parallele offene Claims, blockiert sie aber nicht', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [
        claim(),
        claim({ id: 'lane/other/demo', branch: 'lane/other/demo', issue: 700 }),
      ],
      tasks: [task()],
    });
    expect(result.parallel).toHaveLength(1);
    expect(result.blockers).toEqual([]);
    expect(formatClaimPreflight(result)).toContain('Parallel offen');
  });

  it('blockiert einen Claim ohne Issue-Nummer', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim({ issue: null })],
      tasks: [task()],
    });
    expect(result.blockers.join('\n')).toContain('ohne Issue-Nummer');
  });

  it('blockiert einen offenen Claim bei DONE-Vertrag', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim()],
      tasks: [task('DONE')],
    });
    expect(result.blockers.join('\n')).toContain('Claim offen, Vertrag DONE');
  });

  it('kappt lange Warnlisten auf eine kurze Vorschau', () => {
    const merged = Array.from({ length: 10 }, (_, index) =>
      claim({
        id: `lane/merged/${index}`,
        branch: `lane/merged/${index}`,
        status: 'merged',
      }),
    );
    const mergedTasks = merged.map((entry) => ({
      file: `.lane-claims/tasks/${entry.id.split('/').pop()}.json`,
      contract: { claimId: entry.id, phase: 'IMPLEMENTING', findings: [] },
    }));
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim(), ...merged],
      tasks: [task(), ...mergedTasks],
    });
    expect(result.warnings).toHaveLength(10);
    const message = formatClaimPreflight(result);
    expect(message).toContain('+8 weitere');
    expect(message.length).toBeLessThan(700);
  });

  it('blockiert unlesbare Task-Vertraege', () => {
    const result = inspectClaimPreflight({
      branch: 'lane/feature/demo',
      claims: [claim()],
      tasks: [task()],
      taskErrors: ['Task-Vertrag nicht lesbar'],
    });
    expect(result.blockers.join('\n')).toContain('nicht lesbar');
  });

  it('ueberspringt main ohne Claim-Pflicht', () => {
    const result = inspectClaimPreflight({
      branch: 'main',
      claims: [claim()],
      status: [' M src/core/a.ts'],
    });
    expect(result.skipped).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(formatClaimPreflight(result)).toContain('Branch-Schutz');
  });
});
