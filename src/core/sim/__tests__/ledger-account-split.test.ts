/**
 * @test-target: src/core/sim/self-exclusion-bet.ts
 * @error-code: ERR-2001
 *
 * Bauträger und Pakt teilen sich kein Konto mehr (#532): Ein Bau bucht in den
 * Bauträger-Escrow, der Pakt in seine eigene Reserve. Beide Reihenfolgen
 * bleiben gedeckt, und ein v11-Saldo wandert beim Laden einmalig in den Escrow.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, ZERO_VC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld, ensureStarter } from '../templates';
import { createCityScene } from '../city-scene';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import { advanceCityGrowth, BUILD_COST } from '../city-growth';
import { honorExclusionPact, recordExclusionPlay, startExclusionPact } from '../self-exclusion-bet';
import { BUILDER_ESCROW, EXTERNAL, EXTERNAL_WORK, PACT_RESERVE, PLAYER_CASH } from '../money';
import { replaySave, toSavedGame } from '../../../store/save';

const cityStart = (residents = 60) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};

describe('getrennte Konten für Bau und Pakt', () => {
  it('lässt einen Bau die Pakt-Reserve unberührt', () => {
    const { world, ledger } = cityStart();
    const report = advanceCityGrowth(world, ledger);
    expect(report).not.toBeNull();
    expect(ledger.getBalance(PACT_RESERVE)).toBe(0);
    expect(ledger.getBalance(PLAYER_CASH)).toBe(0);
    expect(ledger.getBalance(BUILDER_ESCROW)).toBe(BUILD_COST);
  });

  it('lässt einen Paktstart den Bauträger-Escrow unberührt', () => {
    const { world, ledger } = cityStart();
    advanceCityGrowth(world, ledger);
    const escrowAfterBuild = ledger.getBalance(BUILDER_ESCROW);
    startExclusionPact(world, ledger, fromVC(100), world.tick);
    expect(ledger.getBalance(BUILDER_ESCROW)).toBe(escrowAfterBuild);
    expect(ledger.getBalance(PACT_RESERVE)).toBe(fromVC(25));
  });

  it('zahlt den Disziplin-Bonus allein aus der Pakt-Reserve, auch nach einem Bau', () => {
    const { world, ledger } = cityStart();
    startExclusionPact(world, ledger, fromVC(100), 0);
    advanceCityGrowth(world, ledger);
    const escrowBeforeBonus = ledger.getBalance(BUILDER_ESCROW);
    recordExclusionPlay(world, fromVC(100), ZERO_VC, 0);
    expect(world.exclusionPact?.status).toBe('LIMIT_REACHED');
    honorExclusionPact(world, ledger, 8);
    expect(ledger.getBalance(PLAYER_CASH)).toBe(fromVC(25));
    expect(ledger.getBalance(PACT_RESERVE)).toBe(0);
    expect(ledger.getBalance(BUILDER_ESCROW)).toBe(escrowBeforeBonus);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('migriert einen v11-Saldo beim Laden in den Bauträger-Escrow', () => {
    const { world, ledger, prng } = cityStart();
    ledger.transfer(EXTERNAL, EXTERNAL_WORK, fromVC(42), 'v11: geteiltes Konto', world.tick);
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    expect(loaded.ledger.getBalance(BUILDER_ESCROW)).toBe(fromVC(42));
    expect(loaded.ledger.getBalance(EXTERNAL_WORK)).toBe(0);
    expect(loaded.ledger.getBalance(PACT_RESERVE)).toBe(0);
    expect(loaded.ledger.entries.some((entry) => entry.reason.startsWith('Migration: Bauträger-Escrow'))).toBe(true);
    expect(loaded.ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
