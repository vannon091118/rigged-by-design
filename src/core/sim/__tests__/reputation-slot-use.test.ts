/**
 * @test-target: src/core/sim/guest-play.ts
 * @error-code: ERR-2001
 *
 * Ruf veraendert die Slot-Nutzung: Ein Haus mit Standing wird mutiger bespielt.
 * Die Neigung bleibt begrenzt; Deckel und Chipbestand bleiben hart.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { personaStake, stakeConfidence } from '../guest-play';
import { createWorld, ensureStarter } from '../templates';
import { makeGuest } from '../traits';
import { Prng } from '../../rng/prng';

const SEED = 99;

function table() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const item = world.furniture.find((entry) => entry.gameId === 'SLOT')!;
  const guest = makeGuest({ id: 1, persona: 'STAMMGAST', prng: new Prng(SEED), spawn: { x: 2, y: 13 } });
  return { world, item, guest, wallet: fromVC(200) };
}

describe('Ruf und Einsatz', () => {
  it('begrenzt die Ruf-Neigung auf 0,8 bis 1,2', () => {
    expect(stakeConfidence(0)).toBeCloseTo(0.8, 5);
    expect(stakeConfidence(50)).toBeCloseTo(1, 5);
    expect(stakeConfidence(100)).toBeCloseTo(1.2, 5);
    expect(stakeConfidence(-20)).toBeCloseTo(0.8, 5);
    expect(stakeConfidence(400)).toBeCloseTo(1.2, 5);
  });

  it('laesst Gaeste in einem Haus mit besserem Ruf mehr setzen', () => {
    const { world, item, guest, wallet } = table();
    world.reputation = 15;
    const low = personaStake(world, item, guest, wallet);
    world.reputation = 85;
    const high = personaStake(world, item, guest, wallet);
    expect(high).toBeGreaterThan(low);
  });

  it('haelt den Dreifach-Deckel auch bei bestem Ruf', () => {
    const { world, item, guest, wallet } = table();
    world.reputation = 100;
    const base = Math.max(world.prices.slotMinBet, item.baseBet);
    expect(personaStake(world, item, guest, wallet)).toBeLessThanOrEqual(base * 3);
  });

  it('setzt nie mehr, als im Portemonnaie liegt', () => {
    const { world, item, guest } = table();
    world.reputation = 100;
    expect(personaStake(world, item, guest, fromVC(0.5))).toBeLessThanOrEqual(fromVC(0.5));
  });
});
