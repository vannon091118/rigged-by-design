/** Pixi-Floor: gecachter Raum, zwei LOD-Stufen, weiche Kamera, gepoolte Akteure. Liest nur Snapshots. */
import { TICK_MS } from '../core/sim/tick-timing';
import { Application, Graphics } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ActorPool } from './actor-pool';
import { EntitySync } from './entity-sync';
import { FloorCameraRig } from './floor-camera-rig';
import { FloorCues } from './floor-cues';
import { createGuestArt, type GuestArt } from './guest-art';
import { primeGuestShadow } from './guest-parts';
import { FloorProps } from './floor-props';
import { FloorTouch } from './floor-touch';
import {
  acceptTap, handleTap, screenAnchorOf, screenPoint, tapKey,
  type FloorCallbacks, type ScreenAnchor, type TapMark,
} from './floor-input';
import { animateFloor } from './floor-animate';
import { createSceneCache, type SceneCache } from './scene-cache';
import { WallOcclusion } from './wall-occlusion';
import { LightPool } from './light-pool';
import { StageBackdrop } from './stage-backdrop';
import { FloorFx } from './fx/floor-fx';
import { FloorEvents } from './floor-events';
import { EditorOverlay, type EditorCursor } from './editor-overlay';
import { CityExteriorLayer, cityRenderPlan } from './city-exterior-layer';
import { worldBoundsOf } from './world-bounds';

export class FloorView {
  readonly #app: Application;
  /** Flaechenfuellung und Parallaxe hinter dem Plan. */
  readonly #backdrop = new StageBackdrop();
  readonly #callbacks: FloorCallbacks;
  readonly #rig: FloorCameraRig;
  readonly #scene: SceneCache;
  readonly #city: CityExteriorLayer;
  readonly #lights = new LightPool();
  readonly #actors: ActorPool;
  readonly #props: FloorProps;
  readonly #walls = new WallOcclusion();
  readonly #player: GuestArt;
  readonly #marker = new Graphics();
  readonly #touch: FloorTouch;
  readonly #cues: FloorCues;
  readonly #fx: FloorFx; readonly #events: FloorEvents;
  readonly #entities: EntitySync;
  readonly #editor = new EditorOverlay();
  #flashId = -1;
  #lastTap: TapMark | null = null;
  #view: GameView;
  #destroyed = false;

  constructor(app: Application, view: GameView, callbacks: FloorCallbacks) {
    this.#app = app;
    this.#view = view;
    this.#callbacks = callbacks;
    // Ein Schatten fuer alle Figuren, bevor der erste Gast gebaut wird.
    primeGuestShadow(app.renderer);
    this.#scene = createSceneCache();
    this.#city = new CityExteriorLayer(this.#scene.depth);
    this.#scene.world.addChild(this.#city.root);
    // Kamera-Buehne zuerst: Hinweise, Figuren und Effekte haengen an ihr.
    this.#rig = new FloorCameraRig({
      screen: app.screen,
      canvas: () => app.canvas,
      size: () => this.#view.size,
      bounds: () => worldBoundsOf(this.#view),
      onDetail: (detail) => this.#detailChanged(detail),
      onApplied: (lod, scale) => this.#cameraApplied(lod, scale),
    });
    this.#cues = new FloorCues(app.canvas, (clientX, clientY) => this.cellAt(clientX, clientY), app.renderer);
    // Partikel, Licht und Shake leben in Weltkoordinaten auf der Buehne.
    this.#fx = new FloorFx();
    this.#events = new FloorEvents(this.#fx, () => this.#view);
    this.#rig.root.addChild(this.#scene.room, this.#lights.root, this.#scene.dirt, this.#scene.routes,
      this.#scene.world, this.#scene.overhead, this.#cues.root, this.#scene.stickers, this.#fx.root, this.#editor.root);
    // Kein zweiter Eingabepfad: Maus und Finger laufen ueber FloorTouch und
    // landen genau einmal in #act. Vorher feuerte ein Linksklick zweimal
    // (pointerdown + Tap), also zwei Aktionskarten und zwei Popups.
    // Der Hintergrund liegt unter der Kamera und waechst mit dem Bildschirm;
    // damit ist die Flaeche neben einem quadratischen Plan nie leer.
    this.#backdrop.resize(app.screen);
    app.stage.addChild(this.#backdrop.root, this.#rig.root);
    this.#touch = new FloorTouch(app, this.#rig.root, this.#rig.cam, () => this.#view.size, (clientX, clientY) => {
      const local = screenPoint(clientX, clientY, this.#app, this.#rig.root);
      if (local) this.#act(0, local);
    });
    this.#events.start();
    this.#actors = new ActorPool(this.#attachActor);
    for (const art of this.#actors.all) this.#attachActor(art);
    this.#props = new FloorProps(
      { world: this.#scene.world, overhead: this.#scene.overhead, stickers: this.#scene.stickers, depth: this.#scene.depth },
      this.#rig.root,
      this.#attachActor,
    );
    this.#player = createGuestArt('STREET', 'DU', true, 0.4, view.look);
    this.#player.root.addChild(this.#marker);
    this.#marker.visible = false;
    this.#attachActor(this.#player);
    this.#entities = new EntitySync({
      renderer: app.renderer, scene: this.#scene, actors: this.#actors, player: this.#player,
      marker: this.#marker, props: this.#props, camera: this.#rig.root, screen: app.screen,
      stepMs: TICK_MS, lod: () => this.#rig.lod, scale: () => this.#rig.root.scale.x,
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
    this.#city.update(cityRenderPlan(view.cityExterior));
    this.#lights.update(view);
    this.#scene.setLabels(view, this.#rig.lod === 1);
    if (templateChanged) {
      if (view.template !== previous.template || view.size !== previous.size) this.#entities.resetFurniture();
      this.#rig.resetForLayout();
    }
    this.#scene.redrawDirt(view);
    this.#entities.sync(view, performance.now());
    this.#walls.sync(this.#app.renderer, { size: view.size, layout: view.layout }, TILE, this.#scene.depth);
    this.#scene.depth.flush();
    this.#cues.setPath(view.player.path, view.player.pathIndex);
    this.#rig.updateLod();
    if (this.#rig.dirty) this.#rig.apply(); else this.#entities.cull(view, this.#rig.lod);
  }

  fit(): void { this.#rig.fit(); }
  zoom(factor: number): void { this.#rig.zoom(factor); }
  setBudget(particles: number, lights: number): void { this.#fx.setBudget(particles, lights); }

  /** Editor-Auswahl liegt ueber der Welt, ist aber nie selbst klickbar. */
  setEditorCursor(cursor: EditorCursor | null): void { this.#editor.set(cursor); }

  /** Spiel-Fenster offen: der Floor-Ticker ruht, die Simulation laeuft im Store weiter. */
  setRunning(running: boolean): void {
    if (!this.#destroyed) this.#app.ticker[running ? 'start' : 'stop']();
  }

  setPlacing(buildId: string | null): void {
    this.#props.setGhost(buildId);
  }

  resize(): void {
    this.#backdrop.resize(this.#app.screen);
    this.#rig.resize();
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    return this.#rig.cellAt(clientX, clientY);
  }

  /**
   * Weltpunkt erneut in den Viewport rechnen. Die UI ruft das pro Frame auf,
   * damit Aktionskarte und Objektpanel bei Kamera- und Zoomfahrten am Ziel
   * bleiben. Es ist dieselbe Projektion wie beim Treffer, keine zweite Kamera.
   */
  project(worldX: number, worldY: number): ScreenAnchor | null {
    return screenAnchorOf({ x: worldX, y: worldY }, this.#app, this.#rig.root);
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
    this.#city.destroy();
    this.#scene.destroy();
    this.#lights.destroy();
    this.#rig.destroy();
    this.#backdrop.destroy();
  }

  #attachActor = (art: GuestArt): void => {
    this.#scene.world.addChild(art.root);
    this.#scene.stickers.addChild(art.sticker);
  };

  /** LOD-Wechsel: Hinweise, Beschriftungen und Figurendetail folgen der Stufe. */
  #detailChanged(detail: boolean): void {
    this.#cues.setMode(detail);
    this.#scene.setLabels(this.#view, detail);
    this.#entities.setDetail(detail);
  }

  /** Nach dem Anwenden: Raster neu zielen, Pins skalieren, cullen. */
  #cameraApplied(lod: number, scale: number): void {
    this.#backdrop.follow(this.#rig.root.x, this.#rig.root.y);
    this.#cues.refresh();
    this.#entities.setPinScale(lod, scale);
    this.#entities.cull(this.#view, lod);
  }

  #act(button: number, point: { x: number; y: number }): void {
    if (this.#destroyed) return;
    const resolution = handleTap(button, point, this.#view, this.#cues);
    if (!resolution) return;
    const now = performance.now();
    const key = tapKey(resolution.target);
    // Ein Doppelklick ist derselbe Auftrag, kein zweiter Lauf und keine zweite Karte.
    if (!acceptTap(this.#lastTap, key, now)) return;
    this.#lastTap = { key, at: now };
    // Der Fussanker des Objekts landet als Bildschirmpunkt an der Karte.
    const anchor = screenAnchorOf(resolution.at, this.#app, this.#rig.root);
    this.#callbacks.onTap({ ...resolution, anchor });
    if (resolution.target.kind === 'furniture') {
      this.#flashId = resolution.target.id;
      this.#entities.furniture(resolution.target.id)?.flash(now);
    } else if (resolution.target.kind === 'guest') {
      const art = this.#actors.get(resolution.target.id);
      art?.bump();
      art?.tapRing();
    }
  }

  #animate = (): void => {
    if (this.#destroyed) return;
    const now = performance.now();
    animateFloor(now, this.#rig, this.#actors, this.#player, this.#cues, this.#props);
    this.#city.animate(now, this.#view.dayPhase);
    this.#fx.update(now);
    // Shake verschiebt die Kamera, nicht ein Vollbild-div: kein Compositing der ganzen App.
    this.#rig.shake(this.#fx.offset(now));
    this.#entities.furniture(this.#flashId)?.animate(now);
  };
}
