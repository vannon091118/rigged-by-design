/**
 * @test-target: src/store/snapshot.ts
 * @error-code: ERR-1002
 *
 * Die offene Haus-Schuld ist keine zweite Zahl: Der Snapshot liest den negativen
 * Saldo von `DEBT_ACCOUNT` und gibt ihn vorzeichenrichtig positiv aus (min. 0).
 * Tilgung und neue Verbindlichkeit wirken ohne eigenen Zaehler auf denselben Wert.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { DEBT_ACCOUNT, HAUSKONTO, payOut, repayDebt } from '../../core/sim/money';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import { buildView } from '../snapshot';

const world = () => {
  const state = createWorld('SMALL');
  ensureStarter(state);
  return state;
};

describe('Haus-Schuld im Snapshot', () => {
  it('meldet ohne Verbindlichkeit exakt null', () => {
    const ledger = new Ledger();
    expect(buildView(world(), ledger, '').debt).toBe(0);
  });

  it('gibt den negativen Verbindlichkeitssaldo vorzeichenrichtig positiv aus', () => {
    const ledger = new Ledger();
    payOut(ledger, 1, fromVC(100), 0);
    expect(ledger.getBalance(DEBT_ACCOUNT)).toBe(-fromVC(100));
    expect(buildView(world(), ledger, '').debt).toBe(fromVC(100));
  });

  it('folgt der Tilgung aus demselben Ledger ohne zweiten Zaehler', () => {
    const ledger = new Ledger({ [HAUSKONTO]: fromVC(30) });
    payOut(ledger, 1, fromVC(100), 0);
    expect(buildView(world(), ledger, '').debt).toBe(fromVC(70));
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(30), 'test hilfe', 1);
    expect(repayDebt(ledger, 2)).toBe(fromVC(5));
    expect(buildView(world(), ledger, '').debt).toBe(fromVC(65));
  });
});
