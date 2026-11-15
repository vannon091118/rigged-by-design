/**
 * @test-target: src/render/floor-interact.ts
 * @error-code: ERR-3001
 *
 * Regression #771: Der Switch im Floor-Interact hatte keinen exhaustiven
 * Default. Eine unbekannte ID lief ins Leere; jetzt ist sie ein Fehler.
 */
import { describe, expect, it } from 'vitest';
import type { MenuAction } from '../floor-actions';
import { handleFloorInteract, unhandledMenuActionError } from '../floor-interact';

describe('handleFloorInteract', () => {
  it('wirft bei einer ID ohne Fall statt still zurueckzukehren', () => {
    const unknown = { id: 'NOT_A_MENU_ACTION', label: 'Nichts', enabled: true } as unknown as MenuAction;

    expect(() => handleFloorInteract(unknown))
      .toThrow(/ohne ausfuehrbaren Handler: NOT_A_MENU_ACTION/);
  });

  it('nennt die ID in der Fehlermeldung, damit der Pfad ohne Handler auffindbar ist', () => {
    expect(unhandledMenuActionError('CLEAN_STAIN').message).toContain('CLEAN_STAIN');
  });
});
