/** @test-target: src/core/sim/fight-event.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { crowdBonus } from '../brawl-combat';
import { backyardView } from '../fight-career';
import { enterFightEvent, fightEventView } from '../fight-event';
import { backyardHistoryOf, fightRecordOf } from '../fight-history';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { isInjured } from '../player-rpg';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';
import { openVenueEvent } from '../venue-event';

function setup(wallet = 20) {
  const world = createWorld('SMALL');
  world.tick = 700;
  world.nextArrivalTick = 10_000;
  const ledger = new Ledger();
  if (wallet > 0) ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

const reasonsOf = (ledger: Ledger): string[] => ledger.entries.map((entry) => entry.reason);

describe('Kampfabend im Turnierabend', () => {
  it('liest Roster, Kampfplan und Zuschauer aus den vorhandenen Quellen', () => {
    const { world, ledger, prng } = setup();
    const closed = fightEventView(world, ledger.getBalance(PORTEMONNAIE));
    expect(closed.open).toBe(false);
    expect(closed.phase).toBe('CLOSED');
    expect(closed.ready).toBe(false);
    expect(closed.reason).toContain('Turnierabend');
    expect(closed.roster.length).toBeGreaterThanOrEqual(5);
    expect(closed.main).toMatchObject({ rank: 1, name: 'Bulle Bernd', beaten: false });

    openVenueEvent(world, 'TURNIER_ABEND');
    world.tick = 730;
    const guest = spawnGuest(world, prng, ledger)!;
    guest.mood = 100;
    const admission = fightEventView(world, ledger.getBalance(PORTEMONNAIE));
    expect(admission).toMatchObject({ open: true, phase: 'ADMISSION', ready: true });
    expect(admission.crowd).toBe(1);
    expect(admission.crowdBonus).toBe(crowdBonus(world.guests));
    expect(admission.crowdBonus).toBeGreaterThan(0);
    expect(admission.main.winChance).toBeGreaterThan(0);

    world.tick = 760;
    expect(fightEventView(world, ledger.getBalance(PORTEMONNAIE)).phase).toBe('RUNNING');
  });

  it('nimmt Nennungen nur im Einlass an und verweigert Verletzte oder fehlendes Nenngeld', () => {
    const { world, ledger, prng } = setup();
    openVenueEvent(world, 'TURNIER_ABEND');
    expect(() => enterFightEvent(world, ledger, prng)).toThrow(/Turnierabend/);
    world.tick = 730;
    world.player.rpg.injuryTicks = 10;
    expect(() => enterFightEvent(world, ledger, prng)).toThrow(/Verletzt/);
    world.player.rpg.injuryTicks = 0;

    const poor = setup(0);
    openVenueEvent(poor.world, 'TURNIER_ABEND');
    poor.world.tick = 730;
    expect(() => enterFightEvent(poor.world, poor.ledger, poor.prng)).toThrow(/Nenngeld/);

    expect(ledger.entryCount).toBe(1);
    expect(poor.ledger.entryCount).toBe(0);
  });

  it('bucht Nenngeld und Preisgeld und loest den vorhandenen Abend auf', () => {
    let won = false;
    for (let attempt = 0; attempt < 40 && !won; attempt += 1) {
      const { world, ledger, prng } = setup();
      world.player.rpg.brawlLevel = 30;
      openVenueEvent(world, 'TURNIER_ABEND');
      world.tick = 730;
      const before = ledger.getBalance(PORTEMONNAIE);
      const result = enterFightEvent(world, ledger, prng);
      if (!result.won) continue;
      won = true;
      expect(result.prize).toBe(fromVC(1.2));
      expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - fromVC(0.5) + fromVC(1.2));
      expect(reasonsOf(ledger).slice(-2)).toEqual([TX_REASON.FIGHT_EVENT_ENTRY, TX_REASON.FIGHT_EVENT_PRIZE]);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
      expect(fightRecordOf(world.archive)).toMatchObject({ wins: 1, losses: 0 });
      const journal = world.archive.filter((entry) => entry.subject === 'Kampfabend gegen Bulle Bernd');
      expect(journal).toHaveLength(1);
      expect(journal[0]!.effect).toContain('Gewonnen');
      expect(backyardHistoryOf(world.archive)).toHaveLength(0);
      expect(backyardView(world, ledger.getBalance(PORTEMONNAIE)).rung.rank).toBe(1);
      const event = world.narrative.events.find((entry) => entry.eventId === 'TURNIER_ABEND')!;
      expect(event).toMatchObject({ status: 'RESOLVED', step: 'RESULT' });
      expect(event.resolution).toContain('Kampfabend');
      expect(event.resolution).toContain('Bulle Bernd');
      expect(fightEventView(world, ledger.getBalance(PORTEMONNAIE)).open).toBe(false);
    }
    expect(won).toBe(true);
  });

  it('kostet bei einer Niederlage nur das Nenngeld und hinterlaesst eine Verletzung', () => {
    let lost = false;
    for (let attempt = 0; attempt < 60 && !lost; attempt += 1) {
      const { world, ledger, prng } = setup();
      world.player.rpg.hp = 1;
      openVenueEvent(world, 'TURNIER_ABEND');
      world.tick = 730;
      const before = ledger.getBalance(PORTEMONNAIE);
      const result = enterFightEvent(world, ledger, prng);
      if (result.won) continue;
      lost = true;
      expect(result.prize).toBe(0);
      expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - fromVC(0.5));
      expect(reasonsOf(ledger).slice(-1)).toEqual([TX_REASON.FIGHT_EVENT_ENTRY]);
      expect(isInjured(world.player.rpg)).toBe(true);
      expect(fightRecordOf(world.archive)).toEqual({ wins: 0, losses: 1, kos: 1 });
    }
    expect(lost).toBe(true);
  });

  it('Zuschauerbonus kommt aus der Laune und hebt die Kampfchance', () => {
    expect(crowdBonus([])).toBe(0);
    expect(crowdBonus([{ mood: 100 }])).toBeGreaterThan(0);
    expect(crowdBonus([{ mood: 0 }])).toBeLessThan(0);
    const { world, ledger, prng } = setup();
    openVenueEvent(world, 'TURNIER_ABEND');
    world.tick = 730;
    const quiet = fightEventView(world, ledger.getBalance(PORTEMONNAIE)).main.winChance;
    const guest = spawnGuest(world, prng, ledger)!;
    guest.mood = 100;
    const loud = fightEventView(world, ledger.getBalance(PORTEMONNAIE)).main.winChance;
    expect(loud).toBeGreaterThan(quiet);
  });
});
