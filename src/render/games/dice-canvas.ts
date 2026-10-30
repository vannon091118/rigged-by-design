/** Der Wuerfeltisch in Pixi: Filz, Bande und zwei Wuerfel, die auf dem Kern-Ergebnis liegen bleiben. */
import { Application, Container, Graphics, Text } from 'pixi.js';

const TABLE_W = 220;
const TABLE_H = 120;
const DIE = 26;
const PIPS: Readonly<Record<number, readonly (readonly [number, number])[]>> = {
  1: [[0.5, 0.5]],
  2: [[0.28, 0.28], [0.72, 0.72]],
  3: [[0.26, 0.26], [0.5, 0.5], [0.74, 0.74]],
  4: [[0.28, 0.28], [0.72, 0.28], [0.28, 0.72], [0.72, 0.72]],
  5: [[0.28, 0.28], [0.72, 0.28], [0.5, 0.5], [0.28, 0.72], [0.72, 0.72]],
  6: [[0.28, 0.24], [0.72, 0.24], [0.28, 0.5], [0.72, 0.5], [0.28, 0.76], [0.72, 0.76]],
};

interface DieState {
  readonly gfx: Container;
  readonly body: Graphics;
  readonly frame: Graphics;
  from: { x: number; y: number };
  to: { x: number; y: number };
  spin: number;
  face: number;
  shown: number;
  delay: number;
}

function paintFace(g: Graphics, face: number): void {
  g.clear();
  g.roundRect(-DIE / 2, -DIE / 2, DIE, DIE, DIE * 0.2).fill({ color: 0xf7f3ea });
  g.roundRect(-DIE / 2, -DIE / 2, DIE, DIE, DIE * 0.2).stroke({ width: 1.2, color: 0x2b2233 });
  for (const [px, py] of PIPS[face] ?? PIPS[1]!) {
    g.circle(-DIE / 2 + px * DIE, -DIE / 2 + py * DIE, DIE * 0.075).fill({ color: 0x1b1226 });
  }
}

export class DiceCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #felt = new Container();
  readonly #dice: DieState[] = [];
  readonly #caption = new Text({
    text: '',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 11, fontWeight: '800', fill: 0xffd166 },
  });
  #time = 0;
  #onDone: (() => void) | null = null;
  #playing = false;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#root.addChild(this.#felt);
    this.#drawTable();
    for (let index = 0; index < 2; index += 1) {
      const gfx = new Container();
      const body = new Graphics();
      const frame = new Graphics();
      paintFace(body, 1);
      gfx.addChild(frame, body);
      gfx.position.set(TABLE_W / 2 - 22 + index * 44, TABLE_H * 0.62);
      this.#root.addChild(gfx);
      this.#dice.push({
        gfx, body, frame,
        from: { x: gfx.x, y: gfx.y }, to: { x: gfx.x, y: gfx.y }, spin: 0, face: 1, shown: 1, delay: index * 90,
      });
    }
    this.#caption.anchor.set(0.5);
    this.#caption.position.set(TABLE_W / 2, TABLE_H - 12);
    this.#caption.alpha = 0;
    this.#root.addChild(this.#caption);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #drawTable(): void {
    const felt = new Graphics();
    felt.roundRect(0, 0, TABLE_W, TABLE_H, 10).fill({ color: 0x0d3b2a });
    felt.roundRect(0, 0, TABLE_W, TABLE_H, 10).stroke({ width: 3, color: 0x8a6a2f });
    felt.roundRect(8, 8, TABLE_W - 16, TABLE_H - 16, 7).stroke({ width: 1, color: 0x1c6b4c, alpha: 0.9 });
    felt.circle(TABLE_W / 2, TABLE_H * 0.6, 46).stroke({ width: 0.8, color: 0x2f8a63, alpha: 0.55 });
    felt.moveTo(14, TABLE_H * 0.3);
    felt.lineTo(TABLE_W - 14, TABLE_H * 0.3);
    felt.stroke({ width: 0.6, color: 0x2f8a63, alpha: 0.35 });
    this.#felt.addChild(felt);
    const label = new Text({
      text: 'WUERFELTISCH',
      style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 8, fontWeight: '700', fill: 0x7fd8b3, letterSpacing: 2 },
    });
    label.anchor.set(0.5);
    label.position.set(TABLE_W / 2, 16);
    this.#felt.addChild(label);
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / (TABLE_W + 12), screen.height / (TABLE_H + 12), 1.6);
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - TABLE_W * scale) / 2, (screen.height - TABLE_H * scale) / 2);
  }

  /** Wirft die Wuerfel und laesst sie auf den Augen des Kerns liegen. */
  roll(dice: readonly [number, number], won: boolean, onDone: () => void): void {
    this.#onDone = onDone;
    this.#playing = true;
    this.#time = 0;
    this.#caption.alpha = 0;
    this.#caption.text = won ? 'GEWONNEN' : 'VERLOREN';
    this.#dice.forEach((die, index) => {
      die.face = dice[index] ?? 1;
      die.shown = 1;
      die.delay = 40 + index * 70;
      die.from = { x: TABLE_W * 0.18 - index * 10, y: -DIE };
      die.to = { x: TABLE_W / 2 - 26 + index * 52, y: TABLE_H * 0.6 };
      die.spin = 0;
      die.gfx.rotation = 0;
      die.gfx.scale.set(1);
    });
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    if (!this.#playing) return;
    this.#time += dt;
    let settled = true;
    this.#dice.forEach((die, index) => {
      const t = Math.max(0, Math.min(1, (this.#time - die.delay) / 760));
      if (t < 1) settled = false;
      const ease = 1 - (1 - t) ** 3;
      const bounce = Math.sin(Math.min(1, t) * Math.PI * 2.2) * (1 - t) * 16;
      die.gfx.x = die.from.x + (die.to.x - die.from.x) * ease;
      die.gfx.y = die.from.y + (die.to.y - die.from.y) * ease - bounce;
      die.gfx.rotation = (1 - ease) * (index % 2 === 0 ? 3.2 : -2.8);
      const cycling = Math.floor(this.#time / 90 + index * 3);
      const shown = t < 1 ? ((cycling % 6) + 1) : die.face;
      if (shown !== die.shown) {
        die.shown = shown;
        paintFace(die.body, shown);
      }
      if (t >= 1) {
        die.gfx.rotation = 0;
        die.gfx.scale.set(1 + Math.sin(Math.min(1, (this.#time - die.delay - 760) / 220) * Math.PI) * 0.12);
      }
    });
    if (this.#time > 620) {
      this.#caption.alpha = Math.min(1, (this.#time - 620) / 220);
    }
    if (settled && this.#time > 1250) {
      const done = this.#onDone;
      this.#onDone = null;
      this.#playing = false;
      done?.();
    }
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#root.destroy({ children: true });
  }
}
