/** Die Walzenbuehne: fuenf Walzen, echter Auslauf mit Bounce, Gewinnlinien und Muenzregen. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { GameResult } from '../../core/games/contracts';
import type { RiskColor } from '../../core/games/risk-card';
import { SLOT_SYMBOLS } from '../../core/games/engines/slot';
import { Coins, drawPaylines } from './slot-fx';
import { drawSlotSymbol } from './slot-symbols-art';
import { REEL_COUNT, ROW_COUNT, settleOffset } from './slot-layout';

const CELL = 116;
const PAD = 18;
const SPEED = 0.0068;
const BAND_H = CELL * ROW_COUNT;
const STAGE_W = PAD * 2 + CELL * REEL_COUNT;
const STAGE_H = PAD * 2 + BAND_H;

interface Reel {
  readonly strip: Container;
  readonly cells: Container[];
  readonly rows: number[];
  offset: number;
  spinning: boolean;
  stopping: boolean;
  bounce: number;
  target: string[];
}

/** Ein einzelner Auslauf pro Walze: laufen, umlaufen, auf dem Ziel einrasten. */
function makeReel(index: number, symbols: readonly string[]): Reel {
  const strip = new Container();
  const cells: Container[] = [];
  const rows = [0, 1, 2, 3];
  for (let slot = 0; slot < 4; slot += 1) {
    const cell = new Container();
    const art = drawSlotSymbol(symbols[(index + slot) % symbols.length]!, CELL * 0.82);
    art.position.set(0, 0);
    cell.addChild(art);
    cell.position.set(PAD + index * CELL + CELL * 0.09, PAD + rows[slot]! * CELL + CELL * 0.09);
    cells.push(cell);
    strip.addChild(cell);
  }
  return { strip, cells, rows, offset: 0, spinning: false, stopping: false, bounce: 0, target: [] };
}

/** Tauscht das Symbol einer Zelle aus, ohne die Zelle selbst zu ersetzen. */
function repaint(cell: Container, symbol: string): void {
  for (const child of cell.removeChildren()) child.destroy();
  const art = drawSlotSymbol(symbol, CELL * 0.82);
  art.position.set(0, 0);
  cell.addChild(art);
}

export class SlotCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #reels: Reel[] = [];
  readonly #lines = new Container();
  readonly #coins = new Coins();
  readonly #banner = new Text({
    text: 'FREISPIELE',
    style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 30, fontWeight: '900', fill: 0xffd166 },
  });
  #bannerT = 0;
  #gamble: Container | null = null;
  #gambleBack: Graphics | null = null;
  #gambleCaption: Text | null = null;
  #gambleT = 0;
  #gambleFace: RiskColor | null = null;
  #spinStart = 0;
  #onDone: (() => void) | null = null;
  #result: GameResult | null = null;
  #cycle = 0;

  constructor(app: Application) {
    this.#app = app;
    this.#buildFrame();
    const symbols = SLOT_SYMBOLS;
    for (let index = 0; index < REEL_COUNT; index += 1) {
      const reel = makeReel(index, symbols);
      const mask = new Graphics().rect(PAD + index * CELL, PAD, CELL, BAND_H).fill(0xffffff);
      this.#root.addChild(mask, reel.strip);
      reel.strip.mask = mask;
      this.#reels.push(reel);
    }
    this.#root.addChild(this.#lines, this.#coins.container);
    this.#banner.anchor.set(0.5);
    this.#banner.position.set(STAGE_W / 2, PAD + BAND_H / 2);
    this.#banner.alpha = 0;
    this.#root.addChild(this.#banner);
    app.stage.addChild(this.#root);
    app.ticker.add(this.#tick);
    this.layout();
  }

  #buildFrame(): void {
    const frame = new Graphics();
    frame.roundRect(0, 0, STAGE_W, STAGE_H, 22).fill({ color: 0x0b0714, alpha: 0.96 });
    frame.roundRect(4, 4, STAGE_W - 8, STAGE_H - 8, 19).stroke({ width: 2, color: 0x2c1d4a });
    for (let index = 1; index < REEL_COUNT; index += 1) {
      frame.rect(PAD + index * CELL - 1, PAD, 2, BAND_H).fill({ color: 0x2c1d4a, alpha: 0.7 });
    }
    this.#root.addChild(frame);
  }

  layout(): void {
    const screen = this.#app.screen;
    const scale = Math.min(screen.width / STAGE_W, screen.height / STAGE_H, 1.15);
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - STAGE_W * scale) / 2, (screen.height - STAGE_H * scale) / 2);
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
    this.#gamble?.destroy({ children: true });
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
    box.position.set(STAGE_W / 2, PAD + BAND_H / 2);
    box.scale.set(0.9);
    box.alpha = 0;
    this.#root.addChild(box);
    this.#gamble = box;
    this.#gambleBack = back;
    this.#gambleCaption = label;
    this.#gambleT = 0;
    this.#gambleFace = card;
    face.alpha = 0;
    label.alpha = 0;
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
    if (reelIndex === REEL_COUNT - 1) {
      const wins = result.wins ?? [];
      if (wins.length) this.#lines.addChild(drawPaylines(wins, CELL, PAD));
      if (result.payout > 0 || wins.length) this.#coins.burst(STAGE_W, 26);
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
    this.#updateGamble(dt);
  };

  #updateGamble(dt: number): void {
    const box = this.#gamble;
    if (!box) return;
    this.#gambleT += dt;
    const flip = 130;
    const opening = Math.min(1, this.#gambleT / flip);
    if (this.#gambleT < flip) {
      box.alpha = opening;
      box.scale.x = 0.9 * opening;
      return;
    }
    box.alpha = 1;
    if (this.#gambleT < flip * 2) {
      box.scale.x = 1 - (this.#gambleT - flip) / flip;
      return;
    }
    box.scale.x = Math.min(1, (this.#gambleT - flip * 2) / flip);
    if (this.#gambleBack) this.#gambleBack.alpha = 0;
    if (this.#gambleCaption) this.#gambleCaption.alpha = 1;
    if (this.#gambleFace && this.#gambleT > flip * 4) {
      box.alpha = Math.max(0, 1 - (this.#gambleT - flip * 4) / 400);
      if (this.#gambleT > flip * 5) {
        box.destroy({ children: true });
        this.#gamble = null;
        this.#gambleBack = null;
        this.#gambleCaption = null;
      }
    }
  }

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#coins.clear();
    this.#root.destroy({ children: true });
  }
}
