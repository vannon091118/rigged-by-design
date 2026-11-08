/** @test-target: src/store/game-commands.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { EXTERNAL, EXTERNAL_WORK, PLAYER_CASH, PORTEMONNAIE } from '../../core/sim/money';
import { createWorld } from '../../core/sim/templates';
import { exclusionCmd } from '../game-commands';

function setup(bonusVC: number) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  if (bonusVC > 0) {
    ledger.transfer(EXTERNAL, EXTERNAL_WORK, fromVC(bonusVC), 'reserve', 0);
    ledger.transfer(EXTERNAL_WORK, PLAYER_CASH, fromVC(bonusVC), 'pakt', 0);
  }
  return { world, ledger };
}

describe('Self-Exclusion-Auszahlung im Spiel-Command', () => {
  it('bucht Bonusguthaben per CASH_OUT ins Portemonnaie', () => {
    const { world, ledger } = setup(7);

    const notice = exclusionCmd(world, ledger, 'CASH_OUT', 100);

    expect(notice).toContain('Bonus ausgezahlt');
    expect(ledger.getBalance(PLAYER_CASH)).toBe(fromVC(0));
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(7));
  });

  it('verweigert CASH_OUT ohne Bonusguthaben', () => {
    const { world, ledger } = setup(0);

    expect(() => exclusionCmd(world, ledger, 'CASH_OUT', 100)).toThrow(/Guthaben/);
  });
});
