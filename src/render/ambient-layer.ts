/**
 * Ambient-Schicht: statischer Schleier, statische Sonnenstrahlen und ein
 * Sichtradius an der Figur. Alles haengt in Weltkoordinaten an der Kamera,
 * damit die Beleuchtung beim Zoomen nicht mitspringt; die Schicht hat keinen
 * eigenen Ticker und schreibt nie in den Spielzustand.
 */
import { Container, Graphics, Sprite } from 'pixi.js';
import { TILE } from '../core/sim/types';
import type { GameView } from '../store/types';
import type { AmbientPlan } from './ambient-plan';
import { ambientPlanFor } from './ambient-plan';
import { ASSET } from './assets/keys';
import { textureFor } from './assets/textures';
import type { WorldBounds } from './floor-camera';

/** Drei Strahlen reichen; mehr waeren nur zusaetzliche Deckkraft. */
const RAY_STARTS = [0.14, 0.38, 0.66] as const;
const RAY_WIDTHS = [0.05, 0.062, 0.074] as const;

export class AmbientLayer {
  readonly root = new Container();
  readonly #shade = new Graphics();
  readonly #rays = new Graphics();
  readonly #vision = new Sprite();
  #plan: AmbientPlan | null = null;
  #width = 0;
  #height = 0;

  constructor() {
    this.root.eventMode = 'none';
    // Der Radius liegt ueber dem Schleier und addiert Licht statt Farbe zu ersetzen.
    this.#vision.anchor.set(0.5, 0.55);
    this.#vision.blendMode = 'add';
    this.#vision.visible = false;
    this.root.addChild(this.#shade, this.#rays, this.#vision);
  }

  /** Snapshot-Wechsel: Plan und Weltkante; gleiche Eingabe zeichnet nicht neu. */
  update(view: GameView, bounds: WorldBounds): void {
    const plan = ambientPlanFor(view.dayPhase, view.scene.kind);
    const width = bounds.width * TILE;
    const height = bounds.height * TILE;
    if (plan === this.#plan && width === this.#width && height === this.#height) return;
    this.#plan = plan;
    this.#width = width;
    this.#height = height;
    this.#drawShade(plan);
    this.#drawRays(plan);
    this.#drawVision(plan);
  }

  /** Nur der Radius folgt der Figur; Schleier und Strahlen bleiben statisch. */
  animate(x: number, y: number): void {
    if (!this.#vision.visible) return;
    this.#vision.position.set(x, y);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }

  #drawShade(plan: AmbientPlan): void {
    this.#shade.clear();
    this.#shade.visible = plan.shade > 0;
    if (!this.#shade.visible) return;
    this.#shade.rect(0, 0, this.#width, this.#height).fill({ color: plan.shadeTint, alpha: plan.shade });
  }

  /** Strahlen sind eine gebackene Grafik; sie kosten pro Frame nichts. */
  #drawRays(plan: AmbientPlan): void {
    this.#rays.clear();
    this.#rays.visible = plan.rays > 0;
    if (!this.#rays.visible) return;
    const slant = plan.sunX * 42;
    RAY_STARTS.forEach((start, index) => {
      const x = start * this.#width;
      const width = this.#width * RAY_WIDTHS[index]!;
      this.#rays
        .poly([x, 0, x + width, 0, x + width + slant, this.#height, x + slant, this.#height])
        .fill({ color: 0xffe4a8, alpha: plan.rays * (0.5 + index * 0.15) });
    });
  }

  #drawVision(plan: AmbientPlan): void {
    const texture = plan.visionTiles > 0 ? textureFor(ASSET.lightPool) : null;
    this.#vision.visible = texture !== null;
    if (!texture) return;
    const radius = plan.visionTiles * TILE;
    this.#vision.texture = texture;
    this.#vision.width = radius * 2;
    // Dreiviertel-Sicht: ein exakter Kreis wuerde die Bodenperspektive brechen.
    this.#vision.height = radius * 1.7;
    this.#vision.tint = plan.visionTint;
    this.#vision.alpha = plan.visionAlpha;
  }
}
