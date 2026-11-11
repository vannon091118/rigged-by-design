/**
 * @test-target: src/core/sim/hybrid-flow.ts
 * @error-code: ERR-2001
 *
 * Hybrid-Besucherstroeme: der Veranstaltungsgast kommt mit Durst und geht
 * ueber den vorhandenen Pfad an die Bar; ohne Event bleibt die Ankunft
 * unveraendert. Der Clubgast nutzt nach dem Warten denselben Automatenpfad.
 * Geprueft wird der echte Zustand, kein zweites Modell.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { chooseActivity } from '../guest-choice';
import { guestAccount } from '../money';
import { startDemandEvent } from '../narrative/demand-events';
import { spawnGuest } from '../spawn';
import { createWorld } from '../templates';
import { tickWorld } from '../tick';

const fund = (ledger: Ledger, guestId: number): void => {
  ledger.transfer('EXTERNAL_WORLD', guestAccount(guestId), fromVC(10), 'test chips', 0);
};

describe('Hybrid-Besucherstroeme', () => {
  it('laesst Ankuenfte ohne Veranstaltung unveraendert', () => {
    const world = createWorld('SMALL');
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    expect(guest.need).toBe('play');
    expect(guest.thirst).toBeLessThan(65);
  });

  it('macht aus einem Veranstaltungsgast einen Bar-Gast', () => {
    const world = createWorld('SMALL');
    expect(startDemandEvent(world, 'NEON_NACHT')).not.toBeNull();
    const guest = spawnGuest(world, new Prng(randomSeed()), new Ledger())!;
    expect(guest.need).toBe('drink');
    expect(guest.thirst).toBeGreaterThanOrEqual(65);
  });

  it('schickt den Veranstaltungsgast ueber chooseActivity an die Bar und bucht den Drink', () => {
    const world = createWorld('SMALL');
    world.tick = 20;
    const ledger = new Ledger();
    const prng = new Prng(randomSeed());
    expect(startDemandEvent(world, 'NEON_NACHT')).not.toBeNull();
    const guest = spawnGuest(world, prng, ledger)!;
    fund(ledger, guest.id);
    const bar = world.furniture.find((item) => item.kind === 'BAR')!;
    const before = bar.stock;
    guest.state = 'CHOOSE';
    guest.stateTicks = 0;
    tickWorld(world, ledger, prng);
    expect(guest.targetFurniture).toBe(bar.id);
    expect(guest.state).toBe('DRINK');
    for (let step = 0; step < 250 && bar.stock === before; step += 1) tickWorld(world, ledger, prng);
    expect(bar.stock).toBeLessThan(before);
  });

  it('laesst einen Clubgast nach dem Warten an den Automaten', () => {
    const world = createWorld('SMALL');
    world.tick = 450;
    const ledger = new Ledger();
    const prng = new Prng(randomSeed());
    const guest = spawnGuest(world, prng, ledger)!;
    fund(ledger, guest.id);
    const lounge = world.zones.find((zone) => zone.kind === 'LOUNGE')!;
    guest.state = 'WAIT';
    guest.stateTicks = 4;
    guest.targetFurniture = 0;
    guest.need = 'play';
    guest.thirst = 0;
    guest.bladder = 0;
    guest.mood = 60;
    guest.patience = 60;
    guest.sociability = 10;
    guest.position = { x: lounge.x + 1, y: lounge.y + 1 };
    chooseActivity(world, guest, ledger, prng);
    expect(guest.state).toBe('PLAY');
    const target = world.furniture.find((item) => item.id === guest.targetFurniture)!;
    expect(target.kind).toBe('SLOT');
    expect(target.gameId).toBe('SLOT');
    expect(target.occupants).toContain(guest.id);
  });
});
