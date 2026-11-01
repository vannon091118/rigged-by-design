/** Eine Spielkarte in Pixi: Vorderseite, Rueckseite, 3D-Flip und Flug aus dem Schuh. */
import { Container, Graphics, Sprite, Text } from 'pixi.js';
import type { Card } from '../../core/rng/shoe';
import { ASSET } from '../assets/keys';
import { textureFor } from '../assets/textures';

export const CARD_W = 44;
export const CARD_H = 64;

const RED_SUITS = new Set(['♥', '♦']);
const INK = 0x1d1626;
const PAPER = 0xf8f4e9;

const easeOut = (t: number): number => 1 - (1 - t) ** 3;

function drawFace(g: Graphics): void {
  g.clear();
  g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5).fill({ color: PAPER });
  g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5).stroke({ width: 1, color: 0x6b5c85 });
}

function drawBack(g: Graphics): void {
  g.clear();
  g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5).fill({ color: 0x2a1030 });
  g.roundRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 5).stroke({ width: 1.2, color: 0xc9a227 });
  g.roundRect(-CARD_W / 2 + 4, -CARD_H / 2 + 4, CARD_W - 8, CARD_H - 8, 4)
    .stroke({ width: 0.8, color: 0xff2e88, alpha: 0.6 });
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 3; column += 1) {
      const x = -CARD_W / 2 + 10 + column * 12;
      const y = -CARD_H / 2 + 12 + row * 13;
      g.poly([x, y - 3, x + 3, y, x, y + 3, x - 3, y]).fill({ color: 0x54e0ff, alpha: 0.5 });
    }
  }
}

export class CardView {
  readonly view = new Container();
  readonly #face = new Graphics();
  readonly #back = new Graphics();
  readonly #backSprite: Sprite | null;
  readonly #rank = new Text({
    text: '',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 13, fontWeight: '800', fill: INK },
    resolution: 6,
  });
  readonly #suit = new Text({
    text: '',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 22, fontWeight: '700', fill: INK },
    resolution: 6,
  });
  #card: Card | null = null;
  #faceUp = false;
  #pending: Card | null = null;
  #pendingUp = false;
  #flipT = 1;
  #flipMs = 0;
  #move: { fx: number; fy: number; tx: number; ty: number; t: number; ms: number; delay: number } | null = null;
  #onDone: (() => void) | null = null;

  constructor() {
    drawBack(this.#back);
    const backTexture = textureFor(ASSET.cardBack);
    this.#backSprite = backTexture ? new Sprite(backTexture) : null;
    if (this.#backSprite) {
      this.#backSprite.anchor.set(0.5);
      this.#backSprite.width = CARD_W;
      this.#backSprite.height = CARD_H;
      this.#backSprite.visible = false;
      this.view.addChild(this.#backSprite);
    }
    this.#rank.anchor.set(0.5);
    this.#suit.anchor.set(0.5);
    this.#rank.position.set(-CARD_W / 2 + 9, -CARD_H / 2 + 10);
    this.#suit.position.set(0, 4);
    this.view.addChild(this.#face, this.#back, this.#rank, this.#suit);
    this.view.visible = false;
    this.#apply();
  }

  get card(): Card | null { return this.#card; }
  get faceUp(): boolean { return this.#faceUp; }
  get busy(): boolean { return this.#flipT < 1 || this.#move !== null; }

  #apply(): void {
    const showFront = this.#faceUp && this.#card !== null;
    this.#face.visible = showFront;
    this.#rank.visible = showFront;
    this.#suit.visible = showFront;
    this.#back.visible = !showFront && this.#backSprite === null;
    if (this.#backSprite) this.#backSprite.visible = !showFront;
    if (!this.#card) return;
    const colour = RED_SUITS.has(this.#card.suit) ? 0xc42033 : INK;
    this.#rank.text = this.#card.rank;
    this.#rank.style.fill = colour;
    this.#suit.text = this.#card.suit;
    this.#suit.style.fill = colour;
    if (showFront) drawFace(this.#face);
  }

  /** Setzt die Karte ohne Animation, z. B. beim ersten Aufbau. */
  set(card: Card, faceUp: boolean): void {
    this.#card = card;
    this.#faceUp = faceUp;
    this.#flipT = 1;
    this.#move = null;
    this.view.visible = true;
    this.view.scale.x = 1;
    this.#apply();
  }

  place(x: number, y: number): void {
    this.view.position.set(x, y);
    this.view.visible = true;
  }

  /** Karte fliegt vom Schuh auf ihren Platz; die Animation laeuft im Ticker. */
  flyTo(x: number, y: number, ms = 380, delay = 0): void {
    this.#move = { fx: this.view.x, fy: this.view.y, tx: x, ty: y, t: 0, ms, delay };
    this.view.visible = true;
  }

  /** Deckt auf oder zu und wechselt dabei die Karte. */
  flip(card: Card, faceUp = true, ms = 300): void {
    this.#pending = card;
    this.#pendingUp = faceUp;
    this.#flipT = 0;
    this.#flipMs = ms;
  }

  after(onDone: () => void): void { this.#onDone = onDone; }

  /** true, solange noch etwas laeuft. */
  update(dt: number): boolean {
    if (this.#move) {
      const move = this.#move;
      if (move.delay > 0) {
        move.delay -= dt;
      } else {
        move.t += dt;
        const p = Math.min(1, move.t / move.ms);
        const e = easeOut(p);
        this.view.x = move.fx + (move.tx - move.fx) * e;
        this.view.y = move.fy + (move.ty - move.fy) * e;
        if (p >= 1) this.#move = null;
      }
    }
    if (this.#flipT < 1) {
      this.#flipT = Math.min(1, this.#flipT + dt / Math.max(1, this.#flipMs));
      this.view.scale.x = Math.max(0.04, Math.abs(Math.cos(Math.PI * this.#flipT)));
      if (this.#flipT >= 0.5 && this.#pending) {
        this.#card = this.#pending;
        this.#faceUp = this.#pendingUp;
        this.#pending = null;
        this.#apply();
      }
      if (this.#flipT >= 1) this.view.scale.x = 1;
    }
    if (!this.busy && this.#onDone) {
      const done = this.#onDone;
      this.#onDone = null;
      done();
    }
    return this.busy;
  }

  destroy(): void { this.view.destroy({ children: true }); }
}
