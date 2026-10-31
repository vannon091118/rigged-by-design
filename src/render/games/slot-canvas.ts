/** Die Walzenbuehne: drei bis fuenf Walzen, echter Auslauf mit Bounce, Gewinnlinien und Muenzregen. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameResult } from '../../core/games/contracts';
import type { RiskColor } from '../../core/games/risk-card';
import { SLOT_SYMBOLS } from '../../core/games/engines/slot';
import { clampedReels } from '../../core/games/engines/slot-paytable';
import { Coins, drawPaylines } from './slot-fx';
import { GambleCard } from './slot-gamble';
import { CELL, PAD, makeReel, repaint, type Reel } from './slot-reels';
import { ROW_COUNT, settleOffset } from './slot-layout';

const SPEED = 0.0068;
const BAND_H = CELL * ROW_COUNT;
const STAGE_H = PAD * 2 + BAND_H;

export class SlotCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #reels: Reel[] = [];
  /** Walzenanzahl des Geraets: die Buehne zeigt, was die Engine dreht. */
  readonly #reelCount: number;
  readonly #stageW: number;
  readonly #lines = new Container();
  readonly #coins = new Coins();
  readonly #gamble: GambleCard;
  readonly #banner = new Text({
    text: 'FREISPIELE',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 30, fontWeight: '900', fill: 0xffd166 },
  });
  #bannerT = 0;
  #spinStart = 0;
  #onDone: (() => void) | null = null;
  #result: GameResult | null = null;
  #cycle = 0;

  constructor(app: Application, reels = 5) {
    this.#app = app;
    this.#reelCount = clampedReels(reels);
    this.#stageW = PAD * 2 + CELL * this.#reelCount;
    this.#gamble = new GambleCard(this.#root);
    this.#buildFrame();
    const symbols = SLOT_SYMBOLS;
    for (let index = 0; index < this.#reelCount; index += 1) {
      const reel = makeReel(index, PAD + index * CELL, symbols);
      const mask = new Graphics().rect(PAD + index * CELL, PAD, CELL, BAND_H).fill(0xffffff);
      this.#root.addChild(mask, reel.strip);
      reel.strip.mask = mask;
      this.#reels.push(reel);
    }
    this.#root.addChild(this.#lines, this.#coins.container);
    this.#banner.anchor.set(0.5);
    this.#banner.position.set(this.#stageW / 2, PAD + BAND_H / 2);
    this.#banner.alpha = 0;
    this.#root.addChild(this.#banner);
    app.stage.addChild(this.#root);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #buildFrame(): void {
    const frame = new Graphics();
    frame.roundRect(0, 0, this.#stageW, STAGE_H, 22).fill({ color: 0x0b0714, alpha: 0.96 });
    frame.roundRect(4, 4, this.#stageW - 8, STAGE_H - 8, 19).stroke({ width: 2, color: 0x2c1d4a });
    for (let index = 1; index < this.#reelCount; index += 1) {
      frame.rect(PAD + index * CELL - 1, PAD, 2, BAND_H).fill({ color: 0x2c1d4a, alpha: 0.7 });
    }
    this.#root.addChild(frame);
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / this.#stageW, screen.height / STAGE_H, 1.15);
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - this.#stageW * scale) / 2, (screen.height - STAGE_H * scale) / 2);
  }

  /** Startet den Auslauf fuer ein fertiges Rundenergebnis. */
  spin(result: GameResult, onDone: () => void): void {
    this.#result = result;
    this.#onDone = onDone;
    this.#spinStart = 0;
    this.#bannerT = 0;
    this.#banner.alpha = 0;
    this.#lines.removeChildren().forEach((child) => child.destroy());
    this.#coins.clear();
    this.#reels.forEach((reel, index) => {
      reel.spinning = true;
      reel.stopping = false;
      reel.bounce = 0;
      reel.target = (result.grid?.[index] ?? ['BOOK', 'SCARAB', 'ANKH']).slice(0, ROW_COUNT);
      reel.cells.forEach((cell, slot) => repaint(cell, SLOT_SYMBOLS[(index * 3 + slot + this.#cycle) % SLOT_SYMBOLS.length]!));
    });
    this.#cycle += 1;
  }

  /** Deckt die Risiko-Karte auf: erst Ruecken, dann Farbe. */
  gamble(card: RiskColor, won: boolean): void {
    this.#gamble.show(card, won, this.#stageW / 2, PAD + BAND_H / 2);
  }

  #land(reel: Reel, reelIndex: number): void {
    reel.stopping = false;
    reel.spinning = false;
    reel.offset = 0;
    reel.bounce = 1;
    reel.rows.forEach((_, slot) => { reel.rows[slot] = slot; });
    reel.cells.forEach((cell, slot) => {
      cell.position.y = PAD + slot * CELL + CELL * 0.09;
      repaint(cell, reel.target[slot] ?? 'BOOK');
    });
    const result = this.#result;
    if (!result) return;
    if (reelIndex === this.#reelCount - 1) {
      const wins = result.wins ?? [];
      if (wins.length) this.#lines.addChild(drawPaylines(wins, CELL, PAD, this.#reelCount));
      if (result.payout > 0 || wins.length) this.#coins.burst(this.#stageW, 26);
      if ((result.books ?? 0) >= 3) {
        this.#bannerT = 0.001;
      }
      const done = this.#onDone;
      this.#onDone = null;
      done?.();
    }
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    this.#spinStart += dt;
    this.#reels.forEach((reel, index) => {
      if (reel.spinning) {
        if (this.#spinStart > 380 + index * 165) reel.stopping = true;
        reel.offset += SPEED * dt;
        while (reel.offset >= 1) {
          reel.offset -= 1;
          reel.rows.forEach((row, slot) => { reel.rows[slot] = row - 1; });
          const top = reel.cells.findIndex((_, slot) => reel.rows[slot]! < 0);
          if (top >= 0) {
            reel.rows[top] = 3;
            repaint(reel.cells[top]!, SLOT_SYMBOLS[(this.#cycle * 7 + top * 3 + index) % SLOT_SYMBOLS.length]!);
          }
          if (reel.stopping) {
            this.#land(reel, index);
            break;
          }
        }
        if (reel.spinning) {
          reel.cells.forEach((cell, slot) => {
            cell.position.y = PAD + (reel.rows[slot]! - reel.offset) * CELL + CELL * 0.09;
          });
        }
      } else if (reel.bounce > 0) {
        reel.bounce = Math.max(0, reel.bounce - dt / 320);
        reel.strip.y = -settleOffset(1 - reel.bounce) * CELL * 0.06;
      }
    });
    this.#coins.update(dt);
    if (this.#bannerT > 0) {
      this.#bannerT += dt;
      this.#banner.alpha = Math.max(0, 1 - Math.abs(this.#bannerT - 500) / 500);
      if (this.#bannerT > 1000) this.#bannerT = 0;
    }
    this.#gamble.update(dt);
  };

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#coins.clear();
    this.#root.destroy({ children: true });
  }
}
