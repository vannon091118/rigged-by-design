/**
 * Kamera-Buehne: der Pixi-Container, die Zoom-/Schwenk-Wahrheit und die LOD-Stufe.
 * Haelt keinen Spielzustand; die Buehne haengt nur ihre Ebenen ein und folgt dem Ergebnis.
 */
import { Container, Rectangle } from 'pixi.js';
import { TILE } from '../core/sim/types';
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
  }

  zoom(factor: number): void {
    this.cam.zoomStep(factor);
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
    this.cam.apply(this.root, this.#deps.screen.width, this.#deps.screen.height, this.#bounds());
    this.#base.x = this.root.position.x;
    this.#base.y = this.root.position.y;
    this.#dirty = false;
    this.#deps.onApplied(this.#lod, this.root.scale.x);
  }

  /** Folgt der Figur, ohne jede Bewegung zur Kamerafahrt zu machen. */
  follow(x: number, y: number): void {
    this.cam.keepInView(x, y, this.#deps.screen.width, this.#deps.screen.height, this.#bounds());
    this.cam.step();
  }

  /** Shake liegt auf dem Container, damit kein Compositing der ganzen App entsteht. */
  shake(offset: { readonly x: number; readonly y: number }): void {
    this.root.position.set(this.#base.x + offset.x, this.#base.y + offset.y);
  }

  cellAt(clientX: number, clientY: number): { x: number; y: number } | null {
    const rect = this.#deps.canvas().getBoundingClientRect();
    const bounds = this.#bounds();
    return screenToTile(clientX, clientY, rect, this.#deps.screen.width,
      this.root.x, this.root.y, this.root.scale.x, bounds.width, TILE, bounds.height);
  }

  #bounds(): WorldBounds {
    return this.#deps.bounds?.() ?? { width: this.#deps.size(), height: this.#deps.size() };
  }

  destroy(): void {
    this.root.destroy({ children: false });
  }
}
