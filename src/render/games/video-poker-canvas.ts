/** Video Poker in Pixi: Paytable oben links, fuenf Karten, HOLD-Stempel, Trefferlicht. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Card } from '../../core/rng/shoe';
import { VIDEO_POKER_PAYTABLE, type VideoPokerHand } from '../../core/games/engines/interactive-cards';
import { CARD_H, CardView } from './card-renderer';

const W = 520;
const H = 300;
const CARD_Y = 196;
const SLOT_X = [268, 324, 380, 436, 492];

const label = (text: string, size: number, colour: number, weight: '600' | '700' | '800' = '700'): Text => {
  const view = new Text({
    text,
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: size, fontWeight: weight, fill: colour, letterSpacing: 0.6 },
    resolution: 6,
  });
  return view;
};

export class VideoPokerCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #cards = new Container();
  readonly #views: CardView[] = [];
  readonly #stamps: Text[] = [];
  readonly #rows: Text[] = [];
  readonly #frame = new Graphics();
  readonly #status = label('9/6 JACKS OR BETTER', 9, 0x7fd8b3);
  onCard: ((index: number) => void) | null = null;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    // Rahmen sofort zeichnen: ein leeres Graphics bringt den Pixi-Batcher zum Absturz.
    this.#drawFrame();
    this.#root.addChild(this.#frame);
    this.#buildPaytable();
    this.#root.addChild(this.#cards);
    this.#status.position.set(SLOT_X[0]! - 24, 42);
    this.#root.addChild(this.#status);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #buildPaytable(): void {
    const header = label('JACKS OR BETTER', 8, 0xffd166);
    header.position.set(16, 26);
    this.#root.addChild(header);
    VIDEO_POKER_PAYTABLE.forEach((row, index) => {
      const line = label(`${row.label}  ·  ${(row.bps / 10_000).toFixed(0)}x`, 8, 0xc8b6e4, '600');
      line.position.set(16, 44 + index * 15);
      this.#rows.push(line);
      this.#root.addChild(line);
    });
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / (W + 8), screen.height / (H + 8));
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - W * scale) / 2, (screen.height - H * scale) / 2);
  }

  #drawFrame(): void {
    this.#frame.clear();
    this.#frame.roundRect(4, 14, W - 8, H - 20, 12).fill({ color: 0x0a1420 });
    this.#frame.roundRect(4, 14, W - 8, H - 20, 12).stroke({ width: 2, color: 0x2f6b8a });
    this.#frame.roundRect(10, 20, 214, H - 34, 8).stroke({ width: 1, color: 0x1f4b63, alpha: 0.9 });
    this.#frame.roundRect(SLOT_X[0]! - 44, 60, 6 * 56, 168, 8).stroke({ width: 1, color: 0x1f4b63, alpha: 0.7 });
  }

  /** Legt die fuenf Karten; getauschte Karten flippen, gehaltene bleiben stehen. */
  render(hand: readonly Card[], holds: readonly boolean[], highlight: VideoPokerHand | null, onDone?: () => void): void {
    this.#drawFrame();
    hand.forEach((card, index) => {
      let view = this.#views[index];
      if (!view) {
        view = new CardView();
        this.#views[index] = view;
        this.#cards.addChild(view.view);
        view.set(card, false);
        view.place(SLOT_X[index]!, CARD_Y - 26);
        view.flyTo(SLOT_X[index]!, CARD_Y, 340, index * 70);
        view.flip(card, true, 280);
      } else if (view.card !== card) {
        view.flip(card, true);
      } else {
        view.place(SLOT_X[index]!, CARD_Y);
      }
      view.view.eventMode = 'static';
      view.view.cursor = 'pointer';
      view.view.removeAllListeners('pointertap');
      view.view.on('pointertap', () => this.onCard?.(index));
    });
    this.#stamps.forEach((stamp) => { stamp.visible = false; });
    holds.forEach((held, index) => {
      if (!held) return;
      let stamp = this.#stamps[index];
      if (!stamp) {
        stamp = new Text({
          text: 'HOLD',
          style: {
            fontFamily: 'Inter, system-ui, sans-serif', fontSize: 9, fontWeight: '800',
            fill: 0xffd166, stroke: { color: 0x1a1206, width: 3 },
          },
          resolution: 6,
        });
        stamp.anchor.set(0.5);
        stamp.position.set(SLOT_X[index]!, CARD_Y + CARD_H / 2 - 9);
        this.#stamps[index] = stamp;
        this.#root.addChild(stamp);
      }
      stamp.visible = true;
    });
    this.#rows.forEach((row, index) => {
      const active = VIDEO_POKER_PAYTABLE[index]!.hand === highlight;
      row.style.fill = active ? 0xffd166 : 0xc8b6e4;
      row.alpha = active ? 1 : 0.8;
    });
    if (onDone) this.#onDone = onDone;
  }

  #onDone: (() => void) | null = null;

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    let busy = false;
    for (const view of this.#views) if (view.update(dt)) busy = true;
    this.#stamps.forEach((stamp, index) => {
      if (!stamp.visible) return;
      const pulse = 1 + Math.sin(this.#app.ticker.lastTime / 260 + index) * 0.05;
      stamp.scale.set(pulse);
    });
    if (!busy && this.#onDone) {
      const done = this.#onDone;
      this.#onDone = null;
      done();
    }
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#root.destroy({ children: true });
  }
}
