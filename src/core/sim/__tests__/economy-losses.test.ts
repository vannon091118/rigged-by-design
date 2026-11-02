/**
 * @test-target: src/core/sim/economics.ts
 * @error-code: ERR-1002
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { economyOf } from '../economics';
import { HAUSKONTO, PORTEMONNAIE } from '../money';
import { ROBBERY_ACCOUNT } from '../penalty-pool';

describe('Verluste im Wirtschaftsbericht', () => {
  it('zaehlt einen Ueberfall auf das Hauskonto als Verlust', () => {
    const ledger = new Ledger({ HAUSKONTO: fromVC(500), PORTEMONNAIE: fromVC(10) });
    ledger.transfer(HAUSKONTO, ROBBERY_ACCOUNT, fromVC(100), 'Überfall: 20 % aus der Kasse', 1);
    expect(economyOf(ledger).losses).toBe(100);
  });

  it('zaehlt einen Ueberfall auf das Portemonnaie ebenfalls als Verlust', () => {
    const ledger = new Ledger({ HAUSKONTO: fromVC(10), PORTEMONNAIE: fromVC(500) });
    ledger.transfer(PORTEMONNAIE, ROBBERY_ACCOUNT, fromVC(50), 'Überfall: 10 % aus der Brieftasche', 2);
    expect(economyOf(ledger).losses).toBe(50);
  });
});
