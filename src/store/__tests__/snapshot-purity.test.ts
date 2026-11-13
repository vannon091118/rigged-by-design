/**
 * @test-target: src/store/snapshot.ts
 * @error-code: ERR-1002
 *
 * Ein Snapshot ist eine Projektion: Er darf weder Bewohnerprofile anlegen noch
 * `nextVisitorId` verschieben. Profile entstehen beim Anlegen oder Laden, nicht
 * beim Lesen; sonst veraendert jeder Render den Spielstand.
 */
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { createCityLifeState } from '../../core/sim/city-life-create';
import { cityLifeView } from '../../core/sim/city-life-view';
import { createWorld, ensureStarter } from '../../core/sim/templates';
import type { WorldState } from '../../core/sim/types';
import { buildView } from '../snapshot';

function unboundWorld(): WorldState {
  const world = createWorld('SMALL');
  ensureStarter(world);
  const life = createCityLifeState(4242);
  world.cityLife = {
    ...life,
    residents: life.residents.map((resident) => ({ ...resident, visitorId: null })),
  };
  return world;
}

/** Alles, was ein Snapshot in diesem Pfad anfassen koennte. */
function observableState(world: WorldState): string {
  return JSON.stringify({
    visitors: world.visitors,
    nextVisitorId: world.nextVisitorId,
    cityLife: world.cityLife,
    city: world.city ?? null,
  });
}

describe('Snapshot-Purity', () => {
  it('legt in cityLifeView keine Profile an und veraendert keine Kennung', () => {
    const world = unboundWorld();
    const before = observableState(world);

    const view = cityLifeView(world);

    expect(view).toHaveLength(3);
    expect(view.every((resident) => resident.traits.length === 0)).toBe(true);
    expect(observableState(world)).toBe(before);
    expect(world.visitors).toHaveLength(0);
    expect(world.nextVisitorId).toBe(1);
  });

  it('laesst buildView den Stadtzustand und den Besucherzaehler unberuehrt', () => {
    const world = unboundWorld();
    const before = observableState(world);

    const view = buildView(world, new Ledger(), '');

    expect(view.city.residents).toHaveLength(3);
    expect(view.city.residents.every((resident) => resident.traits.length === 0)).toBe(true);
    expect(observableState(world)).toBe(before);
    expect(world.city).toBeUndefined();
    expect(world.visitors).toHaveLength(0);
    expect(world.nextVisitorId).toBe(1);
  });
});
