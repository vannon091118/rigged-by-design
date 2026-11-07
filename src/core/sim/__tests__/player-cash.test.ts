/** @test-target: src/core/sim/self-exclusion-bet.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { cashOutPlayerCash } from '../self-exclusion-bet';
import { EXTERNAL, EXTERNAL_WORK, PLAYER_CASH, PORTEMONNAIE } from '../money';
import { createWorld } from '../templates';

describe('Bonus-Guthaben auszahlen', () => {
  it('bucht das Bonus-Guthaben ins Portemonnaie', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer(EXTERNAL, EXTERNAL_WORK, fromVC(7), 'reserve', 0);
    ledger.transfer(EXTERNAL_WORK, PLAYER_CASH, fromVC(7), 'pakt', 0);
    cashOutPlayerCash(world, ledger, 0);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(7));
  });

  it('lässt das Bonus-Konto leer zurück', () => {
    const world = createWorld('SMALL');
    const ledger = new Ledger();
    ledger.transfer(EXTERNAL, EXTERNAL_WORK, fromVC(7), 'reserve', 0);
    ledger.transfer(EXTERNAL_WORK, PLAYER_CASH, fromVC(7), 'pakt', 0);
    cashOutPlayerCash(world, ledger, 0);
    expect(ledger.getBalance(PLAYER_CASH)).toBe(fromVC(0));
  });

  it('verweigert die Auszahlung ohne Guthaben', () => {
    const world = createWorld('SMALL');
    expect(() => cashOutPlayerCash(world, new Ledger(), 0)).toThrow(/Guthaben/);
  });
});
