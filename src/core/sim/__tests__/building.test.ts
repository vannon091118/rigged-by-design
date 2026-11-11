/**
 * @test-target: src/core/sim/building.ts
 * @error-code: ERR-2001
 */
import { describe, expect, it } from 'vitest';
import {
  CITY_PRESET_BUILDINGS,
  canActorEnterBuilding,
  createBuilding,
  isBuildingOpen,
  setBuildingLocked,
  updateBuildingOccupancy,
} from '../building';
import type { BuildingFootprint, BuildingKind, OperatingHours } from '../building-types';

describe('Living World: Building Foundation', () => {
  it('erzeugt valide Gebäude mit unveraenderlichen Daten', () => {
    const footprint: BuildingFootprint = { x: 10, y: 10, w: 6, h: 4 };
    const kind: BuildingKind = 'SHOP';
    const hours: OperatingHours = { openHour: 8, closeHour: 20 };

    const building = createBuilding({
      id: 'bld_test_shop',
      name: 'Testladen',
      kind,
      footprint,
      entrance: { x: 12, y: 14 },
      interiorLayoutId: 'layout_test_shop',
      operatingHours: hours,
      locked: false,
    });

    expect(building.id).toBe('bld_test_shop');
    expect(building.name).toBe('Testladen');
    expect(building.kind).toBe('SHOP');
    expect(building.occupancy).toBe(0);
    expect(building.locked).toBe(false);
    expect(Object.isFrozen(building)).toBe(true);
    expect(Object.isFrozen(building.footprint)).toBe(true);
  });

  it('wirft Fehler bei ungueltiger ID oder Grundflaeche', () => {
    expect(() =>
      createBuilding({
        id: '',
        name: 'Test',
        kind: 'SHOP',
        footprint: { x: 0, y: 0, w: 5, h: 5 },
        entrance: { x: 1, y: 1 },
        interiorLayoutId: 'layout',
      }),
    ).toThrow();

    expect(() =>
      createBuilding({
        id: 'test',
        name: 'Test',
        kind: 'SHOP',
        footprint: { x: 0, y: 0, w: 0, h: 5 },
        entrance: { x: 1, y: 1 },
        interiorLayoutId: 'layout',
      }),
    ).toThrow();
  });

  it('berechnet Oeffnungszeiten fuer Tag- und Nachtbetrieb korrekt', () => {
    const dayShop = createBuilding({
      id: 'shop',
      name: 'Tagsüber',
      kind: 'SHOP',
      footprint: { x: 0, y: 0, w: 5, h: 5 },
      entrance: { x: 1, y: 1 },
      interiorLayoutId: 'layout',
      operatingHours: { openHour: 8, closeHour: 18 },
    });

    expect(isBuildingOpen(dayShop, 7)).toBe(false);
    expect(isBuildingOpen(dayShop, 8)).toBe(true);
    expect(isBuildingOpen(dayShop, 12)).toBe(true);
    expect(isBuildingOpen(dayShop, 17)).toBe(true);
    expect(isBuildingOpen(dayShop, 18)).toBe(false);

    const nightPub = createBuilding({
      id: 'pub',
      name: 'Nachtkneipe',
      kind: 'PUB',
      footprint: { x: 0, y: 0, w: 5, h: 5 },
      entrance: { x: 1, y: 1 },
      interiorLayoutId: 'layout',
      operatingHours: { openHour: 18, closeHour: 4 },
    });

    expect(isBuildingOpen(nightPub, 17)).toBe(false);
    expect(isBuildingOpen(nightPub, 18)).toBe(true);
    expect(isBuildingOpen(nightPub, 23)).toBe(true);
    expect(isBuildingOpen(nightPub, 1)).toBe(true);
    expect(isBuildingOpen(nightPub, 3)).toBe(true);
    expect(isBuildingOpen(nightPub, 4)).toBe(false);
  });

  it('gewaehrt Eigentuemern und Mietern immer Zutritt mit Schluessel', () => {
    const home = createBuilding({
      id: 'home',
      name: 'Privatwohnung',
      kind: 'APARTMENT',
      footprint: { x: 0, y: 0, w: 5, h: 5 },
      entrance: { x: 1, y: 1 },
      interiorLayoutId: 'layout',
      ownerId: 'PLAYER',
      tenantIds: ['ROOMMATE_1'],
      locked: true,
    });

    // Fremder darf nicht rein
    expect(canActorEnterBuilding(home, 'STRANGER', 14)).toBe(false);
    // Eigentümer darf rein
    expect(canActorEnterBuilding(home, 'PLAYER', 14)).toBe(true);
    // Mieter darf rein
    expect(canActorEnterBuilding(home, 'ROOMMATE_1', 14)).toBe(true);
    // Fremder mit Schlüssel darf rein
    expect(canActorEnterBuilding(home, 'STRANGER', 14, true)).toBe(true);
  });

  it('erhoeht und senkt Belegung deterministisch und ohne negative Werte', () => {
    const b0 = CITY_PRESET_BUILDINGS[0];
    if (!b0) throw new Error('CITY_PRESET_BUILDINGS[0] fehlt');
    expect(b0.occupancy).toBe(0);

    const b1 = updateBuildingOccupancy(b0, 1);
    expect(b1.occupancy).toBe(1);

    const b2 = updateBuildingOccupancy(b1, 2);
    expect(b2.occupancy).toBe(3);

    const b3 = updateBuildingOccupancy(b2, -1);
    expect(b3.occupancy).toBe(2);

    const bZero = updateBuildingOccupancy(b3, -10);
    expect(bZero.occupancy).toBe(0);
  });

  it('schaltet den Sperrzustand um', () => {
    const b = CITY_PRESET_BUILDINGS[1];
    if (!b) throw new Error('CITY_PRESET_BUILDINGS[1] fehlt');
    expect(b.locked).toBe(false);
    const lockedB = setBuildingLocked(b, true);
    expect(lockedB.locked).toBe(true);
  });
});
