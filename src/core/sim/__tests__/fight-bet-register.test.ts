/**
 * @test-target: src/core/sim/fight-bet-register.ts
 * @error-code: ERR-2001
 *
 * Ein Schein ist Geld: Der Einsatz ist beim Platzieren gebucht. Deshalb darf
 * die Journal-Retention (2000 Eintraege) ihn nicht verschlucken, und die
 * Auszahlung darf nicht an einem Anzeigetext haengen.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, mulVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { createWorld } from '../templates';
import { openSlips } from '../fight-bet-slips';
import { openSlipsOf } from '../fight-bet-register';
import { placeFightBet } from '../fight-bet-cashier';
import { runUndercard, settleFightBets } from '../fight-bet-settle';
import { recordJournal } from '../journal';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { TX_REASON } from '../tx-reasons';
import { openVenueEvent, tickVenueEvents } from '../venue-event';

function setup(wallet = 20) {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

const openEvening = (world: ReturnType<typeof setup>['world']): void => {
  openVenueEvent(world, 'TURNIER_ABEND');
  world.tick = 730;
};

/** Genug Journal-Verkehr, um das 2000er-Archiv einmal komplett zu kippen. */
function floodJournal(world: ReturnType<typeof setup>['world'], count: number): void {
  for (let index = 0; index < count; index += 1) {
    recordJournal(world, {
      kind: 'SYSTEM',
      subject: 'TESTFUELLUNG',
      cause: `index:${index}`,
      effect: `Testeintrag ${index}.`,
    });
  }
}

const payouts = (ledger: Ledger) =>
  ledger.entries.filter((entry) => entry.reason === TX_REASON.FIGHT_BET_PAYOUT);

describe('Wettscheine im eigenen Register', () => {
  it('findet den Schein auch nach 2050 Journal-Eintraegen und zahlt integer', () => {
    const { world, ledger, prng } = setup();
    openEvening(world);
    placeFightBet(world, ledger, 'A', fromVC(1));
    placeFightBet(world, ledger, 'B', fromVC(1));
    const slips = openSlipsOf(world).map((slip) => ({ ...slip }));
    expect(slips).toHaveLength(2);
    const result = runUndercard(world, prng)!;
    floodJournal(world, 2050);
    expect(world.archive.length).toBeLessThanOrEqual(2000);
    // Der Schein selbst liegt ausserhalb des Archivs.
    expect(openSlips(world)).toHaveLength(2);
    world.tick = 860;
    tickVenueEvents(world);
    expect(settleFightBets(world, ledger)).toBe(2);
    const winningPick = result.winner;
    const winner = slips.find((slip) => slip.pick === winningPick)!;
    expect(payouts(ledger)).toHaveLength(winningPick === 'A' || winningPick === 'B' ? 1 : 0);
    if (payouts(ledger).length === 1) {
      expect(payouts(ledger)[0]!.amount).toBe(mulVC(winner.stake, winner.oddsBp));
    }
    expect(openSlips(world)).toHaveLength(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('kann durch ein geaendertes cause-Format nicht still auf null fallen', () => {
    const { world, ledger, prng } = setup();
    openEvening(world);
    placeFightBet(world, ledger, 'A', fromVC(1));
    placeFightBet(world, ledger, 'B', fromVC(1));
    const slips = openSlipsOf(world).map((slip) => ({ ...slip }));
    const result = runUndercard(world, prng)!;
    // Die Anzeige-Texte werden unbrauchbar; die Abrechnung darf das nicht merken.
    world.archive = world.archive.map((entry) =>
      entry.subject === 'WETTSCHEIN' ? { ...entry, cause: 'kaputt' } : entry);
    world.tick = 860;
    tickVenueEvents(world);
    expect(settleFightBets(world, ledger)).toBe(2);
    const winner = slips.find((slip) => slip.pick === result.winner);
    const paid = payouts(ledger);
    if (winner) {
      expect(paid).toHaveLength(1);
      expect(paid[0]!.amount).toBe(mulVC(winner.stake, winner.oddsBp));
    } else {
      expect(paid).toHaveLength(0);
    }
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('behaelt offene Scheine und Vorkampf im Save-Roundtrip', () => {
    const { world, ledger, prng } = setup();
    openEvening(world);
    placeFightBet(world, ledger, 'KO', fromVC(2));
    const before = openSlipsOf(world)[0]!;
    runUndercard(world, prng);
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    expect(saved.fightBets.open).toHaveLength(1);
    const loaded = replaySave(saved)!;
    const after = openSlips(loaded.world)[0]!;
    expect(after.slip).toBe(before.id);
    expect(after.stake).toBe(before.stake);
    expect(after.oddsBp).toBe(before.oddsBp);
    expect(loaded.world.fightBets.undercard).not.toBeNull();
    expect(Number.isInteger(loaded.world.fightBets.undercard!.rounds)).toBe(true);
  });

  it('adoptiert offene Scheine alter Saves einmalig aus dem Archiv', () => {
    const { world, ledger } = setup();
    openEvening(world);
    placeFightBet(world, ledger, 'A', fromVC(1));
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, 1)));
    // v11 vor dieser Lane: kein Register, der Schein steht nur im Archiv.
    delete saved.fightBets;
    const loaded = replaySave(saved)!;
    const adopted = openSlips(loaded.world);
    expect(adopted).toHaveLength(1);
    expect(adopted[0]!.oddsBp).toBeGreaterThanOrEqual(100);
    expect(adopted[0]!.stake).toBe(fromVC(1));
    expect(loaded.world.fightBets.nextSlipId).toBe(adopted[0]!.slip + 1);
  });
});
