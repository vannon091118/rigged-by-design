/**
 * @test-target: src/store/new-game.ts
 * @error-code: ERR-2001
 *
 * Der erste Abend als eine Kette: Eröffnung → Stadt → Casino → Automat aus der
 * Starter-Kiste → erster Gast nach 12 Ticks → Kasse → Spiel → Buchung → Tagesende.
 * Der Test ist deterministisch: eigener Seed, keine Uhr, keine Wandzeit.
 */
import { describe, expect, it } from 'vitest';
import { FIRST_ARRIVAL_TICK, TICKS_PER_DAY } from '../../core/sim/demand';
import { deployHeldCrate, pickupCrate } from '../../core/sim/player';
import { tickWorld } from '../../core/sim/tick';
import type { WorldState } from '../../core/sim/types';
import { exchangePoint } from '../../core/sim/world';
import { Prng } from '../../core/rng/prng';
import { randomSeed } from '../../test/random-seed';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';

function start(): { world: WorldState; ledger: ReturnType<typeof createNewGame>['ledger']; prng: Prng; scene: SceneCommands } {
  const game = createNewGame('SMALL');
  const world = game.world;
  return {
    world,
    ledger: game.ledger,
    // Der Startzustand bleibt deterministisch, auch wenn newGame einen Entropie-Seed zieht.
    prng: new Prng(randomSeed()),
    scene: new SceneCommands({ world: () => world, emit: () => {}, notice: () => {} }),
  };
}

/** Stellt die Starter-Kiste auf; das erste freie Feld in der Nähe gewinnt. */
function deployStarter(world: WorldState): void {
  const crate = world.crates[0]!;
  world.player.position = { x: crate.x, y: crate.y };
  pickupCrate(world, crate.id);
  for (let dy = -1; dy <= 4; dy += 1) {
    for (let dx = -1; dx <= 4; dx += 1) {
      try {
        deployHeldCrate(world, crate.x + dx, crate.y + dy);
        return;
      } catch {
        // Feld belegt oder ausserhalb: naechstes probieren.
      }
    }
  }
  throw new Error('Die Starter-Kiste liess sich nicht aufstellen.');
}

describe('Der erste Abend als Kette', () => {
  it('führt von der Eröffnung bis zum Tagesende, ohne Eingriff in den Code', () => {
    const { world, ledger, prng, scene } = start();

    // 1. Startzustand: Eröffnung, Wohnung, Kasse, Starter-Kiste.
    expect(world.onboarding?.step).toBe('OPENING');
    expect(world.scene.kind).toBe('APARTMENT');
    expect(world.crates).toHaveLength(1);

    scene.finishOpening();
    expect(world.onboarding?.step).toBe('APARTMENT');

    // 2. Haustür: von der Wohnung auf die Straße, dann ins Casino.
    scene.enterCity();
    expect(world.scene.kind).toBe('CITY');
    expect(world.onboarding?.step).toBe('CITY');

    // 3. Casino betreten: nur hier zieht die Nachfrage.
    scene.enterCasino();
    expect(world.scene.kind).toBe('OWN');
    expect(world.onboarding?.step).toBe('CASINO');
    expect(exchangePoint(world)).not.toBeNull();

    // 3. Der Automat aus der Kiste ist der Weg fuer den ersten Gast.
    deployStarter(world);
    expect(world.furniture.some((item) => item.gameId === 'SLOT')).toBe(true);

    // 4. Der erste Gast steht nach dem festen Termin vor der Tuer.
    let waited = 0;
    while (world.guests.length === 0 && waited < FIRST_ARRIVAL_TICK * 4) {
      tickWorld(world, ledger, prng);
      waited += 1;
    }
    expect(world.guests.length).toBeGreaterThan(0);
    expect(waited).toBeLessThanOrEqual(FIRST_ARRIVAL_TICK);

    // 5. Er wechselt an der Kasse, spielt und erzeugt Buchungen.
    let played = 0;
    while (!world.guests.some((guest) => guest.spins > 0) && played < 600) {
      tickWorld(world, ledger, prng);
      played += 1;
    }
    expect(world.guests.some((guest) => guest.spins > 0)).toBe(true);
    expect(ledger.entryCount).toBeGreaterThan(0);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    // 6. Der Tag endet in derselben Kette.
    let dayTicks = 0;
    while (world.day === 1 && dayTicks < TICKS_PER_DAY + 200) {
      tickWorld(world, ledger, prng);
      dayTicks += 1;
    }
    expect(world.day).toBeGreaterThanOrEqual(2);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);
  });
});
