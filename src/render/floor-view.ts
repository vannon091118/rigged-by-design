// @loc-exception: Kamera, LOD, Culling, gepoolte Figuren und Input teilen einen Pixi-Scene-Graph; getrennt waeren die Transform-Kopplungen unsichtbar.
/** Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. */
import { Application, Container, Graphics, Rectangle, type FederatedPointerEvent } from 'pixi.js';
import { dirtyNear, emotionOf } from '../core/sim/emotion';
import { areaAt } from '../core/sim/grid-zones';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ActorPool } from './actor-pool';
import { FloorCamera } from './floor-camera';
import { createFurnitureArt, type FurnitureArt } from './furniture-art';
import { createGuestArt, type GuestArt } from './guest-art';
import { isVisible, screenToTile, visibleRect } from './floor-math';
import { FloorProps } from './floor-props';
import { FloorTouch } from './floor-touch';
import { actorStateFor } from './rig-pose';
import { drawPlayerMarker } from './player-marker';
import { createSceneCache, type SceneCache } from './scene-cache';

const STEP_MS = 520;

interface FloorCallbacks {
  readonly onGuest: (id: number) => void;
  readonly onFurniture: (id: number) => void;
  readonly onEmpty: (x: number, y: number) => void;
}

export class FloorView {
  readonly #app: Application;
  readonly #callbacks: FloorCallbacks;
  readonly #camera = new Container();
  readonly #scene: SceneCache;
  readonly #actors: ActorPool;
  readonly #props: FloorProps;
  readonly #player: GuestArt;
  readonly #marker = new Graphics();
  readonly #furnitureArt = new Map<number, FurnitureArt>();
  readonly #seenFurniture = new Set<number>();
  readonly #seenGuests = new Set<number>();
  readonly #results = new Map<number, string>();
  readonly #cam = new FloorCamera();
  readonly #touch: FloorTouch;
  #view: GameView;
  #lod = -1;
  #placing = false;
  #camDirty = true;
  #playerPlaced = false;
  #destroyed = false;

  constructor(app: Application, view: GameView, callbacks: FloorCallbacks) {
    this.#app = app;
    this.#view = view;
    this.#callbacks = callbacks;
    this.#scene = createSceneCache();
    this.#camera.addChild(this.#scene.room, this.#scene.furniture, this.#scene.props, this.#scene.actors, this.#scene.stickers);
    this.#camera.eventMode = 'static';
    this.#camera.on('pointertap', this.#tap);
    app.stage.addChild(this.#camera);
    app.canvas.addEventListener('wheel', this.#wheel, { passive: false });
    this.#touch = new FloorTouch(app, this.#camera, this.#cam, () => this.#view.size);
    this.#actors = new ActorPool(this.#attachActor);
    for (const art of this.#actors.all) this.#attachActor(art);
    this.#props = new FloorProps(
      { props: this.#scene.props, actors: this.#scene.actors, stickers: this.#scene.stickers },
      this.#camera,
      this.#attachActor,
    );
    this.#player = createGuestArt('STREET', 'DU', true, 0.4, view.look);
    this.#player.root.addChild(this.#marker);
    this.#marker.visible = false;
    this.#attachActor(this.#player);
    app.ticker.add(this.#animate);
    this.update(view, true);
  }

  update(view: GameView, force = false): void {
    if (this.#destroyed) return;
    const previous = this.#view;
    const templateChanged = force || view.size !== previous.size || view.template !== previous.template || view.carpet !== previous.carpet;
    this.#view = view;
    this.#scene.redrawRoom(view);
    this.#scene.setLabels(view, this.#lod === 1);
    if (templateChanged) {
      if (view.template !== previous.template || view.size !== previous.size) {
        for (const art of this.#furnitureArt.values()) art.root.destroy({ children: true });
        this.#furnitureArt.clear();
      }
      this.#cam.resize(this.#app.screen.width, this.#app.screen.height, view.size, true);
      this.#camera.hitArea = new Rectangle(0, 0, view.size * TILE, view.size * TILE);
      this.#camDirty = true;
    }
    this.#scene.redrawDirt(view);
    this.#syncFurniture(view);
    this.#syncGuests(view);
    this.#syncPlayer(view);
    this.#updateLod();
    if (this.#camDirty) this.#applyCamera(); else this.#cull();
  }

  fit(): void { this.#cam.overview(); }

  zoomToArea(x: number, y: number): void {
    const area = areaAt(this.#view.template, x, y);
    if (area) this.#cam.zoomToArea(area, this.#view.size);
  }

  /** Spiel-Fenster offen: der Floor-Ticker ruht, die Simulation laeuft im Store weiter. */
  setRunning(running: boolean): void {
    if (!this.#destroyed) this.#app.ticker[running ? 'start' : 'stop']();
  }

  setPlacing(buildId: string | null): void {
    this.#placing = buildId !== null;
    this.#props.setGhost(buildId);
  }

  resize(): void {
    this.#cam.resize(this.#app.screen.width, this.#app.screen.height, this.#view.size);
    this.#updateLod();
    this.#applyCamera();
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.#app.canvas.getBoundingClientRect();
    return screenToTile(clientX, clientY, rect, this.#app.screen.width,
      this.#camera.x, this.#camera.y, this.#camera.scale.x, this.#view.size, TILE);
  }

  destroy(): void {
    this.#destroyed = true;
    this.#app.ticker.remove(this.#animate);
    this.#props.destroy({ props: this.#scene.props, actors: this.#scene.actors, stickers: this.#scene.stickers });
    this.#app.canvas.removeEventListener('wheel', this.#wheel);
    this.#touch.destroy();
    this.#actors.clear();
    this.#furnitureArt.clear();
    this.#scene.destroy();
    this.#camera.destroy({ children: false });
  }

  #attachActor = (art: GuestArt): void => {
    this.#scene.actors.addChild(art.root);
    this.#scene.stickers.addChild(art.sticker);
  };

  #syncFurniture(view: GameView): void {
    this.#seenFurniture.clear();
    this.#results.clear();
    for (const guest of view.guests) {
      if (guest.targetFurniture && guest.lastResult) this.#results.set(guest.targetFurniture, guest.lastResult);
    }
    for (const item of view.furniture) {
      this.#seenFurniture.add(item.id);
      let art = this.#furnitureArt.get(item.id);
      if (!art) {
        art = createFurnitureArt(item, TILE);
        this.#furnitureArt.set(item.id, art);
        this.#scene.furniture.addChild(art.root);
        if (this.#lod === 0) art.setDetail(false);
      }
      art.root.position.set(item.x * TILE, item.y * TILE);
      art.refresh(item);
      art.setResult(item.gameId ? this.#results.get(item.id) ?? 'BEREIT' : '');
    }
    for (const [id, art] of this.#furnitureArt) {
      if (this.#seenFurniture.has(id)) continue;
      art.root.destroy({ children: true });
      this.#furnitureArt.delete(id);
    }
  }

  #syncGuests(view: GameView): void {
    this.#seenGuests.clear();
    for (const guest of view.guests) {
      this.#seenGuests.add(guest.id);
      let art = this.#actors.get(guest.id);
      const now = performance.now();
      if (!art) {
        art = this.#actors.acquire(guest);
        art.target.x = (guest.position.x + 0.5) * TILE;
        art.target.y = (guest.position.y + 0.8) * TILE;
        art.from.x = art.target.x;
        art.from.y = art.target.y;
        art.moveStart = now - STEP_MS;
        art.root.position.set(art.target.x, art.target.y);
        art.root.scale.set(this.#lod === 0 ? 1 / Math.max(0.05, this.#camera.scale.x) : 1);
        art.sticker.position.set(art.target.x, art.target.y);
      }
      const queue = guest.state === 'EXCHANGE' || guest.state === 'CASHOUT' ? guest.queueIndex : 0;
      const bob = Math.sin(now / 280 + art.phase) * 0.3;
      this.#place(art, (guest.position.x + 0.5) * TILE + queue * 4, (guest.position.y + 0.8) * TILE - queue * 9, now, bob);
      art.root.alpha = guest.state === 'LEAVE' ? 0.45 : 0.72 + (guest.addiction / 100) * 0.28;
      art.setMood(guest.mood, guest.state === 'ANGRY' || guest.anger > 50, guest.addiction);
      art.setEmotion(emotionOf(guest, dirtyNear(view.dirtyTiles, view.size, guest.position.x, guest.position.y)));
      art.setState(actorStateFor({
        state: guest.state, pathLength: guest.path.length, pathIndex: guest.pathIndex,
        lastResult: guest.lastResult,
      }));
      art.setLod(this.#lod === 1);
    }
    for (const id of this.#actors.active.keys()) {
      if (!this.#seenGuests.has(id)) this.#actors.release(id);
    }
  }

  #syncPlayer(view: GameView): void {
    const px = (view.player.position.x + 0.5) * TILE;
    const py = (view.player.position.y + 0.8) * TILE;
    const now = performance.now();
    if (!this.#playerPlaced) {
      this.#playerPlaced = true;
      this.#player.target.x = px;
      this.#player.target.y = py;
      this.#player.from.x = px;
      this.#player.from.y = py;
      this.#player.moveStart = now - STEP_MS;
      this.#player.root.position.set(px, py);
      this.#player.sticker.position.set(px, py);
    } else {
      this.#place(this.#player, px, py, now, 0);
    }
    this.#player.setEmotion(view.player.carrying === 'DRINK' ? 'DRINK' : 'NONE');
    this.#player.setLook(view.look);
    const fx = view.fightFx && view.fightFx.untilTick >= view.tick ? view.fightFx : null;
    const fighting = fx !== null
      && Math.abs(fx.x - view.player.position.x) + Math.abs(fx.y - view.player.position.y) <= 2;
    this.#player.setState(actorStateFor({
      state: 'WAIT', pathLength: view.player.path.length, pathIndex: view.player.pathIndex,
      carrying: view.player.carrying, isPlayer: true,
      injured: view.player.rpg.injuryTicks > 0, fighting,
    }));
    drawPlayerMarker(this.#marker, { injured: view.player.rpg.injuryTicks > 0, fighting, won: view.fightFx?.won ?? false });
    this.#player.setLod(this.#lod === 1);
  }

  #place(art: GuestArt, x: number, y: number, now: number, bob: number): void {
    if (art.target.x === x && art.target.y === y) return;
    art.from.x = art.root.x;
    art.from.y = art.root.y - bob;
    art.target.x = x;
    art.target.y = y;
    art.moveStart = now;
  }

  #updateLod(): void {
    const detail = this.#cam.detail;
    const lod = detail ? 1 : 0;
    if (lod === this.#lod) return;
    this.#lod = lod;
    this.#scene.setLabels(this.#view, detail);
    for (const art of this.#furnitureArt.values()) art.setDetail(detail);
    for (const art of this.#actors.active.values()) art.setLod(detail);
    this.#player.setLod(detail);
    this.#camDirty = true;
  }

  #applyCamera(): void {
    this.#cam.apply(this.#camera, this.#app.screen.width, this.#app.screen.height, this.#view.size);
    this.#camDirty = false;
    const pinScale = this.#lod === 0 ? 1 / Math.max(0.05, this.#camera.scale.x) : 1;
    for (const art of this.#actors.active.values()) art.root.scale.set(pinScale);
    this.#player.root.scale.set(pinScale);
    this.#cull();
  }

  #cull(): void {
    if (this.#lod !== 1) {
      for (const art of this.#furnitureArt.values()) art.root.visible = true;
      for (const art of this.#actors.active.values()) {
        art.root.visible = true;
        art.sticker.visible = false;
      }
      this.#player.root.visible = true;
      this.#player.sticker.visible = false;
      return;
    }
    const rect = visibleRect(this.#camera.x, this.#camera.y, this.#camera.scale.x, this.#app.screen.width, this.#app.screen.height);
    for (const item of this.#view.furniture) {
      const art = this.#furnitureArt.get(item.id);
      if (!art) continue;
      art.root.visible = isVisible(item.x * TILE, item.y * TILE, item.w * TILE, item.h * TILE, rect, 0);
    }
    for (const art of this.#actors.active.values()) {
      const visible = isVisible(art.root.x, art.root.y, 0, 0, rect, 40);
      art.root.visible = visible;
      art.sticker.visible = visible;
    }
    const playerVisible = isVisible(this.#player.root.x, this.#player.root.y, 0, 0, rect, 40);
    this.#player.root.visible = playerVisible;
    this.#player.sticker.visible = playerVisible;
    this.#props.update(this.#view, rect, this.#lod);
  }

  #tap = (event: FederatedPointerEvent): void => {
    const point = event.getLocalPosition(this.#camera);
    const x = Math.floor(point.x / TILE);
    const y = Math.floor(point.y / TILE);
    if (x < 0 || y < 0 || x >= this.#view.size || y >= this.#view.size) return;
    const guest = this.#view.guests
      .map((entry) => ({ entry, distance: Math.abs(entry.position.x - x) + Math.abs(entry.position.y - y) }))
      .filter((entry) => entry.distance <= 1)
      .sort((a, b) => a.distance - b.distance)[0];
    if (guest) { this.#callbacks.onGuest(guest.entry.id); return; }
    const furniture = this.#view.furniture.find((item) =>
      x >= item.x && y >= item.y && x < item.x + item.w && y < item.y + item.h);
    if (furniture && this.#lod === 1) { this.#callbacks.onFurniture(furniture.id); return; }
    if (this.#lod === 0 && !this.#placing) { this.zoomToArea(x, y); return; }
    if (furniture) { this.#callbacks.onFurniture(furniture.id); return; }
    this.#callbacks.onEmpty(x, y);
  };

  #wheel = (event: WheelEvent): void => {
    event.preventDefault();
    const rect = this.#app.canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    const scaleFactor = rect.width / this.#app.screen.width;
    const localX = (event.clientX - rect.left) / scaleFactor;
    const localY = (event.clientY - rect.top) / scaleFactor;
    const worldX = (localX - this.#camera.x) / this.#camera.scale.x / (this.#view.size * TILE);
    const worldY = (localY - this.#camera.y) / this.#camera.scale.y / (this.#view.size * TILE);
    this.#cam.wheel(worldX, worldY, event.deltaY);
  };

  #animate = (): void => {
    if (this.#destroyed) return;
    const now = performance.now();
    const moving = this.#cam.step();
    if (moving || this.#camDirty) {
      this.#updateLod();
      this.#applyCamera();
    }
    for (const art of this.#actors.active.values()) {
      art.animate(now);
      this.#walk(art, now, Math.sin(now / 280 + art.phase) * 0.3);
    }
    this.#player.animate(now);
    this.#walk(this.#player, now, 0);
    this.#props.walk(now, STEP_MS);
  };

  #walk(art: GuestArt, now: number, bob: number): void {
    const t = Math.min(1, (now - art.moveStart) / STEP_MS);
    const walking = t < 1;
    const gait = walking ? Math.sin((now / 1000) * 12 + art.phase) : 0;
    art.root.x = art.from.x + (art.target.x - art.from.x) * t;
    art.root.y = art.from.y + (art.target.y - art.from.y) * t + bob + (walking ? Math.abs(gait) * 1.5 : 0);
    art.root.rotation = gait * 0.14;
    art.sticker.position.set(art.root.x, art.root.y);
  }
}
