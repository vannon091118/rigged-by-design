/**
 * @test-target: src/render/city/city-assets.ts
 * @error-code: ERR-4022
 *
 * R8: Jede Stadttextur hat Rolle, Welt, ganzzahlige displayScale und
 * Rechteangabe. Die zehn vorhandenen SVGs sind der reale Bestand; Strasse,
 * Gehweg und Kante sind Geometrie und keine erfundenen Bilddateien.
 *
 * Der zweite Block baut den echten `CityRenderPlan` in die Pixi-Schicht und
 * prueft Welt/Rolle als Knotenlabel sowie die gemeinsame Skalierung von
 * Fassade und Gebaeudeschatten.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import catalog from '../../assets/asset-semantics.json';
import manifest from '../../assets/manifest.json';
import { ASSET, RUNTIME_ART } from '../../assets/keys';
import { TILE } from '../../../core/sim/types';
import { createCityExteriorModel } from '../../../core/sim/city-exterior';
import { WORLD_FLATTEN } from '../../art-tokens';
import { cityRenderPlan } from '../../city-exterior-layer';
import {
  CITY_ASSETS,
  CITY_ASSET_LIST,
  CITY_LICENSE,
  CITY_ROLES,
  CITY_WORLD,
  cityAssetForAsset,
  cityAssetIssues,
  cityDisplayScale,
  cityRenderLabel,
  validateCityAssets,
  type CityAssetDefinition,
} from '../city-assets';

vi.mock('../../assets/textures', () => ({ textureFor: vi.fn() }));
vi.mock('../city-assets', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../city-assets')>();
  return { ...actual, cityDisplayScale: vi.fn((asset: string) => actual.cityDisplayScale(asset)) };
});
vi.mock('pixi.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('pixi.js')>();
  return {
    ...actual,
    Text: class extends actual.Container {
      anchor = { set: (): void => undefined };
      constructor(_options?: unknown) { super(); }
    },
  };
});

const ASSET_ROOT = join(process.cwd(), 'public/assets/casino');
const environment = manifest.environment as Readonly<Record<string, string>>;

function invalid(patch: Readonly<Record<string, unknown>>): string[] {
  const base = CITY_ASSET_LIST[0];
  if (!base) throw new Error('Stadtpaket ist leer');
  return cityAssetIssues({ ...base, ...patch } as CityAssetDefinition);
}

beforeEach(() => {
  vi.mocked(cityDisplayScale).mockReset();
  vi.mocked(cityDisplayScale).mockImplementation((asset) => {
    const entry = CITY_ASSET_LIST.find((candidate) => candidate.asset === asset);
    if (!entry) throw new Error(`[city] Keine Asset-Metadaten fuer ${asset}`);
    return entry.displayScale;
  });
});

describe('Stadt-Assetpaket und Weltmetadaten', () => {
  it('fuehrt genau die zehn vorhandenen Stadttexturen mit stabilen IDs', () => {
    expect(CITY_ASSET_LIST).toHaveLength(10);
    expect(Object.keys(CITY_ASSETS)).toHaveLength(10);
    expect(new Set(CITY_ASSET_LIST.map((entry) => entry.id)).size).toBe(10);
    expect(new Set(CITY_ASSET_LIST.map((entry) => entry.asset)).size).toBe(10);
    expect(new Set(CITY_ASSET_LIST.map((entry) => entry.asset))).toEqual(new Set(Object.values(ASSET.city)));
  });

  it('gibt jeder Stadttextur Rolle, Welt, ganzzahlige Skala und Rechte', () => {
    for (const asset of CITY_ASSET_LIST) {
      expect(asset.id.trim(), asset.asset).not.toBe('');
      expect(CITY_ROLES, asset.id).toContain(asset.role);
      expect(asset.world, asset.id).toBe(CITY_WORLD);
      expect(Number.isInteger(asset.displayScale), asset.id).toBe(true);
      expect(asset.displayScale, asset.id).toBeGreaterThanOrEqual(1);
      expect(asset.license, asset.id).toBe(CITY_LICENSE);
    }
    expect(new Set(CITY_ASSET_LIST.map((entry) => entry.role))).toEqual(new Set(CITY_ROLES));
    expect(validateCityAssets(CITY_ASSET_LIST)).toEqual([]);
  });

  it('prueft Manifest, Datei und Laufzeitliste fuer jede Stadttextur', () => {
    for (const asset of CITY_ASSET_LIST) {
      expect(environment[asset.asset], `Manifest ${asset.asset}`).toBe(asset.asset);
      expect(existsSync(join(ASSET_ROOT, asset.asset)), `Datei ${asset.asset}`).toBe(true);
      expect(RUNTIME_ART, `Vorlade ${asset.asset}`).toContain(asset.asset);
      expect(cityAssetForAsset(asset.asset), asset.asset).toEqual(asset);
      expect(cityDisplayScale(asset.asset), asset.asset).toBe(asset.displayScale);
      expect(cityRenderLabel(asset.asset), asset.asset).toBe(`${asset.world}:${asset.role}:${asset.id}`);
    }
    // Keine zusaetzlichen Stadt-Requests: der Bestand bleibt bei zehn.
    expect(RUNTIME_ART.filter((ref) => ref.startsWith('environment/floor/city/'))).toHaveLength(10);
  });

  it('lehnt falsche displayScale, fehlende Rolle, fremde Welt und fehlende Rechte ab', () => {
    expect(invalid({ displayScale: 1.5 })).not.toEqual([]);
    expect(invalid({ displayScale: 0 })).not.toEqual([]);
    expect(invalid({ displayScale: -1 })).not.toEqual([]);
    expect(invalid({ role: '' })).not.toEqual([]);
    expect(invalid({ world: 'casino' })).not.toEqual([]);
    expect(invalid({ license: '' })).not.toEqual([]);
    expect(() => cityDisplayScale('environment/floor/city/unknown.svg')).toThrow(/Keine Asset-Metadaten/);
  });

  it('erkennt doppelte IDs und doppelte Texturpfade', () => {
    const first = CITY_ASSET_LIST[0];
    const second = CITY_ASSET_LIST[1];
    if (!first || !second) throw new Error('Stadtpaket ist unvollstaendig');
    expect(validateCityAssets([first, { ...second, id: first.id }])).toContain(`${first.id}: doppelte ID`);
    expect(validateCityAssets([first, { ...second, asset: first.asset }])).toContain(`${second.id}: doppelte Textur ${first.asset}`);
  });

  it('haelt den gesamten Semantik-Katalog auf demselben Pflichtfeldsatz', () => {
    const entries = Object.entries(catalog.assets);
    expect(entries).toHaveLength(539);
    const worlds = new Set(catalog.enums.world);
    const licenses = new Set(catalog.enums.license);
    for (const [ref, entry] of entries) {
      expect(worlds.has(entry.world), ref).toBe(true);
      expect(Number.isInteger(entry.displayScale), ref).toBe(true);
      expect(entry.displayScale, ref).toBeGreaterThanOrEqual(1);
      expect(licenses.has(entry.license), ref).toBe(true);
    }
  });
});

describe('Stadt-Frame: Welt, Rolle, Skalierung und Schatten', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('traegt Welt und Rolle jedes Stadtknotens in den Pixi-Baum', async () => {
    const { Texture } = await import('pixi.js');
    const { CityExteriorLayer } = await import('../../city-exterior-layer');
    const { DepthStage } = await import('../../depth');
    const { textureFor } = await import('../../assets/textures');
    vi.mocked(textureFor).mockReturnValue(Texture.WHITE);
    vi.mocked(cityDisplayScale).mockImplementation(() => 1);
    const plan = cityRenderPlan(createCityExteriorModel());
    if (!plan) throw new Error('Stadtplan fehlt');

    const layer = new CityExteriorLayer(new DepthStage());
    layer.update(plan);

    const labels = layer.root.children.map((node) => node.label);
    expect(labels).toHaveLength(plan.doors.length + plan.buildings.length + plan.props.length);
    for (const label of labels) {
      expect(label).toMatch(/^city:(FACADE|DOOR|LAMP|BENCH|TRASH|SIGN|TREE):[a-z-]+$/);
    }
    for (const building of plan.buildings) expect(labels).toContain(cityRenderLabel(building.asset));
    for (const prop of plan.props) expect(labels).toContain(cityRenderLabel(prop.asset));
    for (const door of plan.doors) expect(labels).toContain(cityRenderLabel(door.asset));

    layer.destroy();
  });

  it('skaliert Fassade und Gebaeudeschatten mit derselben displayScale', async () => {
    const { Texture, Sprite } = await import('pixi.js');
    const { CityExteriorLayer } = await import('../../city-exterior-layer');
    const { DepthStage } = await import('../../depth');
    const { textureFor } = await import('../../assets/textures');
    vi.mocked(textureFor).mockReturnValue(Texture.WHITE);
    const plan = cityRenderPlan(createCityExteriorModel());
    const building = plan?.buildings[0];
    if (!building) throw new Error('Stadtplan ohne Gebaeude');
    vi.mocked(cityDisplayScale).mockImplementation((asset) => (asset === building.asset ? 2 : 1));

    const layer = new CityExteriorLayer(new DepthStage());
    layer.update(plan);

    const node = layer.root.children.find((child) => child.label === cityRenderLabel(building.asset));
    if (!node) throw new Error('Fassadenknoten fehlt');
    const shadow = node.children[0] as InstanceType<typeof Sprite>;
    const sprite = node.children[1] as InstanceType<typeof Sprite>;
    expect(sprite).toBeInstanceOf(Sprite);
    expect(shadow).toBeInstanceOf(Sprite);
    expect(shadow.tint).toBe(0x000000);

    const baseWidth = building.footprint.w * TILE;
    const baseHeight = building.footprint.h * TILE;
    expect(sprite.width).toBeCloseTo(baseWidth * 0.98 * 2, 5);
    expect(sprite.height).toBeCloseTo(baseHeight * WORLD_FLATTEN * 2, 5);
    expect(shadow.width).toBeCloseTo(baseWidth * 0.92 * 2, 5);
    expect(shadow.height).toBeCloseTo(Math.max(4, baseHeight * 0.22 * 2), 5);

    layer.destroy();
  });
});
