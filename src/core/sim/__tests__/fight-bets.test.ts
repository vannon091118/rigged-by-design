/** @test-target: src/core/sim/fight-bets.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC, mulVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { fightBetView } from '../fight-bets';
import { placeFightBet } from '../fight-bet-cashier';
import { runUndercard, settleFightBets } from '../fight-bet-settle';
import { openSlips, type FightBetPick } from '../fight-bet-slips';
import { enterFightEvent } from '../fight-event';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';
import { openVenueEvent, tickVenueEvents } from '../venue-event';

function setup(wallet = 20) {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  const ledger = new Ledger();
  if (wallet > 0) ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

const openEvent = (world: ReturnType<typeof setup>['world']): void => {
  openVenueEvent(world, 'TURNIER_ABEND');
  world.tick = 730;
};

const reasonsOf = (ledger: Ledger): string[] => ledger.entries.map((entry) => entry.reason);

describe('Wettmarkt auf den Vorkampf', () => {
  it('bietet nur den Vorkampf an und schliesst mit dem Kampfbeginn', () => {
    const { world, ledger } = setup();
    expect(fightBetView(world, ledger.getBalance(PORTEMONNAIE)).market).toBeNull();
    openEvent(world);
    const view = fightBetView(world, ledger.getBalance(PORTEMONNAIE));
    expect(view.open).toBe(true);
    expect(view.market).not.toBeNull();
    // Der eigene Kampf ist kein Markt: Bulle Bernd steht nicht im Vorkampf.
    expect(view.market!.pair).not.toContain('Bulle Bernd');
    expect(view.market!.a).toBe('Zora Zeck');
    expect(view.market!.b).toBe('Taifun Tarek');
    for (const odds of Object.values(view.market!.odds)) {
      expect(odds).toBeGreaterThanOrEqual(1);
      expect(odds).toBeLessThanOrEqual(6);
    }
    // Der Standard-Vorkampf ist ausgeglichen: alle vier Picks haben einen Kurs.
    expect(Object.keys(view.market!.odds).sort()).toEqual(['A', 'B', 'KO', 'PUNKTE']);
    world.tick = 760;
    const closed = fightBetView(world, ledger.getBalance(PORTEMONNAIE));
    expect(closed.open).toBe(false);
    expect(closed.reason).toContain('Markt geschlossen');
    expect(() => placeFightBet(world, ledger, 'A', fromVC(1))).toThrow(/Markt geschlossen/);
  });

  it('bucht den Einsatz und fixiert die Quote im Schein', () => {
    const { world, ledger } = setup();
    openEvent(world);
    const market = fightBetView(world, ledger.getBalance(PORTEMONNAIE)).market!;
    placeFightBet(world, ledger, 'A', fromVC(1));
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(fromVC(19));
    expect(reasonsOf(ledger)).toContain(TX_REASON.FIGHT_BET_STAKE);
    const slip = world.archive.find((entry) => entry.subject === 'WETTSCHEIN')!;
    expect(slip.cause).toContain(`quote:${market.odds.A!}`);
    expect(slip.cause).toContain('pick:A');
    expect(fightBetView(world, ledger.getBalance(PORTEMONNAIE)).pending).toHaveLength(1);
    expect(() => placeFightBet(world, ledger, 'B', fromVC(0.05))).toThrow(/ausserhalb/);
    expect(() => placeFightBet(world, ledger, 'B', fromVC(6))).toThrow(/ausserhalb/);
    expect(() => placeFightBet(world, ledger, 'B', fromVC(25))).toThrow(/ausserhalb/);
    const poor = setup(2);
    openEvent(poor.world);
    expect(() => placeFightBet(poor.world, poor.ledger, 'B', fromVC(5))).toThrow(/Nicht genug Bargeld/);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('rechnet den entschiedenen Abend ab: zwei Gewinner, zwei Verlierer', () => {
    const { world, ledger, prng } = setup();
    openEvent(world);
    const picks: readonly FightBetPick[] = ['A', 'B', 'KO', 'PUNKTE'];
    for (const pick of picks) placeFightBet(world, ledger, pick, fromVC(1));
    const result = runUndercard(world, prng)!;
    expect(result.winner === 'A' || result.winner === 'B').toBe(true);
    enterFightEvent(world, ledger, prng);
    expect(reasonsOf(ledger).filter((reason) => reason === TX_REASON.FIGHT_BET_PAYOUT)).toHaveLength(2);
    expect(fightBetView(world, ledger.getBalance(PORTEMONNAIE)).pending).toHaveLength(0);
    expect(settleFightBets(world, ledger)).toBe(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });

  it('zahlt die bei der Abgabe fixierte Quote aus', () => {
    const { world, ledger, prng } = setup();
    openEvent(world);
    placeFightBet(world, ledger, 'A', fromVC(1));
    // Die Quote steht als Basispunkt-Ganzzahl am Schein, nicht mehr im Journal-Text.
    const slip = openSlips(world)[0]!;
    const result = runUndercard(world, prng)!;
    enterFightEvent(world, ledger, prng);
    const wins = ledger.entries.filter((entry) => entry.reason === TX_REASON.FIGHT_BET_PAYOUT);
    if (result.winner === 'A') {
      expect(wins).toHaveLength(1);
      expect(wins[0]!.amount).toBe(mulVC(fromVC(1), slip.oddsBp));
    } else {
      expect(wins).toHaveLength(0);
    }
  });

  it('erstattet den Einsatz, wenn der Abend ohne Vorkampf endet', () => {
    const { world, ledger } = setup();
    openEvent(world);
    placeFightBet(world, ledger, 'A', fromVC(1));
    world.tick = 860;
    tickVenueEvents(world);
    const event = world.narrative.events.find((entry) => entry.eventId === 'TURNIER_ABEND')!;
    expect(event.status).toBe('RESOLVED');
    const before = ledger.getBalance(PORTEMONNAIE);
    expect(settleFightBets(world, ledger)).toBe(1);
    expect(ledger.getBalance(PORTEMONNAIE)).toBe(before + fromVC(1));
    expect(reasonsOf(ledger)).toContain(TX_REASON.FIGHT_BET_REFUND);
    expect(fightBetView(world, ledger.getBalance(PORTEMONNAIE)).open).toBe(false);
  });
});
