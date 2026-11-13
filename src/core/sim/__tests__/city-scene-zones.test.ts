/**
 * @test-target: src/core/sim/city-scene.ts
 * @error-code: ERR-2001
 *
 * Das Layout ist die einzige raeumliche Wahrheit. Ein Save mit abweichender
 * Zonenkopie wird beim Laden aus dem Layout rekonstruiert, statt zwei
 * Geometrien an Boden und Rollen zu liefern.
 */
import { describe, expect, it } from 'vitest';
import { createCityScene, normalizeCityScene } from '../city-scene';

describe('Stadt-Zonen aus dem Layout', () => {
  it('ersetzt eine abweichende Zonenkopie durch das Layout', () => {
    const scene = createCityScene();
    const drift = { ...scene, zones: [{ ...scene.zones[0]!, x: scene.zones[0]!.x + 3 }] };
    const normalized = normalizeCityScene(drift);
    expect(normalized.zones).toEqual(normalized.layout.zones);
    expect(normalized.zones[0]!.x).toBe(scene.layout.zones[0]!.x);
  });

  it('laesst einen stimmigen Save unveraendert', () => {
    const scene = createCityScene();
    expect(normalizeCityScene(scene)).toBe(scene);
  });
});
