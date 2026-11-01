/** @test-target: src/core/sim/player-jobs.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { HAUSKONTO, PORTEMONNAIE } from '../money';
import { acceptJob, quitJob, requestJobTask, completeJobTask, payDailyWage, buyBar, BAR_PURCHASE_COST_VC, JOB_DEFS } from '../player-jobs';
import { randomSeed } from '../../../test/random-seed';
import { createWorld } from '../templates';

function setup() {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const prng = new Prng(randomSeed());
  return { world, ledger, prng };
}

describe('Player-Jobs: Definitionen', () => {
  it('hat 4 Jobs mit korrekten Werten', () => {
    expect(JOB_DEFS.CLEANER.dailyWageVC).toBe(3);
    expect(JOB_DEFS.BARTENDER.dailyWageVC).toBe(5);
    expect(JOB_DEFS.CARD_DEALER.dailyWageVC).toBe(8);
    expect(JOB_DEFS.MECHANIC.dailyWageVC).toBe(12);
  });

  it('Jobs sind nur in ihren Casinos verfügbar', () => {
    expect(JOB_DEFS.CLEANER.rivalId).toBe('HAFENKLAUSE');
    expect(JOB_DEFS.BARTENDER.rivalId).toBe('HAFENKLAUSE');
    expect(JOB_DEFS.CARD_DEALER.rivalId).toBe('GOLDENE_HAND');
    expect(JOB_DEFS.MECHANIC.rivalId).toBe('NEBELPALAST');
  });
});

describe('Player-Jobs: Job-Annahme und Kündigung', () => {
  it('startet ohne Job', () => {
    const { world } = setup();
    expect(world.player.job).toBeNull();
  });

  it('nimmt Job im richtigen Casino an', () => {
    const { world } = setup();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    expect(world.player.job?.jobId).toBe('CLEANER');
    expect(world.player.job?.rivalId).toBe('HAFENKLAUSE');
  });

  it('verweigert Job im falschen Casino', () => {
    const { world } = setup();
    expect(() => acceptJob(world, 'GOLDENE_HAND', 'CLEANER')).toThrow(/nicht/);
  });

  it('verweigert Doppel-Job', () => {
    const { world } = setup();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    expect(() => acceptJob(world, 'GOLDENE_HAND', 'CARD_DEALER')).toThrow(/bereits einen Job/);
  });

  it('kündigt Job', () => {
    const { world } = setup();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    quitJob(world);
    expect(world.player.job).toBeNull();
  });

  it('verweigert Kündigung ohne Job', () => {
    const { world } = setup();
    expect(() => quitJob(world)).toThrow(/keinen Job/);
  });
});

describe('Player-Jobs: Aufgaben', () => {
  it('startet und beendet Aufgabe', () => {
    const { world } = setup();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    const result = requestJobTask(world);
    expect(result.started).toBe(true);
    expect(world.player.job?.currentTask).not.toBeNull();
    expect(world.player.job?.currentTask?.ticksElapsed).toBe(0);

    completeJobTask(world, { nextFloat: () => 0.5 });
    expect(world.player.job?.currentTask).toBeNull();
    expect(world.player.job?.workDays).toBe(1);
  });

  it('verweigert Aufgabe ohne Job', () => {
    const { world } = setup();
    expect(() => requestJobTask(world)).toThrow(/keinen Job/);
  });

  it('verweigert doppelte Aufgabe', () => {
    const { world } = setup();
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    requestJobTask(world);
    expect(() => requestJobTask(world)).toThrow(/bereits/);
  });
});

describe('Player-Jobs: Lohn', () => {
  it('zahlt Tageslohn aus', () => {
    const { world, ledger, prng } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'test', 0);
    const before = ledger.getBalance(PORTEMONNAIE);
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    // Tag vorrücken, damit Lohn fällig wird
    world.day += 1;
    const paid = payDailyWage(world, ledger, prng, world.tick);
    expect(paid).toBe(true);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before + fromVC(3));
  });

  it('zahlt nicht zweimal am selben Tag', () => {
    const { world, ledger, prng } = setup();
    ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(100), 'test', 0);
    acceptJob(world, 'HAFENKLAUSE', 'CLEANER');
    world.day += 1;
    payDailyWage(world, ledger, prng, world.tick);
    const paid = payDailyWage(world, ledger, prng, world.tick);
    expect(paid).toBe(false);
  });

  it('zahlt keinen Lohn ohne Job', () => {
    const { world, ledger, prng } = setup();
    const paid = payDailyWage(world, ledger, prng, world.tick);
    expect(paid).toBe(false);
  });
});

describe('Bar-Kauf', () => {
  it('kostet 50 VC', () => {
    expect(BAR_PURCHASE_COST_VC).toBe(50);
  });

  it('verweigert Kauf ohne Geld', () => {
    const { world, ledger } = setup();
    expect(() => buyBar(world, ledger, world.tick)).toThrow(/Bargeld/);
  });

  it('erlaubt Kauf mit genug Geld', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', PORTEMONNAIE, fromVC(100), 'test', 0);
    buyBar(world, ledger, world.tick);
    expect(world.player.barPurchased).toBe(true);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(50));
  });

  it('verweigert Doppel-Kauf', () => {
    const { world, ledger } = setup();
    ledger.transfer('EXTERNAL_WORLD', PORTEMONNAIE, fromVC(100), 'test', 0);
    buyBar(world, ledger, world.tick);
    expect(() => buyBar(world, ledger, world.tick)).toThrow(/bereits eine Bude/);
  });
});
