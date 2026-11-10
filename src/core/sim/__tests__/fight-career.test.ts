/** @test-target: src/core/sim/fight-career.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { backyardFight, backyardView, type BackyardResult } from '../fight-career';
import { fightRecordOf } from '../fight-history';
import { recordJournal } from '../journal';
import { EXTERNAL, PORTEMONNAIE } from '../money';
import { isInjured } from '../player-rpg';
import { createWorld } from '../templates';
import { TX_REASON } from '../tx-reasons';

function setup(wallet = 20) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  if (wallet > 0) ledger.transfer(EXTERNAL, PORTEMONNAIE, fromVC(wallet), 'test startgeld', 0);
  return { world, ledger, prng: new Prng(randomSeed()) };
}

const reasonsOf = (ledger: Ledger): string[] => ledger.entries.map((entry) => entry.reason);

describe('Hinterhof-Karriere', () => {
  it('leitet den naechsten Gegner mit Startgeld und Siegchance aus dem Archiv ab', () => {
    const { world, ledger } = setup();
    const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
    expect(view.rung.rank).toBe(1);
    expect(view.rung.entryFee).toBe(fromVC(0.5));
    expect(view.rung.prize).toBe(fromVC(1.2));
    expect(view.totalRungs).toBeGreaterThanOrEqual(5);
    expect(view.winChance).toBeGreaterThan(0);
    expect(view.winChance).toBeLessThanOrEqual(100);
    expect(view.history).toHaveLength(0);
    expect(view.ready).toBe(true);
    expect(view.reason).toContain('Startgeld');
  });

  it('bucht Startgeld und Preisgeld über den Ledger und schreibt den Kampf ins Archiv', () => {
    let won = false;
    for (let attempt = 0; attempt < 40 && !won; attempt += 1) {
      const { world, ledger } = setup();
      world.player.rpg.brawlLevel = 30;
      const prng = new Prng(randomSeed());
      const before = ledger.getBalance(PORTEMONNAIE);
      const result: BackyardResult = backyardFight(world, ledger, prng);
      if (!result.won) continue;
      won = true;
      expect(result.prize).toBe(fromVC(1.2));
      expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - fromVC(0.5) + fromVC(1.2));
      expect(reasonsOf(ledger).slice(-2)).toEqual([TX_REASON.BACKYARD_ENTRY, TX_REASON.BACKYARD_PRIZE]);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
      const record = fightRecordOf(world.archive);
      expect(record).toEqual({ wins: 1, losses: 0, kos: 1 });
      const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
      expect(view.history).toHaveLength(1);
      expect(view.history[0]).toMatchObject({ name: 'Bulle Bernd', wins: 1, lastResult: 'Gewonnen' });
      expect(view.rung.rank).toBe(2);
      expect(world.player.rpg.xp).toBeGreaterThanOrEqual(30);
    }
    expect(won).toBe(true);
  });

  it('lässt bei einer Niederlage das Startgeld weg und hinterlässt eine Verletzung', () => {
    let lost = false;
    for (let attempt = 0; attempt < 60 && !lost; attempt += 1) {
      const { world, ledger } = setup();
      world.player.rpg.hp = 1;
      const prng = new Prng(randomSeed());
      const before = ledger.getBalance(PORTEMONNAIE);
      const result = backyardFight(world, ledger, prng);
      if (result.won) continue;
      lost = true;
      expect(result.prize).toBe(0);
      expect(ledger.getBalance(PORTEMONNAIE)).toBe(before - fromVC(0.5));
      expect(reasonsOf(ledger).slice(-1)).toEqual([TX_REASON.BACKYARD_ENTRY]);
      expect(ledger.verifyLedgerIntegrity()).toBe(true);
      expect(fightRecordOf(world.archive)).toEqual({ wins: 0, losses: 1, kos: 1 });
      expect(isInjured(world.player.rpg)).toBe(true);
      const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
      expect(view.ready).toBe(false);
      expect(view.reason).toContain('Verletzt');
      expect(view.history[0]).toMatchObject({ losses: 1, lastResult: 'Verloren' });
    }
    expect(lost).toBe(true);
  });

  it('verweigert den Kampf ohne Startgeld, ohne Buchung', () => {
    const { world, ledger } = setup(0);
    const view = backyardView(world, ledger.getBalance(PORTEMONNAIE));
    expect(view.ready).toBe(false);
    expect(view.reason).toContain('Startgeld fehlt');
    expect(() => backyardFight(world, ledger, new Prng(randomSeed()))).toThrow(/Startgeld/);
    expect(ledger.entryCount).toBe(0);
  });

  it('verweigert den Kampf mit Verletzung, ohne Buchung', () => {
    const { world, ledger } = setup();
    world.player.rpg.injuryTicks = 10;
    const entries = ledger.entryCount;
    expect(() => backyardFight(world, ledger, new Prng(randomSeed()))).toThrow(/Verletzt/);
    expect(ledger.entryCount).toBe(entries);
  });

  it('zählt Gastduell und Hinterhof in einer Bilanz, KOs nur mit Beleg', () => {
    const { world } = setup();
    recordJournal(world, {
      kind: 'GUEST', subject: 'Duell gegen Rocco', cause: 'Rädelsführer fordert dich',
      effect: 'Gewonnen: der Rädelsführer ist raus.',
    });
    recordJournal(world, {
      kind: 'SYSTEM', subject: 'Hinterhof gegen Bulle Bernd', cause: 'Hinterhof-Schläger',
      effect: 'Verloren: KO in Runde 3 · Startgeld 0,50 VC verloren.',
    });
    expect(fightRecordOf(world.archive)).toEqual({ wins: 1, losses: 1, kos: 1 });
  });
});
