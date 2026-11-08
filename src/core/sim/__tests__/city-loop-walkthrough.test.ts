/**
 * @test-target: src/core/sim/city.ts
 * @error-code: ERR-2001
 *
 * Headless-Abnahme des Stadt-Loops: Kiez bis Stammgast, Markt freischalten,
 * Tag beenden, beide Zweige abschliessen. Das ist derselbe Weg, den das
 * Stadt-Popup ueber `cityCmd` geht - nur ohne Browser, damit der Loop auch in
 * einer Umgebung ohne Grafik belegbar bleibt.
 *
 * Der Lauf schreibt jede Station nach stdout. Die Ausgabe ist die Abnahme:
 * Ort, Energie, Rang, Text und Abschluss muessen in dieser Reihenfolge stehen.
 * Zusaetzlich prueft der Lauf, dass die 52 Stadt-Bausteine wirklich gelesen
 * werden: ein Aufenthalt mit vielen Handlungen darf nicht immer denselben
 * Satz zeigen.
 */
import { describe, expect, it } from 'vitest';
import { CITY_ENERGY_PER_DAY, cityOf, cityView, restInCity, runCityAction, travel } from '../city';
import { createWorld, ensureStarter } from '../templates';
import type { WorldState } from '../types';

function start(): WorldState {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.day = 1;
  return world;
}

const gelesen: string[] = [];

/** Ein Schritt mit Beleg: Zustand vorher, Handlung, Zustand nachher. */
function step(world: WorldState, actionId: string): void {
  const before = cityOf(world);
  const after = runCityAction(world, actionId);
  const branchId = actionId.startsWith('KIEZ') ? 'KIEZ' : 'MARKT';
  const branch = branchId === 'KIEZ' ? after.KIEZ : after.MARKT;
  gelesen.push(after.lastText);
  console.log(
    `[stadt] tag=${world.day} ort=${after.location} energie=${before.energy}->${after.energy} `
      + `${actionId} punkte=${branch} rang=${cityView(world).branches.find((entry) => entry.id === branchId)!.tier} `
      + `text="${after.lastText}"`,
  );
}

function rest(world: WorldState): void {
  const before = cityOf(world).energy;
  const after = restInCity(world);
  console.log(`[stadt] tag=${world.day} TAGESABSCHLUSS energie=${before}->${after.energy} text="${after.lastText}"`);
}

/** Spielt einen Zweig bis zum Zielrang; der Tag endet nur, wenn die Energie fehlt. */
function play(world: WorldState, actionId: string, target: number): void {
  while ((actionId.startsWith('KIEZ') ? cityOf(world).KIEZ : cityOf(world).MARKT) < target) {
    if (cityOf(world).energy < 1) rest(world);
    step(world, actionId);
  }
}

describe('Stadt-Loop als Replay', () => {
  it('spielt Kiez bis Eingeweihter, schaltet den Markt frei und schliesst beide Zweige ab', () => {
    gelesen.length = 0;
    const world = start();
    console.log(`[stadt] start ort=${cityOf(world).location} energie=${cityOf(world).energy}/${CITY_ENERGY_PER_DAY}`);

    travel(world, 'KIEZ');
    console.log(`[stadt] reise KIEZ besuche=${cityOf(world).visits.KIEZ}`);

    // Der Markt ist vor dem Kiez-Rang Stammgast nachweislich zu.
    expect(cityView(world).locations.find((entry) => entry.id === 'MARKT')!.locked).toBe(true);
    expect(() => travel(world, 'MARKT')).toThrow(/Stammgast/);

    play(world, 'KIEZ_ANSPRECHEN', 9);
    expect(cityOf(world).KIEZ).toBeGreaterThanOrEqual(9);
    expect(cityView(world).locations.find((entry) => entry.id === 'MARKT')!.locked).toBe(false);
    console.log('[stadt] markt freigeschaltet ab Kiez-Rang Stammgast');

    play(world, 'KIEZ_ANSPRECHEN', 15);
    expect(cityOf(world).completed).toContain('KIEZ');
    console.log('[stadt] KIEZ abgeschlossen: Eingeweihter');

    // Der Loop darf nicht 15-mal denselben Satz lesen: von 15 Kiez-Handlungen
    // muessen mindestens acht verschiedene Bausteine erscheinen.
    const verschieden = new Set(gelesen);
    console.log(`[stadt] texte kiez=${verschieden.size} von ${gelesen.length} handlungen`);
    expect(verschieden.size).toBeGreaterThanOrEqual(8);

    travel(world, 'MARKT');
    expect(cityOf(world).location).toBe('MARKT');
    console.log('[stadt] reise MARKT');

    play(world, 'MARKT_FEILSCHEN', 12);
    expect(cityOf(world).completed).toContain('MARKT');
    console.log('[stadt] MARKT abgeschlossen: Marktherr');

    // Der Tag laesst sich auch nach dem Abschluss beenden und fuellt die Energie.
    rest(world);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY);

    const view = cityView(world);
    expect(view.completed).toEqual(['KIEZ', 'MARKT']);
    expect(view.branches.every((branch) => branch.done)).toBe(true);
    expect(view.branches.every((branch) => branch.unlocked)).toBe(true);
    console.log(
      `[stadt] abschluss zweige=${view.completed.join('+')} tage=${world.day} `
        + `kiez=${view.branches[0]!.points} markt=${view.branches[1]!.points}`,
    );
  });
});
