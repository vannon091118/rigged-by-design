/** Poker-Tisch in Pixi: Filz, Gegner-Haende verdeckt, Board, Pot und deine Karten. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { Card } from '../../core/rng/shoe';
import type { PokerTable } from '../../core/games/poker-types';
import { CARD_H, CARD_W, CardView } from './card-renderer';

const W = 520;
const H = 300;
const BOARD_Y = 168;
const BOARD_X = [148, 204, 260, 316, 372];
const SEAT_Y = 74;
const SEAT_X = [110, 260, 410];
const SEAT_SCALE = 0.6;
const HERO_Y = 246;
const HERO_X = [224, 280];

const label = (text: string, size: number, colour: number, weight: '600' | '700' = '700'): Text => new Text({
  text,
  style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: size, fontWeight: weight, fill: colour, letterSpacing: 0.4 },
  resolution: 6,
});

const vc = (micro: number): string => `${(micro / 10_000).toFixed(2).replace('.', ',')} VC`;

const sameCard = (a: Card | null, b: Card): boolean => a !== null && a.rank === b.rank && a.suit === b.suit;

/** Legt eine Karte ohne Animation, oder deckt eine gleiche Karte nur auf. */
function show(view: CardView, card: Card, faceUp: boolean): void {
  if (!sameCard(view.card, card)) view.set(card, faceUp);
  else if (view.faceUp !== faceUp) view.flip(card, faceUp);
  view.view.visible = true;
}

export class PokerCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #felt = new Graphics();
  readonly #pot = label('', 10, 0xffd166);
  readonly #heroLabel = label('DU', 9, 0xffd166);
  readonly #seats: Container[] = [];
  readonly #seatLabels: Text[] = [];
  readonly #seatCards: CardView[][] = [];
  readonly #board: CardView[] = [];
  readonly #hero: CardView[] = [];
  readonly #all: CardView[] = [];

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    // Filz sofort zeichnen: ein leeres Graphics bringt den Pixi-Batcher zum Absturz.
    this.#drawFelt();
    this.#root.addChild(this.#felt);

    this.#pot.anchor.set(0.5);
    this.#pot.position.set(W / 2, 34);
    this.#root.addChild(this.#pot);

    SEAT_X.forEach((x) => {
      const container = new Container();
      container.position.set(x, SEAT_Y);
      container.scale.set(SEAT_SCALE);
      const cards = [-30, 30].map((dx) => {
        const view = new CardView();
        view.place(dx, 0);
        container.addChild(view.view);
        this.#all.push(view);
        return view;
      });
      this.#seatCards.push(cards);
      this.#seats.push(container);
      this.#root.addChild(container);
      const name = label('', 9, 0xc8b6e4, '600');
      name.anchor.set(0.5);
      name.position.set(x, SEAT_Y + 46);
      this.#seatLabels.push(name);
      this.#root.addChild(name);
    });

    BOARD_X.forEach((x) => {
      const view = new CardView();
      view.place(x, BOARD_Y);
      this.#root.addChild(view.view);
      this.#board.push(view);
      this.#all.push(view);
    });

    this.#heroLabel.anchor.set(0.5);
    this.#heroLabel.position.set(110, HERO_Y);
    this.#root.addChild(this.#heroLabel);
    HERO_X.forEach((x) => {
      const view = new CardView();
      view.place(x, HERO_Y);
      this.#root.addChild(view.view);
      this.#hero.push(view);
      this.#all.push(view);
    });

    this.render(null);
    app.ticker.add(this.#tick);
    this.layout();
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / (W + 8), screen.height / (H + 8));
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - W * scale) / 2, (screen.height - H * scale) / 2);
  }

  #drawFelt(): void {
    const g = this.#felt;
    g.roundRect(4, 14, W - 8, H - 20, 14).fill({ color: 0x123a2c });
    g.roundRect(4, 14, W - 8, H - 20, 14).stroke({ width: 3, color: 0xc9a227 });
    for (const x of BOARD_X) {
      g.roundRect(x - CARD_W / 2, BOARD_Y - CARD_H / 2, CARD_W, CARD_H, 5).stroke({ width: 1, color: 0x54e0ff, alpha: 0.35 });
    }
    for (const x of HERO_X) {
      g.roundRect(x - CARD_W / 2, HERO_Y - CARD_H / 2, CARD_W, CARD_H, 5).stroke({ width: 1, color: 0x54e0ff, alpha: 0.35 });
    }
  }

  /** Zeichnet den Tisch neu; null blendet alle Karten aus. */
  render(table: PokerTable | null): void {
    this.#pot.text = table ? `Pot ${vc(table.pot)}` : '';
    const [hero, ...opponents] = table?.players ?? [];

    this.#heroLabel.text = hero ? `DU · ${vc(hero.committed)}${hero.folded ? ' · raus' : ''}` : 'DU';
    this.#hero.forEach((view, index) => {
      const card = hero?.hole[index];
      if (card) show(view, card, true);
      else view.view.visible = false;
    });

    this.#seatCards.forEach((cards, seat) => {
      const player = opponents[seat];
      this.#seats[seat]!.alpha = player?.folded ? 0.4 : 1;
      this.#seatLabels[seat]!.text = player ? `${player.id} · ${player.folded ? 'raus' : vc(player.committed)}` : '';
      cards.forEach((view, index) => {
        const card = player?.hole[index];
        if (!player || !card) {
          view.view.visible = false;
          return;
        }
        show(view, card, Boolean(table?.result) && !player.folded);
      });
    });

    this.#board.forEach((view, index) => {
      const card = table?.board[index];
      if (card) show(view, card, true);
      else view.view.visible = false;
    });
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    for (const view of this.#all) view.update(dt);
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#root.destroy({ children: true });
  }
}
