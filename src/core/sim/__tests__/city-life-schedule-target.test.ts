/**
 * @test-target: src/core/sim/city-life-targets.ts
 * @error-code: ERR-2001
 *
 * Der Tagesplan nennt ein Gebaeude, nicht nur eine Absicht. `COMMUTE` ist ein
 * Weg: Nach Schichtende muss er zum Wohngebaeude fuehren, nicht pauschal zum
 * Arbeitsplatz.
 */
import { describe, expect, it } from 'vitest';
import { locationForIntent } from '../city-life-targets';
import { buildingOfPlace, placeOfBuilding } from '../city-npc-shift';
import { createDayPlan, STANDARD_WORKDAY_ENTRIES } from '../npc-schedule';

describe('Ziel aus dem Tagesplan', () => {
  it('bildet Gebaeude auf Orte ab und zurueck', () => {
    expect(placeOfBuilding('bld_player_home')).toBe('HOME');
    expect(placeOfBuilding('bld_kiez_pub')).toBe('KIEZ');
    expect(placeOfBuilding('bld_corner_shop')).toBe('MARKT');
    expect(placeOfBuilding('bld_casino_grand')).toBe('CASINO');
    expect(placeOfBuilding('unbekannt')).toBeNull();
    expect(placeOfBuilding(null)).toBeNull();
    expect(buildingOfPlace('HOME')).toBe('bld_player_home');
  });

  it('laesst COMMUTE dem Planziel folgen statt dem Arbeitsplatz', () => {
    expect(locationForIntent('COMMUTE', 'MARKT', null, 'HOME')).toBe('HOME');
    expect(locationForIntent('COMMUTE', 'MARKT', null, 'KIEZ')).toBe('KIEZ');
    // Ohne Planziel bleibt der bisherige Rueckfall erhalten.
    expect(locationForIntent('COMMUTE', 'MARKT', null)).toBe('MARKT');
    // Jede geplante Absicht folgt dem konkreten Planziel.
    expect(locationForIntent('WORK', 'MARKT', null, 'HOME')).toBe('HOME');
    expect(locationForIntent('SHOP', 'MARKT', null, 'KIEZ')).toBe('KIEZ');
    expect(locationForIntent('EAT_OUT', 'MARKT', null, 'CASINO')).toBe('CASINO');
    expect(locationForIntent('PUB', 'CASINO', null, 'MARKT')).toBe('MARKT');
    expect(locationForIntent('LEISURE', 'CASINO', null, 'HOME')).toBe('HOME');
    // Ohne Planziel bleibt der bisherige Rueckfall erhalten.
    expect(locationForIntent('SHOP', 'MARKT', null)).toBe('MARKT');
  });

  it('bildet alle Gebaeude-IDs des Standardplans auf einen Ort ab', () => {
    for (const entry of STANDARD_WORKDAY_ENTRIES) {
      expect(placeOfBuilding(entry.targetBuildingId)).not.toBeNull();
    }
    const plan = createDayPlan('npc_alice', 'bld_player_home', 'bld_casino_grand');
    for (const entry of plan.entries) {
      expect(placeOfBuilding(entry.targetBuildingId, 'bld_player_home')).not.toBeNull();
    }
  });

  it('weist unbekannte Ziele fail-closed ab statt sie zu raten', () => {
    expect(placeOfBuilding('bld_grown_99', 'bld_player_home')).toBeNull();
    expect(placeOfBuilding('bld_office_99')).toBeNull();
  });
});
