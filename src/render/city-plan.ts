/** Reiner Renderplan der Stadt: Rollen, Assets und echte Layoutkanten. */
import type { BuildingFootprint } from '../core/sim/building-types';
import type { CityExteriorModel } from '../core/sim/city-exterior';
import type { EdgeAxis } from '../core/sim/layout-types';
import { cityBuildingArt, cityDoorArt, cityPropArt, type CitySurfaceRole } from './city-roles';
import type { WorldBounds } from './floor-camera';

interface CityBuildingView {
  readonly id: string;
  readonly name: string;
  readonly role: CitySurfaceRole;
  readonly asset: string;
  readonly footprint: BuildingFootprint;
  readonly entrance: { readonly x: number; readonly y: number };
}

interface CityPropView {
  readonly id: string;
  readonly role: CitySurfaceRole;
  readonly asset: string;
  readonly x: number;
  readonly y: number;
}

interface CityDoorView {
  readonly id: string;
  readonly role: CitySurfaceRole;
  readonly asset: string;
  readonly axis: EdgeAxis;
  readonly x: number;
  readonly y: number;
}

export interface CityRenderPlan {
  readonly layoutId: string;
  readonly name: string;
  readonly bounds: WorldBounds;
  readonly buildings: readonly CityBuildingView[];
  readonly props: readonly CityPropView[];
  readonly doors: readonly CityDoorView[];
}

/** Nur bekannte preset-Gebaeude werden gezeichnet; unbekannte Typen werfen. */
export function cityRenderPlan(exterior: CityExteriorModel | null | undefined): CityRenderPlan | null {
  if (!exterior) return null;
  const buildings = exterior.buildings.map((building): CityBuildingView => {
    const art = cityBuildingArt(building.kind);
    return {
      id: building.id,
      name: building.name,
      role: art.role,
      asset: art.asset,
      footprint: building.footprint,
      entrance: building.entrance,
    };
  });
  const props = exterior.props.map((prop): CityPropView => {
    const art = cityPropArt(prop.kind);
    return { id: prop.id, role: art.role, asset: art.asset, x: prop.position.x, y: prop.position.y };
  });
  const doors = exterior.layout.edges
    .filter((edge) => edge.kind === 'DOOR')
    .map((edge): CityDoorView => {
      if (edge.id === null) throw new Error('[city] Tuerkante ohne stabile ID');
      const art = cityDoorArt();
      return { id: edge.id, role: art.role, asset: art.asset, axis: edge.axis, x: edge.x, y: edge.y };
    });
  return {
    layoutId: exterior.layoutId,
    name: exterior.name,
    bounds: { width: exterior.layout.size, height: exterior.layout.size },
    buildings,
    props,
    doors,
  };
}
