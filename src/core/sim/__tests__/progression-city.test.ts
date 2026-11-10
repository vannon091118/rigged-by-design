/**
 * @test-target: src/core/sim/city.ts
 * @error-code: ERR-2001
 *
 * Stadt als zweiter Progression-Pfad: zwei Zweige, Energie und Pool-Texte.
 * Ausgelagert aus `progression.test.ts`, weil `check:loc` das Testbudget sonst reisst.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { CITY_ENERGY_PER_DAY, CITY_SLOT, NIGHT_SLOT, cityNightText, cityOf, cityText, cityView, marketUnlocked, restInCity, runCityAction, travel } from '../city';
import { NARRATIVE_REGISTRY } from '../narrative/composer/registry.generated';
import { createWorld, ensureStarter } from '../templates';

function start() {
  const world = createWorld('SMALL');
  ensureStarter(world);
  return { world, ledger: new Ledger() };
}

describe('Stadt: Kiez und Markt als Progression', () => {
  const texte = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === CITY_SLOT).map((fragment) => fragment.text);
  const imKiez = () => {
    const stadt = start();
    stadt.world.day = 3;
    travel(stadt.world, 'KIEZ');
    return { ...stadt, prng: new Prng(randomSeed()) };
  };
  const spielen = (stadt: ReturnType<typeof imKiez>, actionId: string, ziel: number): void => {
    const { world, ledger, prng } = stadt;
    const zweig = actionId.startsWith('KIEZ') ? 'KIEZ' : 'MARKT';
    while (cityOf(world)[zweig] < ziel) {
      if (cityOf(world).energy < 1) restInCity(world, ledger, prng);
      runCityAction(world, actionId);
    }
  };
  it('kostet Energie, zaehlt Fortschritt und nennt das Ergebnis', () => {
    const { world } = imKiez();
    const state = runCityAction(world, 'KIEZ_ANSPRECHEN');
    expect(state.energy).toBe(CITY_ENERGY_PER_DAY - 1);
    expect(state.KIEZ).toBe(1);
    expect(state.lastResult).toMatch(/KIEZ 1 Punkte/);
    expect(texte).toContain(state.lastText);
  });
  it('beendet den Tag und fuellt die Energie nachweislich auf', () => {
    const { world, ledger, prng } = imKiez();
    runCityAction(world, 'KIEZ_RUNDE');
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY - 2);
    const tag = world.day;
    restInCity(world, ledger, prng);
    expect(world.day).toBe(tag + 1);
    expect(cityOf(world).energy).toBe(CITY_ENERGY_PER_DAY);
    const nacht = NARRATIVE_REGISTRY.filter((fragment) => fragment.slot === NIGHT_SLOT).map((fragment) => fragment.text);
    expect(nacht.length).toBeGreaterThanOrEqual(50);
    expect(nacht).toContain(cityOf(world).lastText);
    expect(cityNightText('rest|4|KIEZ')).toBe(cityNightText('rest|4|KIEZ'));
  });
  it('sperrt den Markt bis zum Kiez-Rang Stammgast und schaltet ihn dann frei', () => {
    const { world, ledger, prng } = imKiez();
    expect(marketUnlocked(cityOf(world))).toBe(false);
    expect(texte.length).toBeGreaterThanOrEqual(50);
    expect(() => travel(world, 'MARKT')).toThrow(/Stammgast/);
    const gesperrt = cityView(world).actions.find((action) => action.branch === 'MARKT')!;
    expect(gesperrt.enabled).toBe(false);
    expect(gesperrt.blocked).toMatch(/Stammgast/);
    spielen({ world, ledger, prng }, 'KIEZ_ANSPRECHEN', 9);
    expect(marketUnlocked(cityOf(world))).toBe(true);
    expect(travel(world, 'MARKT').location).toBe('MARKT');
  });
  it('schliesst beide Zweige ab und behaelt den Abschluss', () => {
    const { world, ledger, prng } = imKiez();
    spielen({ world, ledger, prng }, 'KIEZ_ANSPRECHEN', 15);
    expect(cityOf(world).completed).toContain('KIEZ');
    travel(world, 'MARKT');
    spielen({ world, ledger, prng }, 'MARKT_FEILSCHEN', 12);
    expect(cityOf(world).completed).toEqual(['KIEZ', 'MARKT']);
    expect(cityView(world).branches.every((branch) => branch.done)).toBe(true);
  });
  it('waehlt denselben Text fuer denselben Ort, dieselbe Handlung und denselben Tick', () => {
    const [a, b] = [imKiez(), imKiez()];
    expect(runCityAction(a.world, 'KIEZ_RUNDE').lastText).toBe(runCityAction(b.world, 'KIEZ_RUNDE').lastText);
    expect(texte).toContain(cityText('KIEZ_RUNDE|1|42'));
  });
});
