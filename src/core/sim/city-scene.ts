/**
 * Stadt als begehbarer Floor. Die Stadtkarte bleibt eine Uebersicht; dieser
 * Plan ist die Projektion, auf der die Figur tatsaechlich steht.
 */
import { ZERO_VC } from '../economy/vacoin';
import { BLUEPRINTS } from './house-presets';
import { layoutFromTemplate, zonesFromLayout } from './layout-derive';
import type { LayoutState } from './layout-types';
import type { Furniture, Point, Zone } from './types-model';

export interface CitySceneState {
  readonly layout: LayoutState;
  readonly zones: Zone[];
  readonly furniture: Furniture[];
}

const CITY_LABELS: Readonly<Record<string, string>> = {
  ENTRANCE: 'STADT',
  GAMING: 'CASINO',
  BAR: 'MARKT',
  TOILET: 'HOF',
  STORAGE: 'LAGER',
  LOUNGE: 'PARK',
  EXCHANGE: 'KASSE',
  EXPANSION: 'BAUPLATZ',
};

const PORTALS: readonly { readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly label: string }[] = [
  { x: 4, y: 4, w: 7, h: 5, label: 'DEIN CASINO' },
  { x: 18, y: 5, w: 7, h: 4, label: 'MARKT' },
  { x: 5, y: 19, w: 6, h: 4, label: 'HOF' },
  { x: 19, y: 19, w: 6, h: 4, label: 'NACHBARSCHAFT' },
];

export function createCityScene(): CitySceneState {
  const layout = layoutFromTemplate('SMALL');
  const zones = zonesFromLayout(layout).map((zone) => ({
    ...zone,
    name: CITY_LABELS[zone.kind] ?? zone.name,
  })) as Zone[];
  const base = BLUEPRINTS.SMALL.furniture()[0];
  if (!base) return { layout, zones, furniture: [] };
  const furniture = PORTALS.map((portal, index) => ({
    ...base,
    id: 20_000 + index,
    kind: 'DECOR' as const,
    gameId: undefined,
    x: portal.x,
    y: portal.y,
    w: portal.w,
    h: portal.h,
    seats: 0,
    label: portal.label,
    price: ZERO_VC,
    condition: 100,
    damaged: false,
    dirt: 0,
    stock: 0,
    clog: 0,
    clogged: false,
    zoneId: layout.zones[index % layout.zones.length]?.id ?? 'entrance',
    occupants: [],
    mods: [],
    reels: 3,
    baseBet: ZERO_VC,
  }));
  return { layout, zones, furniture };
}

export const CITY_SPAWN: Point = { x: 2, y: 2 };
