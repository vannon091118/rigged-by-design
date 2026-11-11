/**
 * @test-target: scripts/lib/takeover.mjs
 * @error-code: ERR-4030
 *
 * "Fremdes WIP" gibt es nicht: jede Dirty-Datei ist kompatibel,
 * unvollstaendig oder korrupt und wird in allen drei Faellen adoptiert. Nur
 * Korruption (Freeze ohne Freigabe, Ledger/Save/RNG/Boot) blockiert.
 */
import { describe, expect, it } from 'vitest';
import { classifyWip, isCriticalPath, summarizeTakeover } from '../../../../scripts/lib/takeover.mjs';

const own = { id: 'lane/test/own', branch: 'lane/test/own', status: 'open', pathAllowlist: ['docs/', 'src/ui/**'] };
const foreign = { id: 'lane/other/work', branch: 'lane/other/work', status: 'open', pathAllowlist: ['src/core/sim/**'] };

describe('WIP-Takeover', () => {
  it('adoptiert eigene Pfade als kompatibel', () => {
    const entry = classifyWip({ path: 'docs/a.md', allowlist: own.pathAllowlist, branch: own.branch, claims: [own] });
    expect(entry).toMatchObject({ kind: 'compatible', adopt: true });
  });

  it('adoptiert fremde offene Claims als kompatibel', () => {
    const entry = classifyWip({ path: 'src/core/sim/tick.ts', branch: own.branch, claims: [own, foreign] });
    expect(entry).toMatchObject({ kind: 'compatible', adopt: true, source: 'lane/other/work' });
  });

  it('adoptiert ungeclaimte Pfade als unvollstaendig', () => {
    const entry = classifyWip({ path: 'src/ui/hud.tsx', branch: own.branch, claims: [own] });
    expect(entry).toMatchObject({ kind: 'incomplete', adopt: true });
  });

  it('markiert einen Governance-Pfad ohne Freigabe als korrupt', () => {
    const entry = classifyWip({ path: 'scripts/pretask.mjs', branch: own.branch, claims: [own] });
    expect(entry).toMatchObject({ kind: 'corrupted', adopt: true });
  });

  it('akzeptiert einen Governance-Pfad mit Freigabe', () => {
    const entry = classifyWip({ path: 'scripts/pretask.mjs', freezeUnlocked: true });
    expect(entry).toMatchObject({ kind: 'compatible', adopt: true });
  });

  it('markiert Ledger-, Save-, RNG- und Boot-Pfade als korrupt', () => {
    const critical = [
      'src/core/economy/ledger.ts',
      'src/core/contracts/save.ts',
      'src/core/rng/prng.ts',
      'src/core/boot/start.ts',
    ];
    for (const path of critical) {
      expect(isCriticalPath(path)).toBe(true);
      expect(classifyWip({ path })?.kind).toBe('corrupted');
    }
    expect(isCriticalPath('src/ui/save-screen.tsx')).toBe(false);
  });

  it('nimmt Lane-Werkzeug ohne Claim an', () => {
    expect(classifyWip({ path: '.lane-claims/tasks/lane-test.json' })).toMatchObject({
      kind: 'compatible',
      adopt: true,
    });
  });

  it('zaehlt alle drei Faelle und blockt nur Korruption', () => {
    const summary = summarizeTakeover([
      classifyWip({ path: 'docs/a.md', allowlist: ['docs/'] }),
      classifyWip({ path: 'src/ui/hud.tsx' }),
      classifyWip({ path: 'src/core/economy/ledger.ts' }),
      classifyWip({ path: 'scripts/pretask.mjs' }),
    ]);
    expect(summary.total).toBe(4);
    expect(summary.adopted).toBe(4);
    expect(summary.blocked).toBe(2);
    expect(summary.counts).toEqual({ compatible: 1, incomplete: 1, corrupted: 2 });
    expect(summary.corrupted.map((entry) => entry.path)).toContain('src/core/economy/ledger.ts');
  });
});
