/** Die Risiko-Karte nach einem Gewinn: Ruecken, Farbe, Aufdecken – ohne Walzenwissen. */
import { Container, Graphics, Text } from 'pixi.js';
import type { RiskColor } from '../../core/games/risk-card';

const FLIP_MS = 130;

export class GambleCard {
  readonly #root: Container;
  #box: Container | null = null;
  #back: Graphics | null = null;
  #caption: Text | null = null;
  #face: RiskColor | null = null;
  #t = 0;

  constructor(root: Container) {
    this.#root = root;
  }

  /** Legt eine frische Karte auf die Mitte der Buehne und startet den Aufdeck-Takt. */
  show(card: RiskColor, won: boolean, x: number, y: number): void {
    this.clear();
    const box = new Container();
    const face = new Graphics()
      .roundRect(-70, -96, 140, 192, 14)
      .fill({ color: won ? 0x0f3a2c : 0x3a0f1f })
      .stroke({ width: 3, color: card === 'ROT' ? 0xff2e88 : 0x9aa7b8 });
    const back = new Graphics().roundRect(-70, -96, 140, 192, 14).fill({ color: 0x1b1030 }).stroke({ width: 3, color: 0xffd166 });
    const label = new Text({
      text: `${card}\n${won ? 'GEWONNEN' : 'VERLOREN'}`,
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: '800', align: 'center', fill: 0xffffff },
    });
    label.anchor.set(0.5);
    box.addChild(face, back, label);
    box.position.set(x, y);
    box.scale.set(0.9);
    box.alpha = 0;
    this.#root.addChild(box);
    this.#box = box;
    this.#back = back;
    this.#caption = label;
    this.#face = card;
    this.#t = 0;
    face.alpha = 0;
    label.alpha = 0;
  }

  clear(): void {
    this.#box?.destroy({ children: true });
    this.#box = null;
    this.#back = null;
    this.#caption = null;
    this.#face = null;
  }

  /** Aufdecken: erst Ruecken, dann Farbe, danach verblasst die Karte. */
  update(dt: number): void {
    const box = this.#box;
    if (!box) return;
    this.#t += dt;
    if (this.#t < FLIP_MS) {
      box.alpha = this.#t / FLIP_MS;
      box.scale.x = 0.9 * (this.#t / FLIP_MS);
      return;
    }
    box.alpha = 1;
    if (this.#t < FLIP_MS * 2) {
      box.scale.x = 1 - (this.#t - FLIP_MS) / FLIP_MS;
      return;
    }
    box.scale.x = Math.min(1, (this.#t - FLIP_MS * 2) / FLIP_MS);
    if (this.#back) this.#back.alpha = 0;
    if (this.#caption) this.#caption.alpha = 1;
    if (this.#face && this.#t > FLIP_MS * 4) {
      box.alpha = Math.max(0, 1 - (this.#t - FLIP_MS * 4) / 400);
      if (this.#t > FLIP_MS * 5) this.clear();
    }
  }
}
