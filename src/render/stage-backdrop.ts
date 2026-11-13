/** Bühnenhintergrund: ferne Fliesen plus eine naehere, gegenlaeufige Parallax-Ebene. */
import { Container, Graphics } from 'pixi.js';
import { prefersReducedMotion } from './motion-preference';

interface ScreenSize { readonly width: number; readonly height: number }

export class StageBackdrop {
  readonly root = new Container();
  readonly #far = new Graphics();
  readonly #near = new Graphics();

  constructor() {
    this.root.eventMode = 'none';
    this.root.addChild(this.#far, this.#near);
  }

  resize(screen: ScreenSize): void {
    const w = Math.max(1, screen.width);
    const h = Math.max(1, screen.height);
    const g = this.#far;
    g.clear();
    g.rect(0, 0, w, h).fill(0x140d24);
    for (let x = 0; x < w; x += 64) g.rect(x, 0, 1, h).fill({ color: 0x2b1e48, alpha: 0.55 });
    for (let y = 0; y < h; y += 64) g.rect(0, y, w, 1).fill({ color: 0x2b1e48, alpha: 0.55 });
    g.rect(0, 0, w, 2).fill({ color: 0x452f6b, alpha: 0.5 });
    g.rect(0, h - 2, w, 2).fill({ color: 0x452f6b, alpha: 0.5 });

    const p = this.#near;
    p.clear();
    p.rect(-72, 0, 34, h + 32).fill({ color: 0x1d1430, alpha: 0.85 });
    p.rect(w + 38, 0, 34, h + 32).fill({ color: 0x1d1430, alpha: 0.85 });
    for (let y = 24; y < h; y += 88) {
      p.rect(-70, y, 10, 42).fill({ color: 0x3a2a58, alpha: 0.32 });
      p.rect(w + 60, y + 24, 10, 42).fill({ color: 0x3a2a58, alpha: 0.32 });
    }
  }

  /** Die naehere Ebene wandert staerker als die Welt; keine Bounds-Abfrage. */
  follow(worldX: number, worldY: number): void {
    // Parallaxe ist reine Dekoration: bei reduzierter Bewegung steht sie still.
    if (prefersReducedMotion()) {
      this.#near.position.set(0, 0);
      return;
    }
    this.#near.position.set(-worldX * 0.055, -worldY * 0.035);
  }

  destroy(): void {
    this.root.destroy({ children: true });
  }
}
