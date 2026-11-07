/** @test-target: src/core/sim/player-jobs.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { PORTEMONNAIE } from '../money';
import { acceptJob, completeJobTask, payDailyWage, requestJobTask } from '../player-jobs';
import { createWorld } from '../templates';

function hired() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
  return { world, ledger, prng };
}

function shift(world: ReturnType<typeof createWorld>): void {
  requestJobTask(world);
  completeJobTask(world, { nextFloat: () => 0.5 });
}

describe('Tageslohn ohne Arbeit', () => {
  it('zahlt nichts, wenn an diesem Tag keine Schicht lief', () => {
    const { world, ledger, prng } = hired();
    world.day += 1;
    expect(payDailyWage(world, ledger, prng, world.tick)).toBe(false);
  });

  it('lässt das Portemonnaie bei Nichtstun unverändert', () => {
    const { world, ledger, prng } = hired();
    const before = ledger.getBalance(PORTEMONNAIE);
    world.day += 1;
    payDailyWage(world, ledger, prng, world.tick);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before);
  });

  it('lässt workDays ohne Schicht stehen', () => {
    const { world, ledger, prng } = hired();
    world.day += 1;
    payDailyWage(world, ledger, prng, world.tick);
    expect(world.player.job?.workDays).toBe(0);
  });

  it('zahlt nach fünf untätigen Tagen keinen einzigen Lohn nach', () => {
    const { world, ledger, prng } = hired();
    world.day += 5;
    expect(payDailyWage(world, ledger, prng, world.tick)).toBe(false);
  });
});

describe('Tageslohn nach einer Schicht', () => {
  it('zahlt die Schicht am Tageswechsel aus', () => {
    const { world, ledger, prng } = hired();
    shift(world);
    world.day += 1;
    expect(payDailyWage(world, ledger, prng, world.tick)).toBe(true);
  });

  it('schreibt den Lohn der Schicht dem Portemonnaie gut', () => {
    const { world, ledger, prng } = hired();
    const before = ledger.getBalance(PORTEMONNAIE);
    shift(world);
    world.day += 1;
    payDailyWage(world, ledger, prng, world.tick);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before + fromVC(3));
  });

  it('zählt die geleistete Schicht in workDays', () => {
    const { world } = hired();
    shift(world);
    expect(world.player.job?.workDays).toBe(1);
  });

  it('zahlt an einem folgenden untätigen Tag nicht noch einmal', () => {
    const { world, ledger, prng } = hired();
    shift(world);
    world.day += 1;
    payDailyWage(world, ledger, prng, world.tick);
    world.day += 1;
    expect(payDailyWage(world, ledger, prng, world.tick)).toBe(false);
  });
});
