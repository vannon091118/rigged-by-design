/** @test-target: src/store/city-commands.ts | @error-code: ERR-1002 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { EXTERNAL, PORTEMONNAIE } from '../../core/sim/money';
import { createWorld } from '../../core/sim/templates';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { cityCmd } from '../city-commands';

function setup(walletVC = 0) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  if (walletVC > 0) ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(walletVC), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

describe('Stadt-Einstieg: Immobilienkauf', () => {
  it('kauft ueber denselben Einstieg wie die uebrigen Stadt-Handlungen', () => {
    const { world, ledger, prng } = setup(120);
    const notice = cityCmd(world, ledger, prng, { kind: 'buyProperty', propertyId: 'KNEIPE' });
    expect(notice).toBe(world.lastEvent);
    expect(notice).toContain('Kleine Kneipe');
    expect(world.player.property?.id).toBe('KNEIPE');
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(0));
  });

  it('reicht die Preispruefung unveraendert an den Aufrufer weiter', () => {
    const { world, ledger, prng } = setup(10);
    expect(() => cityCmd(world, ledger, prng, { kind: 'buyProperty', propertyId: 'GEWERBERAUM' }))
      .toThrow(/Nicht genug Bargeld/);
    expect(world.player.property).toBeNull();
  });
});
