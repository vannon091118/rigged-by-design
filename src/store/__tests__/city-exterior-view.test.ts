/** @test-target: src/store/city-exterior-view.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { createCityScene } from '../../core/sim/city-scene';
import { cityExteriorView } from '../city-exterior-view';

describe('Exterieur-Ansicht je Stadt', () => {
  it('liefert fuer denselben Stadtstand dieselbe Referenz', () => {
    const city = createCityScene();
    expect(cityExteriorView(city)).toBe(cityExteriorView(city));
  });

  it('nimmt das Layout der Stadt und nicht eine Kopie', () => {
    const city = createCityScene();
    const view = cityExteriorView(city);
    expect(view.layout).toBe(city.layout);
    expect(view.buildings).toBe(city.exterior.buildings);
    expect(view.layout.size).toBe(60);
  });

  it('baut je Stadtstand eine eigene Ansicht, ohne den Stand zu veraendern', () => {
    const first = createCityScene();
    const second = createCityScene();
    expect(cityExteriorView(first)).not.toBe(cityExteriorView(second));
    expect(first.exterior).toEqual(second.exterior);
  });
});
