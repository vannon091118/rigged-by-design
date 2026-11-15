/**
 * @vitest-environment jsdom
 * @test-target: src/ui/app-wiring.ts
 * @error-code: ERR-3001
 *
 * Regression #771: Der Kontextmenue-Vertrag war nur lose ueber Strings
 * verbunden. Jetzt hat jede ID aus `MENU_ACTION_IDS` genau eine Route, und eine
 * ID ohne Route wirft statt als Klick ohne Wirkung zu verpuffen.
 */
import { describe, expect, it } from 'vitest';
import { MENU_ACTION_IDS, type MenuAction } from '../../render/floor-actions';
import { executeMenuAction, hasMenuActionRoute } from '../app-wiring';

describe('MenuAction-Vertrag', () => {
  it('nennt jede Contract-ID genau einmal', () => {
    expect([...MENU_ACTION_IDS].sort()).toEqual([...new Set(MENU_ACTION_IDS)].sort());
  });

  it('hat fuer jede Contract-ID eine Route', () => {
    for (const id of MENU_ACTION_IDS) {
      expect(hasMenuActionRoute(id), `Route fehlt fuer ${id}`).toBe(true);
    }
  });

  it('wirft bei einer nicht registrierten ID statt still zu verpuffen', () => {
    const unknown = { id: 'NOT_A_MENU_ACTION', label: 'Nichts', enabled: true } as unknown as MenuAction;

    expect(() => executeMenuAction(unknown, { open: () => {}, anchorAt: () => {}, at: null }))
      .toThrow(/ohne ausfuehrbaren Handler: NOT_A_MENU_ACTION/);
  });
});
