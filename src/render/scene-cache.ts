/** Vier Render-Layer. Boden und Dreck liegen in 30×30-Regions-Chunks; nur veränderte backen neu. */
import { Container, Graphics, Text } from 'pixi.js';
import { areasFor, type Area } from '../core/sim/grid-zones';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { floorText } from './art-tokens';
import { changedRegions, regionHash } from './floor-math';
import { drawRoutes } from './floor-route';
import { drawRegionDirt, drawRegionFloor } from './room-art';

const LABEL_COUNT = 10;

export interface SceneCache {
  readonly room: Container;
  readonly furniture: Container;
  readonly props: Container;
  readonly actors: Container;
  readonly stickers: Container;
  readonly labels: readonly Text[];
  readonly redrawRoom: (view: GameView) => void;
  readonly redrawDirt: (view: GameView) => void;
  readonly setLabels: (view: GameView, detail: boolean) => void;
  readonly destroy: () => void;
}

export function createSceneCache(): SceneCache {
  const room = new Container();
  const furniture = new Container();
  const props = new Container();
  const dirtLayer = new Container();
  furniture.addChild(dirtLayer);
  const actors = new Container();
  const stickers = new Container();

  const labels: Text[] = [];
  for (let index = 0; index < LABEL_COUNT; index += 1) {
    const label = new Text({ text: '', style: floorText.zone() });
    label.visible = false;
    labels.push(label);
    furniture.addChild(label);
  }

  const floorChunks = new Map<string, { area: Area; g: Graphics; hash: number; baked: boolean }>();
  const dirtChunks = new Map<string, { g: Graphics; hash: number }>();
  // Laufwege liegen ueber den Raum-Chunks, aber unter Dreck und Moebeln.
  const routes = new Graphics();
  routes.eventMode = 'none';
  furniture.addChildAt(routes, 0);
  let routesKey = '';
  let routesBaked = false;

  const redrawRoom = (view: GameView): void => {
    const areas = areasFor(view.template);
    const key = `${view.template}|${view.carpet}|${view.zones.length}`;
    if (key !== routesKey) {
      routesKey = key;
      routes.clear();
      drawRoutes(routes, view, TILE);
      if (routesBaked) routes.updateCacheTexture();
      else { routes.cacheAsTexture(true); routesBaked = true; }
    }
    const prev = new Map<string, number>();
    for (const chunk of floorChunks.values()) prev.set(chunk.area.id, chunk.hash);
    const changed = new Set(changedRegions(view, areas, prev));
    for (const area of areas) {
      let chunk = floorChunks.get(area.id);
      if (!chunk) {
        const g = new Graphics();
        room.addChild(g);
        chunk = { area, g, hash: 0, baked: false };
        floorChunks.set(area.id, chunk);
      }
      if (!changed.has(area.id) && chunk.baked && chunk.area.w === area.w) continue;
      chunk.g.clear();
      drawRegionFloor(chunk.g, view, area, TILE);
      if (!chunk.baked) {
        chunk.g.cacheAsTexture(true);
        chunk.baked = true;
      } else {
        chunk.g.updateCacheTexture();
      }
      chunk.hash = regionHash(view, area);
    }
    for (const [id, chunk] of floorChunks) {
      if (areas.some((area) => area.id === id)) continue;
      if (chunk.baked) chunk.g.cacheAsTexture(false);
      chunk.g.destroy();
      floorChunks.delete(id);
    }
  };

  const dirtHashFor = (view: GameView, area: Area): number => {
    let hash = 0;
    for (const index of view.dirtyTiles) {
      const x = index % view.size;
      const y = Math.floor(index / view.size);
      if (x < area.x || y < area.y || x >= area.x + area.w || y >= area.y + area.h) continue;
      hash = (Math.imul(hash, 31) + index) | 0;
    }
    return hash;
  };

  const redrawDirt = (view: GameView): void => {
    const areas = areasFor(view.template);
    for (const area of areas) {
      const hash = dirtHashFor(view, area);
      let chunk = dirtChunks.get(area.id);
      if (!chunk) {
        const g = new Graphics();
        dirtLayer.addChild(g);
        chunk = { g, hash: 0 };
        dirtChunks.set(area.id, chunk);
      }
      if (chunk.hash === hash) continue;
      chunk.g.clear();
      drawRegionDirt(chunk.g, view, area, TILE);
      chunk.hash = hash;
    }
    for (const [id, chunk] of dirtChunks) {
      if (areas.some((area) => area.id === id)) continue;
      chunk.g.destroy();
      dirtChunks.delete(id);
    }
  };

  const setLabels = (view: GameView, detail: boolean): void => {
    view.zones.forEach((zone, index) => {
      const label = labels[index];
      if (!label) return;
      label.text = zone.name.toUpperCase();
      label.position.set(zone.x * TILE + 12, zone.y * TILE + 10);
      label.visible = detail;
    });
    for (let index = view.zones.length; index < labels.length; index += 1) labels[index]!.visible = false;
  };

  const destroy = (): void => {
    for (const chunk of floorChunks.values()) {
      if (chunk.baked) chunk.g.cacheAsTexture(false);
      chunk.g.destroy();
    }
    floorChunks.clear();
    for (const chunk of dirtChunks.values()) chunk.g.destroy();
    dirtChunks.clear();
    room.destroy({ children: true });
    furniture.destroy({ children: true });
    props.destroy({ children: true });
    actors.destroy({ children: true });
    stickers.destroy({ children: true });
  };

  return { room, furniture, props, actors, stickers, labels, redrawRoom, redrawDirt, setLabels, destroy };
}
