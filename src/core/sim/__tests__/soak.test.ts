/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Langlauf: Ledger bleibt integer und gedeckt, Gästezahl und Puffer bleiben begrenzt.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { ensureStarter, createWorld } from '../templates';
import { tickWorld } from '../tick';
import { randomSeed } from '../../../test/random-seed';

const TICKS = Number(process.env.RBD_SOAK_TICKS ?? 3000);

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
  });
});
