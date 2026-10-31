/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Langlauf: Ledger bleibt integer und gedeckt, und der Betrieb steht ueber
 * mehrere Seeds und Spieltage nicht still. Eine reine Obergrenze fuer Gaeste
 * waere kein Betriebstest.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { TICKS_PER_DAY } from '../demand';
import { economyOf } from '../economics';
import { HAUSKONTO } from '../money';
import { hireAgent } from '../staff';
import { ensureStarter, createWorld } from '../templates';
import { tickWorld } from '../tick';
import { randomSeed } from '../../../test/random-seed';

const TICKS = Number(process.env.RBD_SOAK_TICKS ?? 3000);
const DAYS = Number(process.env.RBD_SOAK_DAYS ?? 3);

describe('Langzeitsimulation', () => {
  it(`läuft ${TICKS} Ticks ohne Ledger-Leck und ohne unbegrenzten Zustand`, { timeout: 600_000 }, () => {
    const world = createWorld('LARGE');
    ensureStarter(world);
    const ledger = new Ledger();
    ledger.transfer('EXTERNAL_WORLD', 'HAUSKONTO', fromVC(100_000), 'soak-kapital', 0);
    const prng = new Prng(randomSeed());
    for (let step = 1; step <= TICKS; step += 1) {
      tickWorld(world, ledger, prng);
      if (step % 250 === 0) {
        expect(ledger.verifyLedgerIntegrity()).toBe(true);
        expect(ledger.diagnose().ok).toBe(true);
        expect(world.journal.length).toBeLessThanOrEqual(240);
        expect(world.guests.length).toBeLessThan(600);
        expect(world.activePenalties.length).toBeLessThanOrEqual(2);
        expect(world.tick).toBe(step);
      }
    }
    expect(world.day).toBeGreaterThan(1);
    expect(world.nextGuestId).toBeGreaterThan(1);
    expect(ledger.entryCount).toBeGreaterThan(0);
    expect(ledger.diagnose().failure).toBeNull();
    // Der Betrieb lief wirklich: Gaeste kamen an und wurden bedient.
    expect(world.guestsServed).toBeGreaterThan(10);
    expect(world.reputation).toBeGreaterThan(0);
    expect(world.reputation).toBeLessThanOrEqual(100);
  });

  it(`bleibt über ${DAYS} Spieltage und mehrere Seeds in Betrieb`, { timeout: 600_000 }, () => {
    for (let run = 1; run <= 3; run += 1) {
      const world = createWorld('MEDIUM');
      ensureStarter(world);
      const ledger = new Ledger();
      ledger.transfer('EXTERNAL_WORLD', HAUSKONTO, fromVC(300), 'soak-kapital', 0);
      for (const role of ['cashier', 'cleaner', 'bartender'] as const) hireAgent(world, ledger, role);
      const prng = new Prng(randomSeed());
      // Erster und letzter Tick je Gast: Aufenthaltsdauer ohne Hilfszustand in der Welt.
      const firstSeen = new Map<number, number>();
      let maxStay = 0;
      let totalArrivals = 0;
      let totalDepartures = 0;

      for (let day = 1; day <= DAYS; day += 1) {
        let dayArrivals = 0;
        let dayDepartures = 0;
        for (let tick = 0; tick < TICKS_PER_DAY; tick += 1) {
          tickWorld(world, ledger, prng);
          const present = new Set<number>();
          for (const guest of world.guests) {
            present.add(guest.id);
            if (!firstSeen.has(guest.id)) {
              firstSeen.set(guest.id, world.tick);
              dayArrivals += 1;
            }
          }
          for (const [id, since] of firstSeen) {
            if (present.has(id)) continue;
            maxStay = Math.max(maxStay, world.tick - since);
            firstSeen.delete(id);
            dayDepartures += 1;
          }
        }
        totalArrivals += dayArrivals;
        totalDepartures += dayDepartures;
        expect(dayArrivals, `Seed ${run}, Tag ${day}: keine Ankuenfte`).toBeGreaterThan(2);
        expect(dayDepartures, `Seed ${run}, Tag ${day}: niemand verliess das Haus`).toBeGreaterThan(0);
        expect(world.guestsServed, `Seed ${run}, Tag ${day}: kein Gast bedient`).toBeGreaterThan(0);
        expect(ledger.verifyLedgerIntegrity()).toBe(true);
        expect(ledger.diagnose().ok).toBe(true);
        expect(world.satisfaction).toBeGreaterThanOrEqual(0);
        expect(world.satisfaction).toBeLessThanOrEqual(100);
        expect(world.reputation).toBeLessThanOrEqual(100);
        // Müll bleibt eine Hausaufgabe, kein unbegrenzter Zustand.
        expect(world.dirty.size).toBeLessThan(60);
        expect(world.visitors.length).toBeGreaterThan(0);
      }

      // Betrieb ueber Tage: Gaeste kommen, spielen und gehen wieder.
      expect(totalArrivals).toBeGreaterThan(DAYS * 3);
      expect(totalDepartures).toBeGreaterThan(DAYS);
      expect(maxStay, `Seed ${run}: ein Gast blieb einen ganzen Tag`).toBeLessThan(TICKS_PER_DAY);
      expect(economyOf(ledger).stakeVolume, `Seed ${run}: kein Spielumsatz`).toBeGreaterThan(0);
      expect(Number.isFinite(economyOf(ledger).operatingProfit)).toBe(true);
      expect(ledger.diagnose().failure).toBeNull();
    }
  });
});
