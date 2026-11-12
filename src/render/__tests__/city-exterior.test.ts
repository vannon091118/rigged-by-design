/**
 * @test-target: src/render/city-exterior-layer.ts
 * @error-code: ERR-3001
 *
 * Abnahme ohne Screenshot: der normale Store-Einstieg erzeugt die 60x60-Stadt,
 * gibt sie an den Renderplan weiter, und die Kamera rechnet mit den echten
 * Stadtkanten. Dazu der Contract gegen Platzhalterflaechen im neuen Layer.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { areasForSize } from '../../core/sim/grid-zones';
import { CITY_SPAWN, createCityScene, normalizeCityScene } from '../../core/sim/city-scene';
import { createWorld } from '../../core/sim/templates';
import { TILE } from '../../core/sim/types';
import { buildView } from '../../store/snapshot';
import { moveToCmd } from '../../store/service-commands';
import { SceneCommands } from '../../store/scene-commands';
import manifest from '../assets/manifest.json';
import { FloorCamera } from '../floor-camera';
import { cityRenderPlan } from '../city-exterior-layer';
import { worldBoundsOf } from '../world-bounds';

const ASSET_ROOT = join(process.cwd(), 'public/assets/casino');
const ENVIRONMENT = manifest.environment as Readonly<Record<string, string>>;

function enterCityThroughProductionEntry(): ReturnType<typeof buildView> {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  const scene = new SceneCommands({
    world: () => world,
    emit: () => undefined,
    notice: () => undefined,
  });
  scene.enterCity();
  return buildView(world, ledger, '');
}

describe('Stadt-Exterieur im Produktionspfad', () => {
  it('erzeugt den 60x60-Stadtplan beim normalen enterCity und reicht ihn an die View weiter', () => {
    const view = enterCityThroughProductionEntry();
    expect(view.scene.kind).toBe('CITY');
    expect(view.size).toBe(60);
    expect(view.layout.size).toBe(60);
    expect(view.player.position).toEqual(CITY_SPAWN);
    expect(CITY_SPAWN).toEqual({ x: 8, y: 13 });
    expect(view.cityExterior).not.toBeNull();
    expect(view.cityExterior?.layoutId).toBe('layout_city_street_quarter');
    expect(view.cityExterior?.buildings).toHaveLength(4);
    expect(view.cityExterior?.props).toHaveLength(5);
    // Die Strasse ist echte Geometrie, kein 30x30-Menueportal.
    expect(view.layout.floor[14 * 60 + 2]).toBe('CONCRETE');
    expect(view.layout.floor[4 * 60 + 8]).toBe('WOOD');
    expect(view.layout.edges.some((edge) => edge.kind === 'DOOR')).toBe(true);
  });

  it('gibt jeder sichtbaren Stadtflaeche eine benannte Rolle und vorhandene Manifest-Textur', () => {
    const view = enterCityThroughProductionEntry();
    const plan = cityRenderPlan(view.cityExterior);
    expect(plan).not.toBeNull();
    expect(plan?.bounds).toEqual({ width: 60, height: 60 });
    expect(plan?.buildings.map((building) => building.role)).toEqual(['APARTMENT', 'PUB', 'SHOP', 'CASINO']);
    expect(plan?.props.map((prop) => prop.role)).toEqual(['STREET_LIGHT', 'BENCH', 'TRASH_BIN', 'BUS_STOP', 'TREE']);
    const assets = [...(plan?.buildings ?? []), ...(plan?.props ?? [])].map((surface) => surface.asset);
    expect(new Set(assets).size).toBe(assets.length);
    for (const asset of assets) {
      expect(ENVIRONMENT[asset], `Manifest-Rolle fuer ${asset}`).toBe(asset);
      expect(existsSync(join(ASSET_ROOT, asset)), `Textur ${asset}`).toBe(true);
    }
  });

  it('setzt die Kamera-Clamps auf die echten 60x60-Stadtgrenzen statt auf die 30er-Vorlage', () => {
    const view = enterCityThroughProductionEntry();
    const bounds = worldBoundsOf(view);
    expect(bounds).toEqual({ width: 60, height: 60 });
    const cityCam = new FloorCamera();
    cityCam.resize(960, 720, bounds, true);
    expect(cityCam.bounds).toEqual({ width: 60, height: 60 });
    const oldCam = new FloorCamera();
    oldCam.resize(960, 720, { width: 30, height: 30 }, true);
    expect(cityCam.fit).toBeCloseTo(oldCam.fit / 2, 6);
    expect(bounds.width * TILE * cityCam.fit).toBeLessThanOrEqual(720.001);
    cityCam.zoomToArea({ id: 'area-3', index: 3, x: 30, y: 30, w: 30, h: 30 }, bounds);
    for (let index = 0; index < 100; index += 1) cityCam.step();
    expect(cityCam.zoom).toBeGreaterThan(cityCam.fit);
    expect(cityCam.bounds).toEqual({ width: 60, height: 60 });
  });

  it('bewegt den Spieler im normalen Stadtpfad auf dem 60x60-Navigationsraster', () => {
    const world = createWorld('SMALL');
    const scene = new SceneCommands({ world: () => world, emit: () => undefined, notice: () => undefined });
    scene.enterCity();
    moveToCmd(world, { x: 50, y: 20 });
    expect(world.player.path.length).toBeGreaterThan(0);
    expect(world.player.path.at(-1)).toEqual({ x: 50, y: 20 });
  });

  it('teilt beide Stadtachsen in 30er-Chunks, damit alle vier Flaechen gezeichnet werden', () => {
    const areas = areasForSize(60);
    expect(areas).toHaveLength(4);
    expect(areas.map((area) => [area.x, area.y])).toEqual([[0, 0], [30, 0], [0, 30], [30, 30]]);
    expect(areas.every((area) => area.w === 30 && area.h === 30)).toBe(true);
  });

  it('ist deterministisch und aktualisiert die Stadt im Frame-Pfad', () => {
    const first = enterCityThroughProductionEntry();
    const second = enterCityThroughProductionEntry();
    expect(cityRenderPlan(first.cityExterior)).toEqual(cityRenderPlan(second.cityExterior));
    const source = readFileSync(join(process.cwd(), 'src/render/floor-view.ts'), 'utf8');
    expect(source).toContain('this.#city.update(cityRenderPlan(view.cityExterior));');
    expect(source).toContain('this.#city.animate(now, this.#view.dayPhase);');
    expect(source).toContain('bounds: () => worldBoundsOf(this.#view)');
    expect(readFileSync(join(process.cwd(), 'src/render/scene-cache.ts'), 'utf8'))
      .toContain('areasForSize(view.layout?.size ?? view.size)');
  });

  it('laesst keinen Platzhalterfarbwert auf die neuen Stadtflaechen', () => {
    const layer = readFileSync(join(process.cwd(), 'src/render/city-exterior-layer.ts'), 'utf8');
    const roles = readFileSync(join(process.cwd(), 'src/render/city-roles.ts'), 'utf8');
    expect(`${layer}\n${roles}`).not.toMatch(/0x2dd4a0|0x00ffcc/);
    expect(layer).not.toContain('.fill(');
  });

  it('hebt alte 30x30-Stadtsaves auf das echte Exterieur', () => {
    const old = { ...createCityScene(), layout: createWorld('SMALL').layout };
    const normalized = normalizeCityScene(old);
    expect(normalized.layout.size).toBe(60);
    expect(normalized.exterior.buildings).toHaveLength(4);
    expect(normalized.furniture).toEqual([]);
  });
});
