/** Kamera mit zwei Zoom-Stufen: Übersicht und 30x30-Bereich. Lerpt ohne Frame-Allokationen. */
import type { Container } from 'pixi.js';
import type { Area } from '../core/sim/grid-zones';
import { REGION, TILE } from '../core/sim/types';

export class FloorCamera {
  #fit = 1;
  #zoom = 1;
  #target = 1;
  #focus = { x: 0.5, y: 0.5 };
  #targetFocus = { x: 0.5, y: 0.5 };

  get zoom(): number {
    return this.#zoom;
  }

  get fit(): number {
    return this.#fit;
  }

  get detail(): boolean {
    return this.#zoom > this.#fit * 1.12;
  }

  resize(screenWidth: number, screenHeight: number, size: number, reset = false): void {
    const next = this.#computeFit(screenWidth, screenHeight, size);
    const overview = reset || this.#zoom <= this.#fit * 1.01;
    this.#fit = next;
    this.#zoom = this.#clamp(overview ? next : this.#zoom);
    this.#target = this.#clamp(overview ? next : this.#target);
    if (overview) {
      this.#focus.x = 0.5;
      this.#focus.y = 0.5;
      this.#targetFocus.x = 0.5;
      this.#targetFocus.y = 0.5;
    }
  }

  overview(): void {
    this.#target = this.#fit;
    this.#targetFocus.x = 0.5;
    this.#targetFocus.y = 0.5;
  }

  zoomToArea(area: Area, size: number): void {
    this.#targetFocus.x = (area.x + area.w / 2) / size;
    this.#targetFocus.y = (area.y + area.h / 2) / size;
    this.#target = this.#clamp(Math.max(this.#fit * 2.2, this.#fit * (size / REGION)));
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

  apply(camera: Container, screenWidth: number, screenHeight: number, size: number): void {
    const width = size * TILE;
    const scale = Math.max(0.01, this.#zoom);
    camera.scale.set(scale);
    camera.position.set(
      screenWidth / 2 - this.#focus.x * width * scale,
      screenHeight / 2 - this.#focus.y * width * scale,
    );
  }

  #computeFit(screenWidth: number, screenHeight: number, size: number): number {
    const width = size * TILE;
    return Math.max(0.04, Math.min(screenWidth / width, screenHeight / width) * 0.96);
  }

  #clamp(value: number): number {
    return Math.min(this.#fit * 4.2, Math.max(this.#fit, value));
  }
}
