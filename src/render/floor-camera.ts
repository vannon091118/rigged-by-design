/** Kamera mit zwei Zoom-Stufen und expliziten Weltgrenzen; lerpt ohne Frame-Allokationen. */
import type { Container } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { REGION, TILE } from '../core/sim/types';

export interface WorldBounds {
  readonly width: number;
  readonly height: number;
}

const boundsOf = (world: number | WorldBounds): WorldBounds =>
  typeof world === 'number' ? { width: world, height: world } : world;

export class FloorCamera {
  #fit = 1;
  #fill = 1;
  #zoom = 1;
  #target = 1;
  #focus = { x: 0.5, y: 0.5 };
  #targetFocus = { x: 0.5, y: 0.5 };
  #bounds: WorldBounds = { width: 30, height: 30 };
  #detail = false;

  get zoom(): number {
    return this.#zoom;
  }

  get fit(): number {
    return this.#fit;
  }

  /**
   * Der Faktor, mit dem der Plan den Viewport ohne Rest fuellen wuerde (cover).
   * Die Uebersicht bleibt bei `fit` (contain), damit kein Raumrand aus dem Bild
   * faellt; die Flaeche zwischen Plan und Bildrand traegt der Buehnenhintergrund.
   */
  get fill(): number {
    return this.#fill;
  }

  get bounds(): WorldBounds {
    return this.#bounds;
  }

  /**
   * Detail mit Hysterese: rein oberhalb von 1.16×fit, raus erst unter 1.08×fit.
   * Damit flackert die Figur beim langsamen Zoomen nicht zwischen Rig und
   * Silhouette.
   */
  get detail(): boolean {
    const enter = this.#fit * 1.16;
    const exit = this.#fit * 1.08;
    if (this.#detail) {
      if (this.#zoom < exit) this.#detail = false;
    } else if (this.#zoom > enter) {
      this.#detail = true;
    }
    return this.#detail;
  }

  resize(screenWidth: number, screenHeight: number, world: number | WorldBounds, reset = false): void {
    this.#bounds = boundsOf(world);
    const next = this.#computeFit(screenWidth, screenHeight);
    const overview = reset || this.#zoom <= this.#fit * 1.01;
    this.#fit = next;
    this.#fill = this.#computeFill(screenWidth, screenHeight);
    this.#zoom = this.#clamp(overview ? next : this.#zoom);
    this.#target = this.#clamp(overview ? next : this.#target);
    if (overview) {
      this.#focus.x = 0.5;
      this.#focus.y = 0.5;
      this.#targetFocus.x = 0.5;
      this.#targetFocus.y = 0.5;
      this.#detail = false;
    }
  }

  overview(): void {
    this.#target = this.#fit;
    this.#targetFocus.x = 0.5;
    this.#targetFocus.y = 0.5;
  }

  zoomToArea(area: Area, world: number | WorldBounds): void {
    this.#bounds = boundsOf(world);
    const { width, height } = this.#bounds;
    this.#targetFocus.x = (area.x + area.w / 2) / width;
    this.#targetFocus.y = (area.y + area.h / 2) / height;
    this.#target = this.#clamp(Math.max(this.#fit * 2.2, this.#fit * (Math.max(width, height) / REGION)));
  }

  pinch(factor: number, worldX: number, worldY: number): void {
    const next = this.#clamp(this.#target * factor);
    this.#target = next;
    const centered = next <= this.#fit * 1.01;
    this.#targetFocus.x = centered ? 0.5 : Math.max(0, Math.min(1, worldX));
    this.#targetFocus.y = centered ? 0.5 : Math.max(0, Math.min(1, worldY));
  }

  wheel(worldX: number, worldY: number, deltaY: number): void {
    const next = this.#clamp(this.#target * (deltaY < 0 ? 1.14 : 0.88));
    this.#target = next;
    const centered = next <= this.#fit * 1.01;
    this.#targetFocus.x = centered ? 0.5 : Math.max(0, Math.min(1, worldX));
    this.#targetFocus.y = centered ? 0.5 : Math.max(0, Math.min(1, worldY));
  }

  /** Zoom fuer Tasten und Knoepfe: derselbe Weg wie das Rad, nur ohne Zeiger. */
  zoomStep(factor: number): void {
    this.#target = this.#clamp(this.#target * factor);
    if (this.#target <= this.#fit * 1.01) {
      this.#targetFocus.x = 0.5;
      this.#targetFocus.y = 0.5;
    }
  }

  /** Schwenk in normalisierten Weltanteilen: das Bild folgt dem Zeiger. */
  pan(dx: number, dy: number): void {
    this.#targetFocus.x = Math.max(0, Math.min(1, this.#targetFocus.x - dx));
    this.#targetFocus.y = Math.max(0, Math.min(1, this.#targetFocus.y - dy));
  }

  /**
   * Haelt die Figur im Bild, ohne jede Bewegung zur Kamerafahrt zu machen:
   * erst wenn sie den inneren Rahmen verlaesst, zieht die Kamera nach.
   */
  keepInView(x: number, y: number, screenWidth: number, screenHeight: number, world: number | WorldBounds): void {
    if (this.#zoom <= this.#fit * 1.01 || this.#target <= this.#fit * 1.01) return;
    const { width, height } = boundsOf(world);
    const worldW = width * TILE;
    const worldH = height * TILE;
    const halfX = Math.min(0.5, screenWidth / (2 * worldW * this.#zoom)) * 0.55;
    const halfY = Math.min(0.5, screenHeight / (2 * worldH * this.#zoom)) * 0.55;
    const dx = x / worldW - this.#targetFocus.x;
    const dy = y / worldH - this.#targetFocus.y;
    if (dx > halfX) this.#targetFocus.x += dx - halfX;
    else if (dx < -halfX) this.#targetFocus.x += dx + halfX;
    if (dy > halfY) this.#targetFocus.y += dy - halfY;
    else if (dy < -halfY) this.#targetFocus.y += dy + halfY;
    this.#targetFocus.x = Math.max(0, Math.min(1, this.#targetFocus.x));
    this.#targetFocus.y = Math.max(0, Math.min(1, this.#targetFocus.y));
  }

  step(): boolean {
    let moving = false;
    if (Math.abs(this.#target - this.#zoom) > 0.0004) {
      this.#zoom += (this.#target - this.#zoom) * 0.22;
      moving = true;
    }
    if (Math.abs(this.#targetFocus.x - this.#focus.x) > 0.0004) {
      this.#focus.x += (this.#targetFocus.x - this.#focus.x) * 0.22;
      moving = true;
    }
    if (Math.abs(this.#targetFocus.y - this.#focus.y) > 0.0004) {
      this.#focus.y += (this.#targetFocus.y - this.#focus.y) * 0.22;
      moving = true;
    }
    return moving;
  }

  apply(camera: Container, screenWidth: number, screenHeight: number, world: number | WorldBounds): void {
    this.#bounds = boundsOf(world);
    const width = this.#bounds.width * TILE;
    const height = this.#bounds.height * TILE;
    const scale = Math.max(0.01, this.#zoom);
    camera.scale.set(scale);
    camera.position.set(
      screenWidth / 2 - this.#focus.x * width * scale,
      screenHeight / 2 - this.#focus.y * height * scale,
    );
  }

  /** Übersicht: die ganze Welt bleibt sichtbar (contain auf beiden Achsen). */
  #computeFit(screenWidth: number, screenHeight: number): number {
    const width = this.#bounds.width * TILE;
    const height = this.#bounds.height * TILE;
    return Math.max(0.04, Math.min(screenWidth / width, screenHeight / height) * 0.96);
  }

  /** Vollflaeche: der Faktor, ab dem keine Flaeche mehr frei bleibt (cover). */
  #computeFill(screenWidth: number, screenHeight: number): number {
    const width = this.#bounds.width * TILE;
    const height = this.#bounds.height * TILE;
    return Math.max(0.04, Math.max(screenWidth / width, screenHeight / height));
  }

  #clamp(value: number): number {
    return Math.min(this.#fit * 4.2, Math.max(this.#fit, value));
  }
}
