/**
 * Snapshot in die vorhandenen Darstellungs-Layer schieben.
 *
 * Die Buehne bleibt der Ort, an dem Layer haengen; dieses Modul kennt nur die
 * Reihenfolge, in der ein Snapshot sie versorgt. Keine eigene Wahrheit, kein
 * zweiter Ticker: jede Funktion liest `GameView` und schreibt Pixi.
 *
 * Die Reihenfolge ist Vertrag: Raum vor Stadt, Stadt vor Ambient, Ambient vor
 * Licht, Licht vor Labels. Wer sie aendert, aendert das Bild.
 */
import type { Renderer } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import type { AmbientLayer } from './ambient-layer';
import { ambientPlanForView } from './ambient-plan';
import { cityRenderPlan, type CityExteriorLayer } from './city-exterior-layer';
import type { EntitySync } from './entity-sync';
import type { CityActorSync } from './city-actor-sync';
import type { FloorCameraRig } from './floor-camera-rig';
import type { FloorCues } from './floor-cues';
import type { LightPool } from './light-pool';
import type { SceneCache } from './scene-cache';
import type { WallOcclusion } from './wall-occlusion';
import { worldBoundsOf } from './world-bounds';

export interface ViewLayers {
  readonly scene: SceneCache;
  readonly city: CityExteriorLayer;
  readonly ambient: AmbientLayer;
  readonly lights: LightPool;
  readonly walls: WallOcclusion;
  readonly cues: FloorCues;
  readonly entities: EntitySync;
  readonly cityActors: CityActorSync;
  readonly rig: FloorCameraRig;
  readonly renderer: Renderer;
}

/**
 * Ein Snapshot, ein Durchlauf; am Ende entweder Kamera oder Culling, nie beides.
 * `now` kommt von der einen erlaubten Pacing-Stelle (`floor-view`), damit diese
 * Datei keine eigene Uhr liest.
 */
export function syncViewLayers(
  layers: ViewLayers,
  view: GameView,
  previous: GameView,
  templateChanged: boolean,
  now: number,
): void {
  layers.scene.redrawRoom(view);
  layers.city.update(cityRenderPlan(view.cityExterior));
  layers.city.setAmbient(ambientPlanForView(view));
  layers.ambient.update(view, worldBoundsOf(view));
  layers.lights.update(view);
  layers.scene.setLabels(view, layers.rig.lod === 1);
  if (templateChanged) {
    if (view.template !== previous.template || view.size !== previous.size) layers.entities.resetFurniture();
    layers.rig.resetForLayout();
  }
  layers.scene.redrawDirt(view);
  layers.entities.sync(view, now);
  // Bewohner sind Strassenfiguren; der Layer liest dieselbe Simulation.
  layers.cityActors.sync(view, now, layers.rig.lod);
  layers.walls.sync(layers.renderer, { size: view.size, layout: view.layout }, TILE, layers.scene.depth);
  layers.scene.depth.flush();
  layers.cues.setPath(view.player.path, view.player.pathIndex);
  layers.rig.updateLod();
  if (layers.rig.dirty) layers.rig.apply(); else layers.entities.cull(view, layers.rig.lod);
}
