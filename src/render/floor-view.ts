/** Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. */
import { TICK_MS } from '../core/sim/tick-timing';
import { Application, Container, Graphics, Rectangle } from 'pixi.js';
import { areaAt } from '../core/sim/grid-zones';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ActorPool } from './actor-pool';
import { EntitySync } from './entity-sync';
import { FloorCamera } from './floor-camera';
import { FloorCues } from './floor-cues';
import { createGuestArt, type GuestArt } from './guest-art';
import { primeGuestShadow } from './guest-parts';
import { screenToTile } from './floor-math';
import { FloorProps } from './floor-props';
import { FloorTouch } from './floor-touch';
import { FloorCallbacks, handleTap, screenPoint, type TapHit } from './floor-input';
import { animateFloor } from './floor-animate';
import { createSceneCache, type SceneCache } from './scene-cache';
import { WallOcclusion } from './wall-occlusion';
import { FloorFx } from './fx/floor-fx';
import { FloorEvents } from './floor-events';
import { EditorOverlay, type EditorCursor } from './editor-overlay';

const STEP_MS = TICK_MS;

export class FloorView {
  readonly #app: Application;
  readonly #callbacks: FloorCallbacks;
  readonly #camera = new Container();
  readonly #scene: SceneCache;
  readonly #actors: ActorPool;
  readonly #props: FloorProps;
  readonly #walls = new WallOcclusion();
  readonly #player: GuestArt;
  readonly #marker = new Graphics();
  readonly #cam = new FloorCamera();
  readonly #touch: FloorTouch;
  readonly #cues: FloorCues;
  readonly #fx: FloorFx; readonly #events: FloorEvents;
  readonly #camBase = { x: 0, y: 0 };
  readonly #entities: EntitySync;
  readonly #editor = new EditorOverlay();
  #flashId = -1;
  #view: GameView;
  #lod = -1;
  #placing = false;
  #camDirty = true;
  #destroyed = false;

  constructor(app: Application, view: GameView, callbacks: FloorCallbacks) {
    this.#app = app;
    this.#view = view;
    this.#callbacks = callbacks;
    // Ein Schatten fuer alle Figuren, bevor der erste Gast gebaut wird.
    primeGuestShadow(app.renderer);
    this.#scene = createSceneCache();
    this.#cues = new FloorCues(app.canvas, (clientX, clientY) => this.cellAt(clientX, clientY), app.renderer);
    // Partikel, Licht und Shake leben in Weltkoordinaten auf der Buehne.
    this.#fx = new FloorFx();
    this.#events = new FloorEvents(this.#fx, () => this.#view);
    this.#camera.addChild(this.#scene.room, this.#scene.carpet, this.#scene.dirt, this.#scene.routes,
      this.#scene.world, this.#scene.overhead, this.#cues.root, this.#scene.stickers, this.#fx.root, this.#editor.root);
    this.#camera.eventMode = 'static';
    this.#camera.interactive = true;
    app.stage.addChild(this.#camera);
    this.#touch = new FloorTouch(app, this.#camera, this.#cam, () => this.#view.size, (clientX, clientY) => {
      const local = screenPoint(clientX, clientY, this.#app, this.#camera);
      if (local) this.#act(0, local);
    });
    this.#events.start();
    this.#actors = new ActorPool(this.#attachActor);
    for (const art of this.#actors.all) this.#attachActor(art);
    this.#props = new FloorProps(
      { world: this.#scene.world, overhead: this.#scene.overhead, stickers: this.#scene.stickers, depth: this.#scene.depth },
      this.#camera,
      this.#attachActor,
    );
    this.#player = createGuestArt('STREET', 'DU', true, 0.4, view.look);
    this.#player.root.addChild(this.#marker);
    this.#marker.visible = false;
    this.#attachActor(this.#player);
    this.#entities = new EntitySync({
      renderer: app.renderer, scene: this.#scene, actors: this.#actors, player: this.#player,
      marker: this.#marker, props: this.#props, camera: this.#camera, screen: app.screen,
      stepMs: STEP_MS, lod: () => this.#lod, scale: () => this.#camera.scale.x,
    });
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
      if (view.template !== previous.template || view.size !== previous.size) this.#entities.resetFurniture();
      this.#cam.resize(this.#app.screen.width, this.#app.screen.height, view.size, true);
      this.#camera.hitArea = new Rectangle(0, 0, view.size * TILE, view.size * TILE);
      this.#camDirty = true;
    }
    this.#scene.redrawDirt(view);
    this.#entities.sync(view, performance.now());
    this.#walls.sync(this.#app.renderer, { size: view.size, layout: view.layout }, TILE, this.#scene.depth);
    this.#scene.depth.flush();
    this.#cues.setPath(view.player.path, view.player.pathIndex);
    this.#updateLod();
    if (this.#camDirty) this.#applyCamera(); else this.#entities.cull(view, this.#lod);
  }

  fit(): void { this.#cam.overview(); }
  zoom(factor: number): void { this.#cam.zoomStep(factor); }
  setBudget(particles: number, lights: number): void { this.#fx.setBudget(particles, lights); }

  /** Editor-Auswahl liegt ueber der Welt, ist aber nie selbst klickbar. */
  setEditorCursor(cursor: EditorCursor | null): void { this.#editor.set(cursor); }

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
    this.#props.destroy({ world: this.#scene.world, overhead: this.#scene.overhead, stickers: this.#scene.stickers, depth: this.#scene.depth });
    this.#walls.destroy();
    this.#touch.destroy();
    this.#cues.destroy();
    this.#events.stop();
    this.#fx.destroy();
    this.#editor.destroy();
    this.#actors.clear();
    this.#entities.clear();
    this.#scene.destroy();
    this.#camera.destroy({ children: false });
  }

  #attachActor = (art: GuestArt): void => {
    this.#scene.world.addChild(art.root);
    this.#scene.stickers.addChild(art.sticker);
  };

  #updateLod(): void {
    const detail = this.#cam.detail;
    const lod = detail ? 1 : 0;
    if (lod === this.#lod) return;
    this.#lod = lod;
    this.#cues.setMode(detail);
    this.#scene.setLabels(this.#view, detail);
    this.#entities.setDetail(detail);
    this.#camDirty = true;
  }

  #applyCamera(): void {
    this.#cam.apply(this.#camera, this.#app.screen.width, this.#app.screen.height, this.#view.size);
    this.#camBase.x = this.#camera.position.x;
    this.#camBase.y = this.#camera.position.y;
    this.#cues.refresh();
    this.#camDirty = false;
    this.#entities.setPinScale(this.#lod, this.#camera.scale.x);
    this.#entities.cull(this.#view, this.#lod);
  }

  #act(button: number, point: { x: number; y: number }): void {
    if (this.#destroyed) return;
    const hit: TapHit | null = handleTap(button, point, this.#view, this.#cues, this.#callbacks, this.#placing, this.#lod,
      (x, y) => this.zoomToArea(x, y));
    if (!hit) return;
    if (hit.kind === 'furniture') {
      this.#flashId = hit.id;
      this.#entities.furniture(hit.id)?.flash(performance.now());
    } else if (hit.kind === 'gesture') {
      const art = this.#actors.get(hit.id);
      art?.bump();
      art?.tapRing();
    }
  }

  #animate = (): void => {
    if (this.#destroyed) return;
    const now = performance.now();
    animateFloor(now, this.#app, this.#cam, this.#view, this.#camDirty, this.#actors, this.#player, this.#cues, this.#props);
    this.#fx.update(now);
    // Shake verschiebt die Kamera, nicht ein Vollbild-div: kein Compositing der ganzen App.
    const offset = this.#fx.offset(now);
    this.#camera.position.set(this.#camBase.x + offset.x, this.#camBase.y + offset.y);
    this.#entities.furniture(this.#flashId)?.animate(now);
  };
}
