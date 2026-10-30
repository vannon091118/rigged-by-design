// @loc-exception: Der Kessel haelt Rad, Kugel, Dolly und Beschriftung in einem Ticker; getrennt muessten Winkel und Kesselreihenfolge doppelt gepflegt werden.
/** Europaeischer Kessel in Pixi: Rad, Kugel im Gegenlauf und Dolly auf der Gewinnzahl. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import { ROULETTE_WHEEL, colourOf } from '../../core/games/roulette-table';

const SIZE = 300;
const CENTER = SIZE / 2;
const OUTER = 136;
const TRACK = 118;
const NUMBER_RING = 104;
const BALL_REST = 110;
const SECTORS = ROULETTE_WHEEL.length;
const ANGLE = (Math.PI * 2) / SECTORS;

const SECTOR_COLOR: Readonly<Record<string, number>> = {
  gruen: 0x1f8f5c,
  rot: 0xb3252f,
  schwarz: 0x1a1620,
};

/** Winkel der Sektormitte; 0 zeigt nach oben, im Uhrzeigersinn. */
const sectorAngle = (number: number): number => {
  const index = ROULETTE_WHEEL.indexOf(number);
  return (index < 0 ? 0 : index) * ANGLE + ANGLE / 2;
};

export class RouletteCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #wheel = new Container();
  readonly #ball = new Graphics();
  readonly #dolly = new Graphics();
  #onDone: (() => void) | null = null;
  #time = 0;
  #spinning = false;
  #target = 0;
  #wheelTurn = 0;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#root.addChild(this.#wheel);
    this.#buildWheel();
    this.#root.addChild(this.#ball, this.#dolly);
    this.#ball.visible = false;
    this.#dolly.visible = false;
    this.#drawDolly();
    app.ticker.add(this.#tick);
    this.layout();
  }

  #buildWheel(): void {
    const base = new Graphics();
    base.circle(CENTER, CENTER, OUTER).fill({ color: 0x3b2317 });
    base.circle(CENTER, CENTER, OUTER - 5).stroke({ width: 3, color: 0xc9a227, alpha: 0.9 });
    base.circle(CENTER, CENTER, TRACK).fill({ color: 0x140f1c });
    base.circle(CENTER, CENTER, TRACK).stroke({ width: 1.6, color: 0xc9a227, alpha: 0.6 });
    for (const side of [0, Math.PI / 2]) {
      base.rect(CENTER - 2, CENTER - OUTER + 6, 4, 26).fill({ color: 0xc9a227, alpha: 0.55 });
      if (side) {
        base.rect(CENTER - OUTER + 6, CENTER - 2, 26, 4).fill({ color: 0xc9a227, alpha: 0.55 });
        base.rect(CENTER + OUTER - 32, CENTER - 2, 26, 4).fill({ color: 0xc9a227, alpha: 0.55 });
      }
    }
    this.#wheel.addChild(base);

    ROULETTE_WHEEL.forEach((number, index) => {
      const from = index * ANGLE - ANGLE / 2;
      const colour = colourOf(number);
      const sector = new Graphics()
        .moveTo(CENTER, CENTER)
        .arc(CENTER, CENTER, TRACK, from, from + ANGLE)
        .lineTo(CENTER, CENTER)
        .fill({ color: SECTOR_COLOR[colour] ?? 0x1a1620, alpha: number === 0 ? 1 : 0.92 });
      sector.stroke({ width: 0.5, color: 0x000000, alpha: 0.5 });
      this.#wheel.addChild(sector);
      const label = new Text({
        text: String(number),
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 8, fontWeight: '700', fill: 0xf7f3ea },
        resolution: 6,
      });
      label.anchor.set(0.5);
      const angle = sectorAngle(number);
      label.position.set(CENTER + Math.sin(angle) * NUMBER_RING, CENTER - Math.cos(angle) * NUMBER_RING);
      label.rotation = angle;
      this.#wheel.addChild(label);
    });

    const hub = new Graphics();
    hub.circle(CENTER, CENTER, 30).fill({ color: 0x2a1a12 });
    hub.circle(CENTER, CENTER, 30).stroke({ width: 2, color: 0xc9a227, alpha: 0.85 });
    for (let arm = 0; arm < 4; arm += 1) {
      const angle = (arm * Math.PI) / 2 + Math.PI / 4;
      const x = CENTER + Math.sin(angle) * 19;
      const y = CENTER - Math.cos(angle) * 19;
      hub.poly([x, y - 6, x + 4, y, x, y + 6, x - 4, y]).fill({ color: 0xc9a227, alpha: 0.65 });
    }
    this.#root.addChild(hub);
    // Das Rad dreht um seinen Mittelpunkt, nicht um die linke obere Ecke der Buehne.
    this.#wheel.pivot.set(CENTER, CENTER);
    this.#wheel.position.set(CENTER, CENTER);
  }

  #drawDolly(): void {
    this.#dolly.clear();
    this.#dolly.circle(0, 0, 5).fill({ color: 0xffd166 });
    this.#dolly.circle(0, 0, 5).stroke({ width: 1, color: 0x6b4b00 });
    this.#dolly.rect(-1, 6, 2, 8).fill({ color: 0xffd166, alpha: 0.85 });
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / SIZE, screen.height / SIZE);
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - SIZE * scale) / 2, (screen.height - SIZE * scale) / 2);
  }

  /** Dreht das Rad gegen den Uhrzeigersinn, die Kugel laeuft vorwaerts in ihre Tasche. */
  spin(number: number, onDone: () => void): void {
    this.#onDone = onDone;
    this.#spinning = true;
    this.#time = 0;
    this.#target = sectorAngle(number);
    this.#ball.visible = true;
    this.#dolly.visible = false;
    this.#wheelTurn = this.#wheel.rotation;
  }

  #tick = (): void => {
    if (!this.#spinning) return;
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    this.#time += dt;
    const t = Math.min(1, this.#time / 3200);
    const eased = 1 - (1 - t) ** 2.4;
    this.#wheel.rotation = this.#wheelTurn - Math.PI * 2.6 * eased;
    const orbit = Math.PI * 2 * 2.4 * (1 - eased) + this.#target;
    const radius = BALL_REST + (OUTER - 12 - BALL_REST) * (1 - eased) ** 2;
    const bounce = Math.abs(Math.sin(t * Math.PI * 5)) * 6 * (1 - t) * (1 - t);
    const angle = this.#wheel.rotation + orbit;
    this.#ball.clear();
    this.#ball.circle(
      CENTER + Math.sin(angle) * (radius + bounce),
      CENTER - Math.cos(angle) * (radius + bounce),
      4.4,
    ).fill({ color: 0xf7f3ea });
    this.#ball.circle(
      CENTER + Math.sin(angle) * (radius + bounce),
      CENTER - Math.cos(angle) * (radius + bounce),
      4.4,
    ).stroke({ width: 0.8, color: 0x9a8f7a, alpha: 0.8 });
    if (t < 1) return;
    this.#spinning = false;
    const landed = this.#wheel.rotation + this.#target;
    this.#dolly.position.set(CENTER + Math.sin(landed) * 96, CENTER - Math.cos(landed) * 96);
    this.#dolly.rotation = landed;
    this.#dolly.visible = true;
    this.#ball.clear();
    this.#ball.circle(CENTER + Math.sin(landed) * BALL_REST, CENTER - Math.cos(landed) * BALL_REST, 4.4)
      .fill({ color: 0xf7f3ea });
    const done = this.#onDone;
    this.#onDone = null;
    done?.();
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#root.destroy({ children: true });
  }
}
