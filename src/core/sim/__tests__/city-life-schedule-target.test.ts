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
    // Arbeit bleibt Arbeit, auch wenn der Plan etwas anderes nennt.
    expect(locationForIntent('WORK', 'MARKT', null, 'HOME')).toBe('MARKT');
  });
});
