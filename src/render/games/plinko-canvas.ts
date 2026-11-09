/** Das Plinko-Brett als Pixi-Buehne: Stifte, Deflektoren, Taschen und die echte Ballbahn. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { PlinkoConfig, PlinkoDrop } from '../../core/games/plinko-config';
import { plinkoPaytable } from '../../core/games/plinko-config';
import { Emitter } from '../fx/emitter';
import { PEG_COLOR, payoutArt, pegArt } from './plinko-assets';
import {
  BALL_RADIUS, FLOOR_BASE, PEG_RADIUS, TOP, WIDTH, boardPegs, floorOf, pocketCells,
  type Peg, type PocketCell,
} from './plinko-board-geometry';

interface Ball {
  readonly gfx: Graphics;
  readonly track: readonly { readonly x: number; readonly y: number }[];
  index: number;
  pocket: number | null;
  rung: Set<number>;
  landed: boolean;
}

interface Wave {
  readonly gfx: Graphics;
  life: number;
}

export class PlinkoCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #board = new Container();
  readonly #balls = new Container();
  readonly #fx = new Emitter();
  readonly #waves: Wave[] = [];
  #pegs: Peg[] = [];
  #tracks: Ball[] = [];
  #floorY = FLOOR_BASE;
  #pocketCells: readonly PocketCell[] = [];
  readonly #flashes: Wave[] = [];
  #onDone: (() => void) | null = null;
  #elapsed = 0;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#root.addChild(this.#board, this.#balls, this.#fx.container);
    app.ticker.add(this.#tick);
    this.layout();
  }

  /** Zeichnet Brett, Taschen und Beschriftung fuer die aktuelle Konfiguration. */
  build(config: PlinkoConfig, rows: number): void {
    this.#board.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.#pegs = boardPegs(config, rows);
    this.#floorY = floorOf(rows);
    const frame = new Graphics();
    frame.roundRect(-6, -4, WIDTH + 12, this.#floorY + 40, 6).fill({ color: 0x0a0614, alpha: 0.92 });
    frame.roundRect(-6, -4, WIDTH + 12, this.#floorY + 40, 6).stroke({ width: 0.8, color: 0x2c1d4a });
    frame.rect(4, TOP, 0.7, this.#floorY - TOP).fill({ color: 0x3a2a5c, alpha: 0.8 });
    frame.rect(WIDTH - 4, TOP, 0.7, this.#floorY - TOP).fill({ color: 0x3a2a5c, alpha: 0.8 });
    this.#board.addChild(frame);
    for (const peg of this.#pegs) {
      const radius = peg.kind === 'NORMAL_PEG' ? PEG_RADIUS : PEG_RADIUS * 1.5;
      this.#board.addChild(pegArt(peg, radius));
    }
    for (const side of [12, WIDTH - 12]) {
      const wall = new Graphics().circle(side, this.#floorY - 12, 3.4).fill({ color: 0x54e0ff, alpha: 0.85 });
      this.#board.addChild(wall);
    }
    this.#pocketCells = pocketCells(config.pocketWidths, plinkoPaytable(config.pocketCount));
    this.#pocketCells.forEach((cell) => {
      const { left, right, width, tint } = cell;
      const pocket = new Graphics()
        .roundRect(left + 0.6, this.#floorY, width - 1.2, 16, 1.8)
        .fill({ color: tint, alpha: 0.2 })
        .stroke({ width: 0.4, color: tint, alpha: 0.9 });
      const payout = payoutArt(left, width, this.#floorY, cell.payBps);
      if (payout) this.#board.addChild(payout);
      // Die Buehne skaliert um Faktor 3: ohne eigene Aufloesung wird die kleine
      // Schrift beim Hochskalieren zu Brei. resolution rastert sie passend groß.
      const label = new Text({
        text: cell.label,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 3.6, fontWeight: '700', fill: 0xffffff },
        resolution: 8,
      });
      label.anchor.set(0.5);
      // Beschriftung unten in der Tasche: oben landet der Ball, nichts ueberdeckt sich.
      label.position.set((left + right) / 2, this.#floorY + 11.6);
      this.#board.addChild(pocket, label);
    });
    this.layout();
  }

  layout(): void {
    const screen = this.#app.screen;
    const height = this.#floorY + 50;
    const scale = Math.min(screen.width / (WIDTH + 20), screen.height / height);
    this.#root.scale.set(scale);
    this.#root.position.set((screen.width - (WIDTH + 12) * scale) / 2 + 6 * scale, (screen.height - height * scale) / 2);
  }

  /** Spielt eine aufgezeichnete Bahn ab; die Tasche stammt aus dem Kern. */
  play(drop: PlinkoDrop, onDone: () => void): void {
    this.#clear();
    this.#onDone = onDone;
    this.#elapsed = 0;
    drop.tracks.forEach((track, order) => {
      const gfx = new Graphics();
      const tint = [0x00ffcc, 0xff2e88, 0xffd166][order % 3]!;
      gfx.circle(0, 0, BALL_RADIUS * 1.5).fill({ color: tint, alpha: 0.25 });
      gfx.circle(0, 0, BALL_RADIUS).fill({ color: tint });
      this.#balls.addChild(gfx);
      this.#tracks.push({ gfx, track, index: 0, pocket: drop.pockets[order] ?? null, rung: new Set(), landed: false });
    });
  }

  #clear(): void {
    for (const ball of this.#tracks) ball.gfx.destroy();
    this.#tracks = [];
    for (const wave of this.#waves) wave.gfx.destroy();
    this.#waves.length = 0;
    for (const flash of this.#flashes) flash.gfx.destroy();
    this.#flashes.length = 0;
    this.#fx.clear();
    this.#onDone = null;
  }

  #tick = (): void => {
    const dt = Math.min(48, this.#app.ticker.deltaMS);
    this.#elapsed += dt;
    let running = false;
    for (const ball of this.#tracks) {
      if (ball.index < ball.track.length - 1) {
        ball.index = Math.min(ball.track.length - 1, ball.index + dt / (1000 / 60));
        running = true;
      }
      const point = ball.track[Math.floor(ball.index)] ?? ball.track[ball.track.length - 1];
      if (point) ball.gfx.position.set(point.x, point.y);
      this.#contact(ball, point);
      if (ball.index >= ball.track.length - 1) {
        ball.gfx.position.set(point?.x ?? WIDTH / 2, this.#floorY + 4.6);
        if (!ball.landed) this.#land(ball);
      }
    }
    this.#fx.update(dt);
    this.#updateWaves(dt);
    this.#updateFlashes(dt);
    if (!running && this.#tracks.length && this.#onDone && this.#elapsed > 0) {
      const done = this.#onDone;
      this.#onDone = null;
      done();
    }
  };

  /** Einschlag: die getroffene Tasche leuchtet kurz auf, ein Ring laeuft nach aussen. */
  #land(ball: Ball): void {
    ball.landed = true;
    if (ball.pocket === null) return;
    const cell = this.#pocketCells[ball.pocket];
    if (!cell) return;
    const flash = new Graphics()
      .roundRect(cell.left + 0.6, this.#floorY, cell.width - 1.2, 16, 1.8)
      .fill({ color: 0xffffff, alpha: 0.5 });
    this.#board.addChild(flash);
    this.#flashes.push({ gfx: flash, life: 1 });
    const ring = new Graphics().circle((cell.left + cell.right) / 2, this.#floorY + 6, 6);
    ring.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    this.#balls.addChild(ring);
    this.#waves.push({ gfx: ring, life: 1 });
    this.#fx.burst('coin-burst', (cell.left + cell.right) / 2, this.#floorY + 6,
      { count: cell.payBps > 0 ? 12 : 6, size: cell.payBps > 0 ? 12 : 14, tint: cell.payBps > 0 ? 0xffffff : 0x6a5a82 });
  }

  /** Stiftkontakt: einmal pro Stift und Ball eine Schockwelle. */
  #contact(ball: Ball, point: { x: number; y: number } | undefined): void {
    if (!point) return;
    this.#pegs.forEach((peg, index) => {
      if (ball.rung.has(index)) return;
      if (Math.hypot(point.x - peg.x, point.y - peg.y) > PEG_RADIUS * 2.4 + BALL_RADIUS) return;
      ball.rung.add(index);
      const ring = new Graphics().circle(peg.x, peg.y, PEG_RADIUS);
      ring.stroke({ width: 0.6, color: PEG_COLOR[peg.kind], alpha: 1 });
      this.#balls.addChild(ring);
      this.#waves.push({ gfx: ring, life: 1 });
      this.#fx.burst('plinko-impact', peg.x, peg.y, { count: 2, size: 5 });
    });
  }

  #updateFlashes(dt: number): void {
    for (let index = this.#flashes.length - 1; index >= 0; index -= 1) {
      const flash = this.#flashes[index]!;
      flash.life -= dt / 320;
      if (flash.life <= 0) {
        flash.gfx.destroy();
        this.#flashes.splice(index, 1);
        continue;
      }
      flash.gfx.alpha = flash.life * 0.8;
    }
  }

  #updateWaves(dt: number): void {
    for (let index = this.#waves.length - 1; index >= 0; index -= 1) {
      const wave = this.#waves[index]!;
      wave.life -= dt / 420;
      if (wave.life <= 0) {
        wave.gfx.destroy();
        this.#waves.splice(index, 1);
        continue;
      }
      wave.gfx.scale.set(1 + (1 - wave.life) * 3.2);
      wave.gfx.alpha = wave.life;
    }
  }

  destroy(): void {
    this.#app.ticker.remove(this.#tick);
    this.#clear();
    this.#root.destroy({ children: true });
  }
}
