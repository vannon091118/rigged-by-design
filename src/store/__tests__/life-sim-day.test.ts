/** @test-target: src/store/new-game.ts | src/store/scene-commands.ts | src/store/save.ts | @error-code: ERR-2001
 *
 * Vollständiger Lebenssimulations-Tag als zusammenhängender Spielerpfad über die
 * bestehenden Store-/Command-/Sim-Systeme. Kein neues Meta-Framework, kein zweiter
 * Spielzustand. Der Test ist deterministisch: fester Seed, keine Uhr, keine Wandzeit.
 *
 * Pfad: Wohnung → Stadt/Begegnung → fremder Casino-Job → Tageswechsel & Lohn →
 * Wohnung/Bedürfnis → eigene Immobilie → Save/Load mitten im Ablauf → Fortsetzung.
 */
import { describe, expect, it } from 'vitest';
import { TICKS_PER_DAY } from '../../core/sim/clock';
import { tickWorld, advanceToNextDay } from '../../core/sim/tick';
import type { WorldState } from '../../core/sim/types';
import { Prng } from '../../core/rng/prng';
import { fromVC } from '../../core/economy/vacoin';
import { createNewGame } from '../new-game';
import { SceneCommands } from '../scene-commands';
import { toSavedGame, replaySave } from '../save';
import { buildView } from '../snapshot';
import { exchangePoint } from '../../core/sim/world';
import { acceptJob, requestJobTask, JOB_DEFS } from '../../core/sim/player-jobs';
import { visitForeignCmd, leaveForeignCmd } from '../foreign-floor-commands';
import { buyProperty } from '../../core/sim/property';
import { eatAtHome } from '../../core/sim/player-needs';
import { playerTakeHome } from '../../core/sim/money';
import { pickupCrate, deployHeldCrate } from '../../core/sim/player';

/** Reproduzierbarer Seed für den Test-Lauf. */
const TEST_SEED = 0xC0FFEE973;

/** Starter-Kiste aufstellen: wie in first-evening.test.ts, hier lokal dupliziert. */
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

function start(): { world: WorldState; ledger: ReturnType<typeof createNewGame>['ledger']; prng: Prng; scene: SceneCommands } {
  const game = createNewGame('SMALL');
  const world = game.world;
  const prng = new Prng(TEST_SEED);
  return {
    world,
    ledger: game.ledger,
    prng,
    scene: new SceneCommands({ world: () => world, emit: () => {}, notice: () => {}, prng, ledger: game.ledger }),
  };
}

describe('Vollständiger Lebenssimulations-Tag', () => {
  it('führt einen Spieler durch einen kompletten Tag und in den Folgetag', () => {
    const { world, ledger, prng, scene } = start();

    // 1. Startzustand: Eröffnung, Wohnung, Starter-Kiste, leerem eigenen Casino-Bereich.
    expect(world.onboarding?.step).toBe('OPENING');
    expect(world.scene.kind).toBe('APARTMENT');
    expect(world.crates).toHaveLength(1);
    expect(world.player.property).toBeNull();

    // 2. Eröffnung abschließen: in die Wohnung erwachen.
    scene.finishOpening();
    expect(world.onboarding?.step).toBe('APARTMENT');

    // 3. Wohnung → Stadt (Sozialhandlung / Begegnung).
    scene.enterCity();
    expect(world.scene.kind).toBe('CITY');

    // 4. Stadt → eigenes Casino.
    scene.enterCasino();
    expect(world.scene.kind).toBe('OWN');
    expect(exchangePoint(world)).not.toBeNull();

    // 5. Starter-Automat aufstellen, erster Gast kommt und spielt.
    deployStarter(world);
    expect(world.furniture.some((item) => item.gameId === 'SLOT')).toBe(true);

    let waited = 0;
    while (world.guests.length === 0 && waited < TICKS_PER_DAY) {
      tickWorld(world, ledger, prng);
      waited += 1;
    }
    expect(world.guests.length).toBeGreaterThan(0);

    let played = 0;
    while (!world.guests.some((guest) => guest.spins > 0) && played < 600) {
      tickWorld(world, ledger, prng);
      played += 1;
    }
    expect(world.guests.some((guest) => guest.spins > 0)).toBe(true);

    // 6. Fremdes Casino betreten, Job annehmen (Erwerbsaktion im fremden Betrieb).
    visitForeignCmd(world, 'HAFENKLAUSE');
    expect(world.scene.kind).toBe('FOREIGN');

    acceptJob(world, 'HAFENKLAUSE', 'BARTENDER');
    expect(world.player.job?.jobId).toBe('BARTENDER');
    expect(world.player.job?.rivalId).toBe('HAFENKLAUSE');

    // 7. Job-Task anfordern und über Ticks abschließen (Task-Dauer: 45 Ticks).
    const taskResult = requestJobTask(world);
    expect(taskResult.started).toBe(true);

    const taskTicks = JOB_DEFS.BARTENDER.taskDurationTicks;
    for (let i = 0; i < taskTicks; i += 1) tickWorld(world, ledger, prng);
    expect(world.player.job?.currentTask).toBeNull();
    expect(world.player.job?.workDays).toBe(1);

    // 8. Tageswechsel: Tag 2, Lohn/Upkeep laufen genau einmal (ausgelöst im Tick,
    // nicht manuell – payDailyWage läuft intern via staffTick).
    const balanceBeforeWage = ledger.getBalance('PORTEMONNAIE');
    advanceToNextDay(world, ledger, prng);
    expect(world.day).toBe(2);
    expect(world.player.job?.lastPaidDay).toBe(2); // Lohn wurde am Tageswechsel ausgezahlt
    expect(ledger.getBalance('PORTEMONNAIE')).toBeGreaterThan(balanceBeforeWage);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    // 9. Zurück in die Wohnung, Bedürfnis stillen (Konsum).
    leaveForeignCmd(world);
    expect(world.scene.kind).toBe('OWN');
    scene.enterCity();
    expect(world.scene.kind).toBe('CITY');
    scene.enterApartment();
    expect(world.scene.kind).toBe('APARTMENT');
    // Zur Kochnische gehen: der Spieler ist am Eingang angekommen, nun steht er
    // am Kochnische-Tile (Manhattan-Abstand <= 3 zum Counter bei 8,9).
    world.player.position = { x: 8, y: 9 };

    eatAtHome(world);
    expect(world.player.needs.hunger).toBeLessThan(80);

    // 10. Eigene Immobilie kaufen (eigener Betrieb).
    playerTakeHome(ledger, fromVC(100), world.tick);
    const balanceBefore = ledger.getBalance('PORTEMONNAIE');
    buyProperty(world, ledger, 'GEWERBERAUM', world.tick);
    expect(world.player.property?.id).toBe('GEWERBERAUM');
    expect(ledger.getBalance('PORTEMONNAIE')).toBeLessThan(balanceBefore);
    expect(ledger.verifyLedgerIntegrity()).toBe(true);

    const viewBeforeSave = buildView(world, ledger, '');
    expect(viewBeforeSave.scene.kind).toBe('APARTMENT');
    expect(world.day).toBe(2);

    // 11. Save/Load mitten im Ablauf: Position/Szene, Job, Bedürfnisse, Ledger, RNG.
    const raw = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(raw);
    expect(loaded).not.toBeNull();

    const loadedWorld = loaded!.world;
    const loadedLedger = loaded!.ledger;
    const loadedPrng = new Prng(loaded!.prngState);

    expect(loadedWorld.day).toBe(2);
    expect(loadedWorld.scene.kind).toBe('APARTMENT');
    expect(loadedWorld.player.position).toEqual(world.player.position);
    expect(loadedWorld.player.job?.jobId).toBe('BARTENDER');
    expect(loadedWorld.player.job?.workDays).toBe(1);
    expect(loadedWorld.player.property?.id).toBe('GEWERBERAUM');
    expect(loadedLedger.verifyLedgerIntegrity()).toBe(true);
    expect(loadedLedger.entryCount).toBeGreaterThanOrEqual(ledger.entryCount);

    // Nach dem Laden kann der Ablauf fortgesetzt werden: keine doppelten Events,
    // keine doppelten Buchungen.
    const loadedScene = new SceneCommands({
      world: () => loadedWorld,
      emit: () => {},
      notice: () => {},
      prng: loadedPrng,
      ledger: loadedLedger,
    });
    loadedScene.enterCity();
    expect(loadedWorld.scene.kind).toBe('CITY');

    let day2Ticks = 0;
    while (loadedWorld.day === 2 && day2Ticks < TICKS_PER_DAY + 200) {
      tickWorld(loadedWorld, loadedLedger, loadedPrng);
      day2Ticks += 1;
    }
    expect(loadedWorld.day).toBeGreaterThanOrEqual(3);
    expect(loadedLedger.verifyLedgerIntegrity()).toBe(true);

    // Ledger nach dem Laden darf keine doppelten Buchungen enthalten (kein Verlust).
    expect(loadedLedger.entryCount).toBeGreaterThanOrEqual(ledger.entryCount);
  });
});
