/**
 * @test-target: scripts/lib/pipeline-plan.mjs
 * @error-code: ERR-0911
 *
 * Ein Pruefer darf die Akte nicht vorher umschreiben. Kein Verify-Profil
 * enthaelt deshalb einen schreibenden Schritt; `fix` ist der einzige Pfad,
 * der repariert, und jedes Gate traegt einen rein lesenden Aufruf.
 */
import { describe, expect, it } from 'vitest';
import { GATES, PROFILE_GATES, PROFILES, isFixMode, isProfile, planGates } from '../../../../scripts/lib/pipeline-plan.mjs';

describe('Pipeline-Modi', () => {
  it('plant in jedem Profil ausschliesslich bekannte, lesende Gates', () => {
    for (const profile of PROFILES) {
      const plan = planGates(profile);
      expect(plan, `${profile} hat keinen Plan`).not.toBeNull();
      const gates = plan ?? [];
      expect(gates.length, `${profile} ohne Gates`).toBeGreaterThan(0);
      expect(gates, `${profile} enthaelt den schreibenden Autofix`).not.toContain('autofix');
      for (const key of gates) expect(GATES[key]?.code).toMatch(/^ERR-\d{4}$/);
    }
  });

  it('gibt keinem Gate einen reparierenden Aufruf mit', () => {
    for (const [key, gate] of Object.entries(GATES)) {
      const call = [gate.script, ...(gate.args ?? [])].join(' ');
      expect(call, `${key} repariert statt zu pruefen`).not.toMatch(/--fix|--write|autofix/);
    }
    expect(GATES['deps-matrix']?.args).toEqual(['--check']);
  });

  it('prueft im vollen und im Release-Profil mehr als im kurzen Lauf', () => {
    const quick = PROFILE_GATES.quick ?? [];
    const full = PROFILE_GATES.full ?? [];
    expect(full).toEqual(PROFILE_GATES.release);
    expect(full.length).toBeGreaterThan(quick.length);
    expect(quick).not.toContain('build');
    expect(full).toContain('build');
    expect(full).toContain('audit');
    expect(quick).toContain('deps-matrix');
  });

  it('gibt jedem Gate ein hartes Zeitlimit', () => {
    for (const [key, gate] of Object.entries(GATES)) {
      expect(gate.timeoutMs, `${key} hat kein Timeout`).toBeGreaterThan(0);
    }
  });

  it('erkennt den Fix-Modus nur am expliziten Schalter', () => {
    expect(isProfile('quick')).toBe(true);
    expect(isProfile('--fix')).toBe(false);
    expect(planGates('unbekannt')).toBeNull();
    expect(isFixMode(['--profile=quick'])).toBe(false);
    expect(isFixMode(['--profile=quick', '--fix'])).toBe(true);
  });
});
