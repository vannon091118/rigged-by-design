// @loc-exception: Das Plinko-Brett haelt Brettgeometrie, Bahnwiedergabe, Trefferwellen, Taschen-Feedback und die Rahmenbeschriftung in einem Ticker; getrennt waeren Frame-Grenzen und Peg-Indizes doppelt.
/** Das Plinko-Brett als Pixi-Buehne: Stifte, Deflektoren, Taschen und die echte Ballbahn. */
import { Application, Container, Graphics, Text } from 'pixi.js';
import type { PegKind, PlinkoConfig, PlinkoDrop } from '../../core/games/plinko-config';
import { plinkoPaytable } from '../../core/games/plinko-config';

const WIDTH = 100;
const TOP = 8;
const ROW_GAP = 11;
const PEG_RADIUS = 1.8;
const BALL_RADIUS = 2.2;
const PEG_COLUMNS = 8;
const FLOOR_BASE = 120;

const PEG_COLOR: Readonly<Record<PegKind, number>> = {
  NORMAL_PEG: 0x6f5b8c,
  BOUNCY_PEG: 0x54e0ff,
  STICKY_PEG: 0xffd166,
  MAGNET_PEG: 0xff2e88,
  SPLIT_PEG: 0x8ff0c6,
};

interface Peg {
  readonly x: number;
  readonly y: number;
  readonly kind: PegKind;
}

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

const floorOf = (rows: number): number => FLOOR_BASE + (rows - 8) * ROW_GAP;

/** Baut die Stiftpositionen genau so, wie es die Simulation tut. */
function boardPegs(config: PlinkoConfig, rows: number): Peg[] {
  const special = new Map(config.pegs.map((peg) => [`${peg.row}:${peg.column}`, peg.kind]));
  const pegs: Peg[] = [];
  for (let row = 0; row < rows; row += 1) {
    const y = 26 + row * ROW_GAP;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < PEG_COLUMNS; column += 1) {
      const x = 10 + offset + column * 11;
      if (x > WIDTH - 6) continue;
      pegs.push({ x, y, kind: special.get(`${row}:${column}`) ?? 'NORMAL_PEG' });
    }
  }
  return pegs;
}

export class PlinkoCanvas {
  readonly #app: Application;
  readonly #root = new Container();
  readonly #board = new Container();
  readonly #balls = new Container();
  readonly #waves: Wave[] = [];
  #pegs: Peg[] = [];
  #tracks: Ball[] = [];
  #floorY = FLOOR_BASE;
  #pockets: readonly number[] = [];
  #pocketGfx: Graphics[] = [];
  readonly #flashes: Wave[] = [];
  #pocketEdges: { readonly left: number; readonly right: number }[] = [];
  #onDone: (() => void) | null = null;
  #elapsed = 0;

  constructor(app: Application) {
    this.#app = app;
    app.stage.addChild(this.#root);
    this.#root.addChild(this.#board, this.#balls);
    app.ticker.add(this.#tick);
    this.layout();
  }

  /** Zeichnet Brett, Taschen und Beschriftung fuer die aktuelle Konfiguration. */
  build(config: PlinkoConfig, rows: number): void {
    this.#board.removeChildren().forEach((child) => child.destroy({ children: true }));
    this.#pegs = boardPegs(config, rows);
    this.#floorY = floorOf(rows);
    this.#pockets = plinkoPaytable(config.pocketCount);
    const frame = new Graphics();
    frame.roundRect(-6, -4, WIDTH + 12, this.#floorY + 40, 6).fill({ color: 0x0a0614, alpha: 0.92 });
    frame.roundRect(-6, -4, WIDTH + 12, this.#floorY + 40, 6).stroke({ width: 0.8, color: 0x2c1d4a });
    frame.rect(4, TOP, 0.7, this.#floorY - TOP).fill({ color: 0x3a2a5c, alpha: 0.8 });
    frame.rect(WIDTH - 4, TOP, 0.7, this.#floorY - TOP).fill({ color: 0x3a2a5c, alpha: 0.8 });
    this.#board.addChild(frame);
    for (const peg of this.#pegs) {
      const g = new Graphics();
      const radius = peg.kind === 'NORMAL_PEG' ? PEG_RADIUS : PEG_RADIUS * 1.5;
      g.circle(peg.x, peg.y, radius).fill(PEG_COLOR[peg.kind]);
      if (peg.kind !== 'NORMAL_PEG') g.circle(peg.x, peg.y, radius + 0.7).stroke({ width: 0.3, color: 0xffffff, alpha: 0.5 });
      this.#board.addChild(g);
    }
    for (const side of [12, WIDTH - 12]) {
      const wall = new Graphics().circle(side, this.#floorY - 12, 3.4).fill({ color: 0x54e0ff, alpha: 0.85 });
      this.#board.addChild(wall);
    }
    let edge = 0;
    this.#pocketGfx = [];
    this.#pocketEdges = [];
    config.pocketWidths.forEach((width, index) => {
      const left = edge;
      edge += width;
      this.#pocketEdges[index] = { left, right: edge };
      const payBps = this.#pockets[index] ?? 0;
      const tint = payBps === 0 ? 0x2a1030 : payBps >= 50_000 ? 0xffd166 : payBps >= 20_000 ? 0xff2e88 : 0x6f5b8c;
      const pocket = new Graphics()
        .roundRect(left + 0.6, this.#floorY, width - 1.2, 16, 1.8)
        .fill({ color: tint, alpha: 0.32 })
        .stroke({ width: 0.4, color: tint, alpha: 0.9 });
      // Die Buehne skaliert um Faktor 3: ohne eigene Aufloesung wird die kleine
      // Schrift beim Hochskalieren zu Brei. resolution rastert sie passend groß.
      const label = new Text({
        text: `${(payBps / 10_000).toFixed(1).replace('.', ',')}x`,
        style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: 3.6, fontWeight: '700', fill: 0xffffff },
        resolution: 8,
      });
      label.anchor.set(0.5);
      // Beschriftung unten in der Tasche: oben landet der Ball, nichts ueberdeckt sich.
      label.position.set((left + edge) / 2, this.#floorY + 11.6);
      this.#pocketGfx[index] = pocket;
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
    const edges = this.#pocketEdges[ball.pocket];
    const pocket = this.#pocketGfx[ball.pocket];
    if (!edges || !pocket) return;
    const flash = new Graphics()
      .roundRect(edges.left + 0.6, this.#floorY, edges.right - edges.left - 1.2, 16, 1.8)
      .fill({ color: 0xffffff, alpha: 0.5 });
    this.#board.addChild(flash);
    this.#flashes.push({ gfx: flash, life: 1 });
    const ring = new Graphics().circle((edges.left + edges.right) / 2, this.#floorY + 6, 6);
    ring.stroke({ width: 1, color: 0xffffff, alpha: 0.8 });
    this.#balls.addChild(ring);
    this.#waves.push({ gfx: ring, life: 1 });
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
