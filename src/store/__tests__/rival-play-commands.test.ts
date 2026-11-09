/** @test-target: src/store/rival-play-commands.ts | @error-code: ERR-1002 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { PORTEMONNAIE } from '../../core/sim/money';
import { Prng } from '../../core/rng/prng';
import { createWorld } from '../../core/sim/templates';
import { randomSeed } from '../../test/random-seed';
import { dealCardCmd, playRivalCmd, settleCardCmd } from '../rival-play-commands';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer('EXTERNAL_WORLD', PORTEMONNAIE, fromVC(5), 'test', 0);
  const prng = new Prng(randomSeed());
  return { world, ledger, prng };
}

describe('Rival Play Commands: Einsatzumrechnung', () => {
  it('bucht einen 0,1-VC-Spin als 1.000 Mikro-Einheiten', () => {
    const { world, ledger, prng } = setup();
    const result = playRivalCmd(world, ledger, 'HAFENKLAUSE', 0, 0.1, prng);
    expect(result?.stake).toBe(fromVC(0.1));
  });

  it('verweigert Abrechnung ohne Austeilen, bei falschem Einsatz und bei Doppelabrechnung', () => {
    const { world, ledger, prng } = setup();
    expect(settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.25, 20_000, 'Test')).toBeNull();
    expect(dealCardCmd(world, ledger, prng, 'GOLDENE_HAND', 0, 0.25)).not.toBeNull();
    expect(settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.3, 20_000, 'Test')).toBeNull();
    expect(settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.25, 99_000_000, 'Test')).toBeNull();
    expect(settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.25, 20_000, 'Test')).not.toBeNull();
    expect(settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.25, 20_000, 'Test')).toBeNull();
  });

  it('bucht Karten-Einsatz und Abrechnung in derselben Einheit', () => {
    const { world, ledger, prng } = setup();
    const deal = dealCardCmd(world, ledger, prng, 'GOLDENE_HAND', 0, 0.25);
    expect(deal).not.toBeNull();
    const settle = settleCardCmd(world, ledger, 'GOLDENE_HAND', 0, 0.25, 20_000, 'Test');
    expect(settle?.stake).toBe(fromVC(0.25));
  });
});
