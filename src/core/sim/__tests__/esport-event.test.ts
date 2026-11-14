/**
 * @test-target: src/core/sim/esport-event.ts
 * @error-code: ERR-2001
 *
 * Der E-Sport-Abend ist keine zweite Veranstaltung: Er hängt am vorhandenen
 * Turnierabend, das Ergebnis kommt deterministisch aus Chance und PRNG, Geld
 * läuft ausschließlich über den Ledger, und das Match steht danach im Archiv.
 */
import { describe, expect, it } from 'vitest';
import { randomSeed } from '../../../test/random-seed';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';

import { createWorld, ensureStarter } from '../templates';
import { ESPORT_TOURNAMENT_SUBJECT, esportView } from '../esport';
import { announceEsportEvening, esportEveningView, playEsportMatch } from '../esport-event';
import { ESPORT_STAKE, esportChanceBps, esportQuoteBps } from '../esport-odds';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { venueView } from '../venue-event';

const start = (seed = randomSeed()) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const ledger = new Ledger({});
  ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(50), 'Test: Startgeld', 0);
  return { world, ledger, prng: new Prng(seed) };
};

/** Ankuendigen und in den Einlass springen: das Fenster liegt bei 30..59 von 150 Ticks. */
const openEvening = (seed = randomSeed()) => {
  const started = start(seed);
  announceEsportEvening(started.world);
  started.world.tick = 45;
  return started;
};

describe('E-Sport-Abend im Turnierabend', () => {
  it('kündigt einen Turnierabend an und verweigert die zweite Ankündigung', () => {
    const { world } = start();
    expect(venueView(world).current).toBeNull();
    announceEsportEvening(world);
    const current = venueView(world).current;
    expect(current?.kind).toBe('TURNIER_ABEND');
    expect(world.archive.some((event) => event.subject === 'Turnierabend')).toBe(true);
    expect(() => announceEsportEvening(world)).toThrow();
  });

  it('spielt das Match nur im Einlass und nur einmal je Abend', () => {
    const { world, ledger, prng } = start();
    expect(() => playEsportMatch(world, ledger, prng, 'HOME')).toThrow();
    announceEsportEvening(world);
    world.tick = 45;
    expect(esportEveningView(world, ledger.getBalance(PORTEMONNAIE)).open).toBe(true);
    const first = playEsportMatch(world, ledger, prng, 'HOME');
    expect(first.notice).toContain('gewinnt');
    expect(esportEveningView(world, ledger.getBalance(PORTEMONNAIE)).match.played).toBe(true);
    expect(() => playEsportMatch(world, ledger, prng, 'AWAY')).toThrow();
  });

  it('bucht Einsatz und Auszahlung als Ledger-Zeilen und bleibt integer', () => {
    const { world, ledger, prng } = openEvening();
    const before = ledger.getBalance(PORTEMONNAIE);
    const result = playEsportMatch(world, ledger, prng, 'HOME');
    const after = ledger.getBalance(PORTEMONNAIE);
    expect(after).toBe((before - ESPORT_STAKE + result.payout) as typeof after);
    expect(ledger.entries.some((entry) => entry.to === EXTERNAL && entry.amount === ESPORT_STAKE)).toBe(true);
    if (result.won) {
      expect(ledger.entries.some((entry) => entry.from === EXTERNAL && entry.amount === result.payout)).toBe(true);
    }
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
    // Gegenkonto ist die Aussenwelt als Mints-Konto; sie darf negativ stehen.
    expect(ledger.entries.filter((entry) => entry.game === 'esport')).toHaveLength(result.won ? 2 : 1);
  });

  it('legt das Ergebnis als Turnier-Eintrag im Archiv ab', () => {
    const { world, ledger, prng } = openEvening();
    const result = playEsportMatch(world, ledger, prng, 'AWAY');
    const entry = world.archive.find((event) => event.subject === ESPORT_TOURNAMENT_SUBJECT);
    expect(entry?.effect).toBe(result.notice);
    expect(esportView(world).history[0]?.summary).toBe(result.notice);
  });

  it('liefert dasselbe Ergebnis bei gleichem Seed und Tag', () => {
    const seed = randomSeed();
    const run = () => {
      const { world, ledger, prng } = openEvening(seed);
      return { result: playEsportMatch(world, ledger, prng, 'HOME'), chance: esportEveningView(world, fromVC(50)).match.chanceBps };
    };
    expect(run()).toEqual(run());
  });

  it('rechnet Taktik als Konter in die Chance ein', () => {
    expect(esportChanceBps(70, 'KONTROLLE', 70, 'DRUCK')).toBe(5_400);
    expect(esportChanceBps(70, 'KONTROLLE', 70, 'SPLIT')).toBe(5_000);
    expect(esportChanceBps(70, 'KONTROLLE', 70, 'SPAETSPIEL')).toBe(4_600);
    expect(esportChanceBps(70, 'DRUCK', 70, 'KONTROLLE')).toBe(4_600);
    // Quote ist der Kehrwert der Chance mit Hausmarge.
    expect(esportQuoteBps(5_000)).toBe(18_400);
    expect(esportQuoteBps(9_500)).toBeLessThan(esportQuoteBps(5_000));
  });
});
