/**
 * @test-target: src/store/migrate.ts
 * @error-code: ERR-1002
 *
 * Saves vor der Anwesenheitsregel tragen kein `lastWorkDay` im Job.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { PORTEMONNAIE } from '../../core/sim/money';
import { payDailyWage } from '../../core/sim/player-jobs';
import { replaySave } from '../save';

function legacyJob(overrides: Record<string, unknown> = {}) {
  return {
    version: 9,
    template: 'SMALL',
    carpet: 'VIOLET',
    furniture: [],
    guests: [],
    player: {
      position: { x: 2, y: 2 }, path: [], pathIndex: 0, carrying: '',
      job: { jobId: 'CLEANER', rivalId: 'HAFENKLAUSE', stationId: 'kleenecke', currentTask: null, workDays: 3, lastPaidDay: 1 },
    },
    dirty: [],
    prices: {
      entryFee: 0, drinkPrice: fromVC(0.4), slotMinBet: fromVC(0.05), staffWage: fromVC(4),
      guardWage: fromVC(6), cleaningCost: fromVC(0.8), repairCost: fromVC(2),
    },
    staff: { guard: false, cleaner: false, bartender: false },
    tick: 120,
    day: 5,
    nextGuestId: 1,
    nextFurnitureId: 100,
    guardsHired: 0,
    lastEvent: 'stand ohne lastWorkDay',
    entries: [],
    prngState: 99,
    ...overrides,
  };
}

describe('Alt-Save ohne Anwesenheitsfeld', () => {
  it('lädt ohne Fehler', () => {
    expect(replaySave(legacyJob())).not.toBeNull();
  });

  it('startet den Job ohne anerkannte Schicht', () => {
    const loaded = replaySave(legacyJob())!;
    expect(loaded.world.player.job?.lastWorkDay).toBe(0);
  });

  it('zahlt für vergangene Tage nichts nach', () => {
    const loaded = replaySave(legacyJob())!;
    expect(payDailyWage(loaded.world, loaded.ledger, new Prng(randomSeed()), 0)).toBe(false);
  });

  it('lässt das Portemonnaie beim Laden unverändert', () => {
    const loaded = replaySave(legacyJob())!;
    expect(loaded.ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(0));
  });
});
