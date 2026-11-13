/**
 * @test-target: src/core/sim/city-growth.ts
 * @error-code: ERR-2001
 *
 * Die Stadt baut auf ein Signal, nicht auf einen Timer: Ohne Joblose passiert
 * nichts, ohne freien Platz auch nicht, und mit beidem entsteht ein Gebäude auf
 * einem festen Platz — samt Wänden, neuem Slot und einer Buchung, die im Ledger
 * steht. Reicht das Kapital nicht, trägt die Stadtfoerderung die Differenz; der
 * deterministische Langlauf belegt mehr als die drei Bauten des Startkapitals.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../economy/ledger';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { createWorld, ensureStarter } from '../templates';
import { createCityScene } from '../city-scene';
import { ensureCityLife, ensureCityPopulation } from '../city-life-state';
import {
  cityBuildings, cityGrowthView, jobMarket, advanceCityGrowth,
  BUILD_COST, BUILDER_ACCOUNT, BUILDER_START_CAPITAL,
} from '../city-growth';
import { CITY_PLOTS } from '../city-plots';
import { JOB_CAPACITY } from '../city-employment';
import { EXTERNAL, EXTERNAL_WORK } from '../money';
import { replaySave, toSavedGame } from '../../../store/save';

const start = (residents = 12) => {
  const world = createWorld('SMALL');
  ensureStarter(world);
  world.cityScene = createCityScene();
  ensureCityLife(world);
  ensureCityPopulation(world, residents);
  return { world, ledger: new Ledger({}), prng: new Prng(randomSeed()) };
};

describe('Bauträger und Wachstum', () => {
  it('zählt Stellen und Joblose aus Gebäuden und Bewohnern', () => {
    const { world } = start(12);
    const market = jobMarket(cityBuildings(world), world.cityLife.residents);
    expect(market.jobs).toBeGreaterThan(12);
    expect(market.openSlots).toBeGreaterThan(0);
    expect(market.jobless).toBe(0);
    expect(cityGrowthView(world, new Ledger({})).canBuild).toBe(false);
  });

  it('baut ohne Joblose nicht, nennt den Grund und zieht keine Foerderung auf Vorrat', () => {
    const { world, ledger } = start(12);
    expect(cityGrowthView(world, ledger).blockedReason).toBe('NO_JOBLESS');
    expect(advanceCityGrowth(world, ledger)).toBeNull();
    expect(ledger.getBalance(BUILDER_ACCOUNT)).toBe(0);
  });

  it('baut mit Joblosen und Kapital auf einem festen Platz, bucht den Bau', () => {
    const { world, ledger } = start(60);
    const before = cityBuildings(world).length;
    const report = advanceCityGrowth(world, ledger);
    expect(report).not.toBeNull();
    expect(report!.plotId.startsWith('plot_reserve_')).toBe(true);
    expect(cityBuildings(world)).toHaveLength(before + 1);
    expect(report!.building.kind).toBe('SHOP');
    expect(report!.building.locked).toBe(true);
    expect(ledger.getBalance(BUILDER_ACCOUNT)).toBe(BUILDER_START_CAPITAL - BUILD_COST);
    expect(ledger.entries.some((entry) => entry.from === BUILDER_ACCOUNT && entry.to === EXTERNAL_WORK)).toBe(true);
    expect(world.cityGrowth?.built).toEqual([report!.building.id]);
    // Der Neubau gibt Arbeit: die Zahl der Joblosen sinkt um seine Stellen.
    expect(jobMarket(cityBuildings(world), world.cityLife.residents).jobless)
      .toBe(report!.joblessBefore - JOB_CAPACITY.SHOP);
    // Er steht als Wand in der Szene, nicht nur im Register.
    const walls = world.cityScene!.layout.edges.filter((edge) => edge.kind === 'WALL').length;
    expect(walls).toBeGreaterThan(0);
  });

  it('baut höchstens ein Gebäude pro Tag, auch über die dritte Finanzierung hinaus', () => {
    const { world, ledger } = start(80);
    const first = advanceCityGrowth(world, ledger);
    expect(first).not.toBeNull();
    expect(advanceCityGrowth(world, ledger)).toBeNull();
    world.day += 1;
    world.tick += 600;
    const second = advanceCityGrowth(world, ledger);
    expect(second).not.toBeNull();
    expect(second!.building.id).not.toBe(first!.building.id);
    // Konto leeren: der naechste Bau wird von der Stadtfoerderung getragen,
    // nicht stillschweigend abgebrochen (#525).
    ledger.transfer(BUILDER_ACCOUNT, EXTERNAL, ledger.getBalance(BUILDER_ACCOUNT), 'Test: entleeren', world.tick);
    world.day += 1;
    world.tick += 600;
    const third = advanceCityGrowth(world, ledger);
    expect(third).not.toBeNull();
    expect(ledger.entries.some((entry) => entry.from === EXTERNAL && entry.to === BUILDER_ACCOUNT
      && entry.reason.includes('Stadtfoerderung'))).toBe(true);
  });

  it('belegt im deterministischen Langlauf mehr als drei Bauten bei der vorgesehenen Population', () => {
    const run = () => {
      const { world, ledger } = start(60);
      const ids: string[] = [];
      const kinds: string[] = [];
      for (let day = 1; day <= 8; day += 1) {
        world.day = day;
        world.tick = day * 600;
        const report = advanceCityGrowth(world, ledger);
        if (report) {
          ids.push(report.building.id);
          kinds.push(report.building.kind);
        }
      }
      return { world, ledger, ids, kinds };
    };
    const first = run();
    const second = run();
    // Die vorgesehene Stadtbevoelkerung (60) traegt fuenf Reservegrundstuecke,
    // nicht drei: danach fehlt der Platz, nicht das Geld (#525).
    expect(first.ids).toHaveLength(5);
    expect(first.ids).toEqual(second.ids);
    // Erst zwei Gewerbebauten (Arbeit), dann drei Wohnhaeuser (Wohnraum).
    expect(first.kinds).toEqual(['SHOP', 'SHOP', 'RESIDENCE', 'RESIDENCE', 'RESIDENCE']);
    expect(first.world.cityGrowth?.built).toHaveLength(5);
    expect(cityGrowthView(first.world, first.ledger).blockedReason).toBe('NO_PLOTS');
    // Jede Bewegung bleibt im Ledger: Startkapital, Baukosten, Foerderung.
    const entries = first.ledger.entries;
    expect(entries.filter((entry) => entry.reason === 'Bautraeger: Startkapital')).toHaveLength(1);
    expect(entries.filter((entry) => entry.reason.startsWith('Bau: '))).toHaveLength(5);
    expect(entries.filter((entry) => entry.reason.startsWith('Stadtfoerderung: '))).toHaveLength(2);
    expect(first.ledger.getBalance(BUILDER_ACCOUNT)).toBe(0);
  });

  it('hört auf, wenn kein freier Platz mehr da ist', () => {
    const { world, ledger } = start(400);
    const free = CITY_PLOTS.length - cityBuildings(world).length;
    let built = 0;
    for (let day = 0; day <= free + 2; day += 1) {
      // Kein Nachschub von Hand: Startkapital und Stadtfoerderung finanzieren
      // jeden moeglichen Bau, deshalb ist hier der Platz die einzige Grenze.
      world.day = day + 1;
      world.tick = (day + 1) * 600;
      if (advanceCityGrowth(world, ledger)) built += 1;
    }
    expect(built).toBe(free);
    expect(cityBuildings(world)).toHaveLength(CITY_PLOTS.length);
    // Ausdruecklicher Endzustand statt stiller Deckel (#525).
    expect(cityGrowthView(world, ledger).blockedReason).toBe('NO_PLOTS');
    expect(ledger.entries.filter((entry) => entry.reason.startsWith('Bau: '))).toHaveLength(built);
  });

  it('behält Gebäude und Wachstumsstand über Save/Load', () => {
    const { world, ledger, prng } = start(60);
    const report = advanceCityGrowth(world, ledger)!;
    const saved = JSON.parse(JSON.stringify(toSavedGame(world, ledger, prng.getState())));
    const loaded = replaySave(saved)!;
    expect(loaded.world.cityGrowth?.built).toEqual([report.building.id]);
    expect(cityBuildings(loaded.world).some((building) => building.id === report.building.id)).toBe(true);
  });
});
