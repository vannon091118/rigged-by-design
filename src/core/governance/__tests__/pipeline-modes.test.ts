/**
 * @test-target: scripts/lib/pipeline-plan.mjs
 * @error-code: ERR-0911
 *
 * Ein Pruefer darf die Akte nicht vorher umschreiben. Kein Verify-Profil
 * enthaelt deshalb einen schreibenden Schritt; `fix` ist der einzige Pfad,
 * der repariert, und jedes Gate traegt einen rein lesenden Aufruf. Ausserdem
 * liegt hier die eine Wahrheit fuer CI-Zustaende und das Required-Set.
 */
import { describe, expect, it } from 'vitest';
import {
  CI_STATES,
  GATES,
  LIGHT_GATES,
  PROFILE_GATES,
  PROFILES,
  QUICK_GATES,
  REQUIRED_CI_GATES,
  gatesForState,
  isCIState,
  isFixMode,
  isProfile,
  planGates,
} from '../../../../scripts/lib/pipeline-plan.mjs';

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
    for (const [key, gate] of Object.entries(GATES) as [string, { script: string; args?: string[] }][]) {
      const call = [gate.script, ...(gate.args ?? [])].join(' ');
      expect(call, `${key} repariert statt zu pruefen`).not.toMatch(/--fix|--write|autofix/);
    }
    // Matrix und Katalog sind keine Gates mehr; das Doku-Gate prueft nur.
    expect(GATES.docs?.script).toBe('scripts/verify-docs.mjs');
    expect(GATES.docs?.args ?? []).toEqual([]);
  });

  it('verbindet im dev-Profil die Light-Gates mit den betroffenen Tests', () => {
    expect(PROFILE_GATES.dev).toEqual([...PROFILE_GATES.light, 'affected']);
    expect(planGates('dev')).toEqual(PROFILE_GATES.dev);
    expect(PROFILE_GATES.dev).not.toContain('tests');
    expect(GATES.affected?.script).toBe('scripts/test-affected.mjs');
    expect(isProfile('dev')).toBe(true);
  });

  it('prueft im vollen und im Release-Profil mehr als im kurzen Lauf', () => {
    const quick = PROFILE_GATES.quick ?? [];
    const full = PROFILE_GATES.full ?? [];
    expect(full).toEqual(PROFILE_GATES.release);
    expect(full.length).toBeGreaterThan(quick.length);
    expect(quick).not.toContain('build');
    expect(full).toContain('build');
    expect(full).toContain('audit');
    expect(quick).toContain('docs');
    expect(quick).not.toContain('deps-matrix');
    expect(quick).not.toContain('catalog');
  });

  it('gibt jedem Gate ein hartes Zeitlimit', () => {
    for (const [key, gate] of Object.entries(GATES) as [string, { timeoutMs: number }][]) {
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

describe('CI-Gate-Wahrheit', () => {
  it('baut das Required-Set aus QUICK plus build', () => {
    expect(REQUIRED_CI_GATES).toEqual([...QUICK_GATES, 'build']);
    // Jedes Required-Gate ist ein echtes Gate mit eigenem Namen, kein Tippfehler.
    expect(REQUIRED_CI_GATES.map((key: string) => GATES[key]?.name)).toEqual([...REQUIRED_CI_GATES]);
    expect(PROFILE_GATES.full).toEqual(expect.arrayContaining([...REQUIRED_CI_GATES, 'audit']));
  });

  it('ordnet jedem Zustand genau seine Gates zu', () => {
    expect(CI_STATES).toEqual(['PR', 'MAIN', 'MANUAL', 'LIGHT', 'NOOP', 'PR_HANDOFF', 'UNKNOWN']);
    for (const state of ['PR', 'MAIN', 'MANUAL']) {
      expect(gatesForState(state)).toEqual([...REQUIRED_CI_GATES]);
    }
    expect(gatesForState('UNKNOWN')).toEqual([...REQUIRED_CI_GATES, 'audit']);
    expect(gatesForState('LIGHT')).toEqual([...LIGHT_GATES]);
    expect(gatesForState('NOOP')).toEqual([]);
    expect(gatesForState('PR_HANDOFF')).toEqual([]);
    expect(gatesForState('quatsch')).toBeNull();
    // Ein unbekannter Zustand ist nie ein stiller Fallback auf ein Profil.
    expect(gatesForState('')).toBeNull();
  });

  it('erkennt Zustaende unabhaengig von der Schreibweise, aber nicht beliebig', () => {
    expect(isCIState('light')).toBe(true);
    expect(isCIState('PR_HANDOFF')).toBe(true);
    expect(isCIState('quatsch')).toBe(false);
    expect(isCIState(undefined)).toBe(false);
  });
});
