/**
 * @test-target: src/core/contracts/actionset.ts
 * @error-code: ERR-1002
 *
 * Contract actionset v1.0: Domain-registrierter ActionSet-Vertrag.
 */
import { describe, expect, it } from 'vitest';
import type { Action, ActionCategory, ActionId, ActionProvider } from '../actionset';
import { createAction, validateAction } from '../actionset';

describe('Contract: actionset v1.0', () => {
  it('erstellt eine valide Action', () => {
    const action: Action = createAction(
      'open_door',
      'Tür öffnen',
      'door_open',
      'interaction',
      10,
      true,
    );
    expect(action.id).toBe('open_door');
    expect(action.label).toBe('Tür öffnen');
    expect(action.icon).toBe('door_open');
    expect(action.category).toBe('interaction');
    expect(action.priority).toBe(10);
    expect(action.enabled).toBe(true);
    expect(action.enabledReason).toBeUndefined();
  });

  it('validiert eine korrekte Action', () => {
    const action: Action = createAction('bet', 'Einsatz', 'chip', 'game', 5, true);
    expect(validateAction(action)).toBe(true);
  });

  it('lehnt leere id ab', () => {
    expect(() => createAction('', 'Label', 'icon', 'cat', 1, true)).toThrow();
  });

  it('lehnt enabled === false ohne enabledReason ab', () => {
    expect(() =>
      createAction('locked', 'Gesperrt', 'lock', 'interaction', 1, false, ''),
    ).toThrow();
    expect(() => createAction('locked', 'Gesperrt', 'lock', 'interaction', 1, false, undefined)).toThrow();
  });

  it('erlaubt enabled === false mit nicht-leerem enabledReason', () => {
    const action: Action = createAction('locked', 'Gesperrt', 'lock', 'interaction', 1, false, 'Benötigt Schlüssel');
    expect(action.enabled).toBe(false);
    expect(action.enabledReason).toBe('Benötigt Schlüssel');
    expect(validateAction(action)).toBe(true);
  });

  it('lehnt enabled === true mit gesetztem enabledReason ab', () => {
    const action = createAction('open', 'Öffnen', 'door', 'interaction', 1, true, 'unzulässig') as Action;
    expect(validateAction(action)).toBe(false);
  });

  it('lehnt nicht-ganzzahlige priority ab', () => {
    expect(() => createAction('x', 'Label', 'icon', 'cat', 1.5, true)).toThrow();
    const invalid = { ...createAction('x', 'Label', 'icon', 'cat', 1, true), priority: 1.5 } as Action;
    expect(validateAction(invalid)).toBe(false);
  });

  it('lehnt leere category ab', () => {
    expect(() => createAction('x', 'Label', 'icon', '', 1, true)).toThrow();
  });

  const registered: Action[] = [];
  const provider: ActionProvider = {
    registerAction(action: Action) {
      registered.push(action);
    },
    getActions(): readonly Action[] {
      return [...registered];
    },
  };

  it('registriert und liefert Actions über ActionProvider', () => {
    const a1 = createAction('a', 'A', 'ia', 'cat', 1, true);
    const a2 = createAction('b', 'B', 'ib', 'cat', 2, false, 'deaktiviert');
    provider.registerAction(a1);
    provider.registerAction(a2);
    const actions = provider.getActions();
    expect(actions).toHaveLength(2);
    expect(actions[0]).toBe(a1);
    expect(actions[1]).toBe(a2);
    expect(actions.map((a) => a.id)).toEqual(['a', 'b']);
  });

  it('ActionId und ActionCategory sind Contract-Werte', () => {
    const id: ActionId = 'aktion_42';
    const cat: ActionCategory = 'interaction';
    expect(createAction(id, 'Aktion', 'i', cat, 1, true).id).toBe('aktion_42');
  });
});
