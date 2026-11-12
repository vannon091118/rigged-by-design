/**
 * @test-target: src/core/sim/player-needs.ts
 * @error-code: ERR-2001
 *
 * Spieler-Hunger und -Durst muessen im echten Tick leben: sinken, durch
 * Essen/Trinken steigen, Save/Load ueberstehen und ein spaeteres Ergebnis
 * (Stadtruf, Job-XP, Unfallrisiko) nachweislich veraendern.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { fromVC } from '../../economy/vacoin';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { replaySave, toSavedGame } from '../../../store/save';
import { CITY_ENERGY_PER_DAY, cityOf, cityView, runCityAction, travel } from '../city';
import { TICKS_PER_DAY } from '../demand';
import { acceptJob, completeJobTask, requestJobTask } from '../player-jobs';
import { drinkAtHome, eatAtHome, playerCondition } from '../player-needs';
import { playerCareer } from '../player-career';
import { PORTEMONNAIE } from '../money';
import { createWorld, ensureStarter } from '../templates';
import { tickWorld } from '../tick';

function start() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.tick = 0;
  world.day = 1;
  world.scene = { kind: 'APARTMENT' };
  return { world, ledger: new Ledger({ [PORTEMONNAIE]: fromVC(20) }), prng: new Prng(randomSeed()) };
}

describe('Spielerbedürfnisse im echten Spielpfad', () => {
  it('steigen im Tick und überstehen Save/Load ohne zweiten Zustand', () => {
    const { world, ledger, prng } = start();
    const initial = { ...world.player.needs };

    for (let i = 0; i < TICKS_PER_DAY * 2; i += 1) tickWorld(world, ledger, prng);

    console.log(`[player-needs] start=${initial.hunger}/${initial.thirst} nach 2 Tagen=${world.player.needs.hunger}/${world.player.needs.thirst}`);
    expect(world.player.needs.hunger).toBeGreaterThan(initial.hunger);
    expect(world.player.needs.thirst).toBeGreaterThan(initial.thirst);
    expect(world.player.needs.hunger).toBeCloseTo(54, 0);
    expect(world.player.needs.thirst).toBeCloseTo(70, 0);

    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    expect(loaded.world.player.needs).toEqual(world.player.needs);
    expect(loaded.world.day).toBe(world.day);
  });

  it('erholt sich an Kochnische und Kühlschrank und trainiert dabei Ausdauer', () => {
    const { world } = start();
    world.player.position = { x: 7, y: 10 };
    world.player.needs = { hunger: 82, thirst: 78 };

    eatAtHome(world);
    expect(world.player.needs.hunger).toBe(37);
    expect(world.player.needs.thirst).toBe(68);
    expect(world.player.rpg.attributeXp.endurance).toBeGreaterThan(0);

    drinkAtHome(world);
    expect(world.player.needs.thirst).toBe(13);
    expect(world.player.needs.hunger).toBe(32);
    expect(world.lastEvent).toContain('Durst 13');
    expect(playerCareer(world, fromVC(1), fromVC(0)).needs.condition).toBe('Satt und wach');
  });

  it('verändert den späteren Stadtruf: derselbe Kiez-Besuch bringt hungrig weniger', () => {
    const low = start().world;
    const high = start().world;
    travel(low, 'KIEZ');
    travel(high, 'KIEZ');
    low.player.needs = { hunger: 10, thirst: 10 };
    high.player.needs = { hunger: 90, thirst: 90 };
    low.reputation = 10;
    high.reputation = 10;

    const lowResult = runCityAction(low, 'KIEZ_ANSPRECHEN');
    const highResult = runCityAction(high, 'KIEZ_ANSPRECHEN');

    expect(lowResult.energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(highResult.energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(low.reputation).toBe(10.4);
    expect(high.reputation).toBe(10.2);
    expect(highResult.lastResult).toContain('Hunger und Durst drücken');
    expect(cityView(high).playerNeeds.condition).toBe('Hunger und Durst drücken');
    const mealAction = cityView(high).actions.find((action) => action.id === 'KIEZ_ESSEN');
    if (!mealAction) throw new Error('KIEZ_ESSEN fehlt in den Stadtaktionen.');
    expect(mealAction.id).toBe('KIEZ_ESSEN');
  });

  it('verändert ein späteres Job-Ergebnis: hungrige Mechaniker-Schicht verletzt und bringt weniger XP', () => {
    const hungry = start();
    acceptJob(hungry.world, 'NEBELPALAST', 'MECHANIC');
    hungry.world.player.needs = { hunger: 90, thirst: 90 };
    requestJobTask(hungry.world);
    const xpBefore = hungry.world.player.rpg.xp;
    completeJobTask(hungry.world, { nextFloat: () => 0.12 });

    expect(hungry.world.player.rpg.injuryTicks).toBeGreaterThan(0);
    expect(hungry.world.player.rpg.xp - xpBefore).toBe(12);
    expect(hungry.world.player.rpg.attributeXp.perception).toBeGreaterThan(0);

    const fed = start();
    acceptJob(fed.world, 'NEBELPALAST', 'MECHANIC');
    fed.world.player.needs = { hunger: 10, thirst: 10 };
    requestJobTask(fed.world);
    const fedXpBefore = fed.world.player.rpg.xp;
    completeJobTask(fed.world, { nextFloat: () => 0.12 });

    expect(fed.world.player.rpg.injuryTicks).toBe(0);
    expect(fed.world.player.rpg.xp - fedXpBefore).toBe(20);
    expect(playerCondition(fed.world.player.needs).workXpFactor).toBe(1);
  });

  it('läuft über vier In-Game-Tage, isst und trinkt im Kiez und bleibt im Save erhalten', () => {
    const { world, ledger, prng } = start();
    for (let i = 0; i < TICKS_PER_DAY * 4; i += 1) tickWorld(world, ledger, prng);
    expect(world.player.needs.hunger).toBeGreaterThan(80);
    expect(world.player.needs.thirst).toBeGreaterThan(80);

    travel(world, 'KIEZ');
    const fed = runCityAction(world, 'KIEZ_ESSEN');
    const quenched = runCityAction(world, 'KIEZ_TRINKEN');
    expect(fed.lastResult).toContain('Hunger');
    expect(quenched.lastResult).toContain('Durst');
    expect(world.player.needs.hunger).toBeLessThan(50);
    expect(world.player.needs.thirst).toBeLessThan(50);

    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    expect(loaded.world.player.needs).toEqual(world.player.needs);
    expect(loaded.world.city?.location).toBe('KIEZ');
    expect(cityOf(loaded.world).energy).toBeLessThan(CITY_ENERGY_PER_DAY);
  });
});
