/** Blackjack-Tisch in Pixi: Dealer oben, Spieler unten, Karten fliegen aus dem Schuh. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Card } from '../../core/rng/shoe';
import { handTotal, type BlackjackRound } from '../../core/games/engines/interactive-cards';
import { CARD_H, CARD_W, CardView } from './card-renderer';

const W = 520;
const H = 300;
const DEALER_Y = 84;
const PLAYER_Y = 222;
const SHOE = { x: 476, y: 150 };
const STEP = 32;

const label = (text: string, size: number, colour: number, weight: '600' | '700' | '800' = '700'): Text => {
  const view = new Text({
    text,
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: size, fontWeight: weight, fill: colour, letterSpacing: 1 },
    resolution: 6,
  });
  view.anchor.set(0.5);
  return view;
};

export class BlackjackCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #cards = new Container();
  readonly #player: CardView[] = [];
  readonly #dealer: CardView[] = [];
  readonly #dealerScore = label('DEALER', 10, 0xffd166);
  readonly #playerScore = label('DU', 10, 0x00ffcc);
  readonly #status = label('SETZE UND TEILE AUS', 10, 0xc8b6e4);
  #onDone: (() => void) | null = null;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#drawTable();
    this.#root.addChild(this.#cards);
    this.#dealerScore.position.set(W / 2, 34);
    this.#playerScore.position.set(W / 2, 288);
    this.#status.position.set(W / 2, 158);
    this.#root.addChild(this.#dealerScore, this.#playerScore, this.#status);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #drawTable(): void {
    const felt = new Graphics()
      .roundRect(6, 46, W - 12, H - 52, 26).fill({ color: 0x0f3b2a })
      .roundRect(6, 46, W - 12, H - 52, 26).stroke({ width: 3, color: 0x8a6a2f })
      .roundRect(18, 58, W - 36, H - 76, 18).stroke({ width: 1, color: 0x1f6b48, alpha: 0.8 })
      .moveTo(40, 152).lineTo(W - 40, 152).stroke({ width: 0.8, color: 0x2f8a63, alpha: 0.5 });
    this.#root.addChild(felt);
    const shoe = new Graphics();
    for (let index = 2; index >= 0; index -= 1) {
      shoe.roundRect(SHOE.x - CARD_W / 2 + index * 2, SHOE.y - CARD_H / 2 - index * 2, CARD_W, CARD_H, 5)
        .fill({ color: 0x2a1030 })
        .stroke({ width: 1, color: 0xc9a227, alpha: 0.7 });
    }
    this.#root.addChild(shoe);
    const shoeLabel = label('SCHUH', 7, 0xc9a227);
    shoeLabel.position.set(SHOE.x, SHOE.y + CARD_H / 2 + 10);
    this.#root.addChild(shoeLabel);
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / (W + 8), screen.height / (H + 8));
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - W * scale) / 2, (screen.height - H * scale) / 2);
  }

  reset(): void {
    for (const view of [...this.#player, ...this.#dealer]) view.destroy();
    this.#player.length = 0;
    this.#dealer.length = 0;
    this.#status.text = 'SETZE UND TEILE AUS';
  }

  #slot(index: number, count: number): number {
    return W / 2 + (index - (count - 1) / 2) * STEP;
  }

  /** Gleicht die Buehne mit der Runde ab: neue Karten fliegen, die Lochkarte bleibt zu. */
  render(round: BlackjackRound, onDone?: () => void): void {
    this.#onDone = onDone ?? null;
    const sync = (views: CardView[], cards: readonly Card[], y: number, hideIndex: number | null): void => {
      cards.forEach((card, index) => {
        let view = views[index];
        const x = this.#slot(index, cards.length);
        if (!view) {
          view = new CardView();
          views[index] = view;
          this.#cards.addChild(view.view);
          view.set(card, hideIndex !== index);
          view.place(SHOE.x, SHOE.y);
          view.flyTo(x, y, 420, index * 90);
          return;
        }
        // Aufdecken und Zudecken: die Lochkarte bleibt dieselbe Karte, nur die Seite wechselt.
        if (view.card !== card || view.faceUp !== (hideIndex !== index)) {
          view.flip(card, hideIndex !== index);
        }
        // Nach jeder neuen Karte ruecken alle Karten nach, sonst ueberlappen sie.
        if (Math.abs(view.view.x - x) > 0.5) view.flyTo(x, view.view.y, 220);
      });
      views.forEach((view, index) => {
        if (index < cards.length) return;
        view.destroy();
        views.splice(index, 1);
      });
    };

    sync(this.#dealer, round.dealer, DEALER_Y, round.phase === 'PLAYER' ? 1 : null);
    sync(this.#player, round.player, PLAYER_Y, null);

    const visibleDealer = round.phase === 'PLAYER' ? round.dealer.slice(0, 1) : round.dealer;
    const dealerTotal = handTotal(visibleDealer);
    this.#dealerScore.text = round.phase === 'PLAYER' ? `DEALER · ${dealerTotal} + ?` : `DEALER · ${dealerTotal}`;
    this.#playerScore.text = `DU · ${handTotal(round.player)}`;
    this.#status.text = round.phase === 'PLAYER' ? 'DEIN ZUG: ZIEHEN, HALTEN ODER VERDOPPELN' : round.label;
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    let busy = false;
    for (const view of [...this.#player, ...this.#dealer]) {
      if (view.update(dt)) busy = true;
    }
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
