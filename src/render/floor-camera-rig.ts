/**
 * Kamera-Buehne: der Pixi-Container, die Zoom-/Schwenk-Wahrheit und die LOD-Stufe.
 * Haelt keinen Spielzustand; die Buehne haengt nur ihre Ebenen ein und folgt dem Ergebnis.
 */
import { Container, Rectangle } from 'pixi.js';
import { TILE, REGION } from '../core/sim/types';
import { FloorCamera, type WorldBounds } from './floor-camera';
import { screenToTile } from './floor-math';

interface CameraRigDeps {
  /** Bildschirmgroesse des Renderers; aendert sich beim Resize in place. */
  readonly screen: { readonly width: number; readonly height: number };
  readonly canvas: () => HTMLCanvasElement;
  /** Kantenlaenge des aktuellen Bodens in Tiles. */
  readonly size: () => number;
  /** Explizite Weltgrenzen; fehlen sie, bleibt die Welt quadratisch. */
  readonly bounds?: () => WorldBounds;
  /** LOD-Wechsel: Hinweise, Beschriftungen und Figurendetail folgen der Stufe. */
  readonly onDetail: (detail: boolean) => void;
  /** Nach dem Anwenden: Raster neu zielen, Pins skalieren, cullen. */
  readonly onApplied: (lod: number, scale: number) => void;
  /** Geraetepixelverhaeltnis fuer die harte Pixelkante; 1 ist der sichere Default. */
  readonly pixelRatio?: () => number;
}

export class FloorCameraRig {
  /** Welt-Container der Buehne; der Shake verschiebt ihn, nicht das Vollbild. */
  readonly root = new Container();
  /** Gesten und Tasten schreiben in dieselbe Kamera-Wahrheit. */
  readonly cam = new FloorCamera();
  readonly #deps: CameraRigDeps;
  #base = { x: 0, y: 0 };
  #lod = -1;
  #dirty = true;

  constructor(deps: CameraRigDeps) {
    this.#deps = deps;
    this.root.eventMode = 'static';
    this.root.interactive = true;
  }

  get lod(): number {
    return this.#lod;
  }

  /** Ein neuer Rahmen verlangt einen Durchlauf, auch ohne Zoom-Aenderung. */
  get dirty(): boolean {
    return this.#dirty;
  }

  fit(): void {
    this.cam.overview();
    this.updateLod();
    this.apply();
  }

  zoom(factor: number): void {
    this.cam.zoomStep(factor);
  }

  /** Zoomen auf den Bereich um die Spielerfigur, einmalig beim Start. */
  zoomToPlayer(x: number, y: number): void {
    // Race-Condition-Guard: Position 0,0 ist noch nicht gesetzt (erst im ersten EntitySync-Tick)
    // Aber LOD muss trotzdem initialisiert werden
    if (x === 0 && y === 0) {
      this.updateLod();
      return;
    }
    const bounds = this.#bounds();
    const screenW = this.#deps.screen.width;
    const screenH = this.#deps.screen.height;
    const worldPx = bounds.width * TILE;
    // Prüfen: passt die WELT in den Viewport? (mit 4% Rand wie bei fit)
    // Wenn die Welt kleiner als REGION ist (z.B. Wohnung 16x16), zoomt man auf die Welt
    const fits = worldPx <= screenW * 0.96 && worldPx <= screenH * 0.96;
    if (!fits) {
      // Zu gross für Viewport → Übersicht statt Nah-Zoom
      this.fit();
      return;
    }
    const areaX = Math.floor(x / REGION) * REGION;
    const areaY = Math.floor(y / REGION) * REGION;
    this.cam.zoomToArea({ id: 'player', index: -1, x: areaX, y: areaY, w: REGION, h: REGION }, bounds);
    // Target ist gesetzt — einmal step() laufen lassen, damit #zoom/#focus auf Target gehen
    this.cam.step();
    // Und sofort anwenden mit den neuen Werten
    this.cam.apply(this.root, screenW, screenH, bounds, this.#deps.pixelRatio?.() ?? 1);
    this.#base.x = this.root.position.x;
    this.#base.y = this.root.position.y;
    this.#dirty = false;
    // LOD nach Zoom anwenden
    this.updateLod();
    // Callback feuern damit FloorView #cameraApplied bekommt
    this.#deps.onApplied(this.#lod, this.root.scale.x);
  }

  /** Neue Vorlage oder Groesse: Uebersicht neu setzen, Trefferflaeche mitziehen. */
  resetForLayout(): void {
    const bounds = this.#bounds();
    this.cam.resize(this.#deps.screen.width, this.#deps.screen.height, bounds, true);
    this.root.hitArea = new Rectangle(0, 0, bounds.width * TILE, bounds.height * TILE);
    this.#dirty = true;
  }

  /** Bildschirm geaendert: neu einpassen und LOD samt Transform sofort anwenden. */
  resize(): void {
    this.cam.resize(this.#deps.screen.width, this.#deps.screen.height, this.#bounds());
    this.updateLod();
    this.apply();
  }

  updateLod(): void {
    const detail = this.cam.detail;
    const lod = detail ? 1 : 0;
    if (lod === this.#lod) return;
    this.#lod = lod;
    this.#dirty = true;
    this.#deps.onDetail(detail);
  }

  apply(): void {
    this.cam.apply(this.root, this.#deps.screen.width, this.#deps.screen.height, this.#bounds(), this.#deps.pixelRatio?.() ?? 1);
    this.#base.x = this.root.position.x;
    this.#base.y = this.root.position.y;
    this.#dirty = false;
    this.#deps.onApplied(this.#lod, this.root.scale.x);
  }

  /** Folgt der Figur, ohne jede Bewegung zur Kamerafahrt zu machen. */
  follow(x: number, y: number): void {
    this.cam.keepInView(x, y, this.#deps.screen.width, this.#deps.screen.height, this.#bounds());
    // Jede Kamera-Bewegung muss auch ankommen: Ohne diesen Apply blieb der
    // Zoom nach dem LOD-Wechsel auf dem alten Skalenwert stehen.
    if (this.cam.step()) this.apply();
  }

  /** Shake liegt auf dem Container, damit kein Compositing der ganzen App entsteht. */
  shake(offset: { readonly x: number; readonly y: number }): void {
    this.root.position.set(this.#base.x + offset.x, this.#base.y + offset.y);
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.#deps.canvas().getBoundingClientRect();
    const bounds = this.#bounds();
    return screenToTile(clientX, clientY, rect, this.#deps.screen.width, this.#deps.screen.height,
      this.root.x, this.root.y, this.root.scale.x, bounds.width, TILE, bounds.height);
  }

  #bounds(): WorldBounds {
    return this.#deps.bounds?.() ?? { width: this.#deps.size(), height: this.#deps.size() };
  }

  destroy(): void {
    this.root.destroy({ children: false });
  }
}
