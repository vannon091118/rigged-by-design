/**
 * @test-target: src/render/assets/textures.ts
 * @error-code: ERR-4022
 *
 * Rueckfall-Grenze: Der Test ruft die echte Produktionsfunktion
 * `preloadRuntimeArt` auf, mockt aber den Atlas weg. Damit ist belegt, dass
 * der Boot-Preload alle zehn Stadttexturen als Einzeldateien anfordert, wenn
 * keine Atlasseite bereitsteht. Der Produktionspfad mit Atlas wird in
 * `atlas-environment.test.ts` belegt; dort darf kein `Assets.load` fallen.
 *
 * Nicht belegt: ein vollstaendiger App-Boot, ein Screenshot oder eine
 * Pixeldarstellung. Die Cloud-Browser-Session kann Pixi/WebGL nicht
 * initialisieren; der Canvas-Renderer und der echte Preload laufen dort.
 */
import { describe, expect, it, vi } from 'vitest';
import manifest from '../manifest.json';
import { preloadRuntimeArt as productionPreload } from '../textures';

const { assetsLoad } = vi.hoisted(() => ({ assetsLoad: vi.fn() }));

vi.mock('pixi.js', () => ({
  Assets: { load: assetsLoad },
  Texture: class {},
}));

// Der Atlas ist fuer die Stadttexturen nicht zustaendig; er darf den
// Preload nicht ueber einen zweiten Ladepfad verkuerzen.
vi.mock('../atlas', () => ({
  atlasTexture: () => null,
  loadAtlas: async () => undefined,
}));

describe('Stadt-Fallback ohne Atlas an der Assets.load-Grenze', () => {
  it('fordert alle zehn realen Stadttexturen ueber die Produktionsfunktion an', async () => {
    expect(productionPreload).toBeTypeOf('function');
    // Andere Tests koennen den Modulcache bereits gefuellt haben; der
    // Produktionspfad muss fuer diese Messung frisch starten.
    vi.resetModules();
    const { preloadRuntimeArt } = await import('../textures');
    assetsLoad.mockImplementation(async () => ({ source: { scaleMode: 'linear' } }));

    await preloadRuntimeArt();

    const calls = assetsLoad.mock.calls.map(([url]) => String(url));
    const city = calls.filter((url) => url.includes('/environment/floor/city/'));

    // Der Test koppelt bewusst nicht an die Reihenfolge oder Anzahl der
    // uebrigen Runtime-Kunst; die Stadttexturen sind der R8-Vertrag.
    expect(new Set(calls).size).toBe(calls.length);
    expect(city).toHaveLength(10);
    expect(city).toEqual([
      `${manifest.base}environment/floor/city/facades/apartment.svg`,
      `${manifest.base}environment/floor/city/facades/pub.svg`,
      `${manifest.base}environment/floor/city/facades/shop.svg`,
      `${manifest.base}environment/floor/city/facades/casino.svg`,
      `${manifest.base}environment/floor/city/props/street-light.svg`,
      `${manifest.base}environment/floor/city/props/bench.svg`,
      `${manifest.base}environment/floor/city/props/trash-bin.svg`,
      `${manifest.base}environment/floor/city/props/bus-stop.svg`,
      `${manifest.base}environment/floor/city/props/tree.svg`,
      `${manifest.base}environment/floor/city/doors/door.svg`,
    ]);
  });
});
