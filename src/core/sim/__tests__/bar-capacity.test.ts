/** @test-target: src/core/sim/deliveries.ts | @error-code: ERR-3001 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { barCapacityForLevel } from '../deliveries';

const UI_SOURCES = ['src/ui/hud.tsx', 'src/ui/diagnostics-popup.tsx', 'src/ui/machine-operator.tsx'];

describe('Bar-Kapazität', () => {
  it('rechnet 12 + 8 Bestand pro Stufe', () => {
    expect(barCapacityForLevel(2)).toBe(28);
  });

  it('lässt die UI keine eigene Formel rechnen', () => {
    const own = UI_SOURCES.filter((file) => readFileSync(file, 'utf8').includes('6 + 6 *'));
    expect(own).toEqual([]);
  });

  it('bindet die UI die Core-Funktion ein', () => {
    const wired = UI_SOURCES.filter((file) => readFileSync(file, 'utf8').includes('barCapacityForLevel'));
    expect(wired).toEqual(UI_SOURCES);
  });
});
