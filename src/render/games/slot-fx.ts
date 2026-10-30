/** Effekte ueber den Walzen: Neon-Linien fuer Treffer und eine Muenzfontaene beim Gewinn. */
import { Container, Graphics } from 'pixi.js';
import type { SlotLineWin } from '../../core/games/engines/slot';
import { linePoints, paylineAt } from './slot-layout';

const PALETTE = [0x00ffcc, 0xff2e88, 0xffd166, 0xb06bff, 0x6ee7ff] as const;

const lineColor = (index: number): number => PALETTE[index % PALETTE.length]!;

/** Zeichnet jede bezahlte Linie als Neon-Strahl durch die getroffenen Zellen. */
export function drawPaylines(wins: readonly SlotLineWin[], cell: number, pad: number): Graphics {
  const layer = new Graphics();
  wins.forEach((win, order) => {
    const points = linePoints(paylineAt(win.line), cell, pad);
    const color = lineColor(order);
    const path = (width: number, alpha: number): void => {
      points.forEach((point, index) => {
        if (index === 0) layer.moveTo(point.x, point.y);
        else layer.lineTo(point.x, point.y);
      });
      layer.stroke({ width, color, alpha, cap: 'round', join: 'round' });
    };
    path(cell * 0.16, 0.14);
    path(cell * 0.05, 0.95);
  });
  return layer;
}

interface Coin {
  readonly gfx: Graphics;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spin: number;
}

/** Muenzregen: faellt mit Schwerkraft, dreht sich und raeumt sich selbst auf. */
export class Coins {
  readonly container = new Container();
  #coins: Coin[] = [];
  #seed = 1;

  burst(width: number, count: number): void {
    for (let index = 0; index < count; index += 1) {
      this.#seed = (this.#seed * 1103515245 + 12345) % 2147483648;
      const rand = this.#seed / 2147483648;
      const radius = 5 + Math.round(rand * 7);
      const gfx = new Graphics();
      gfx.circle(0, 0, radius).fill({ color: 0xffd166, alpha: 0.95 });
      gfx.circle(0, 0, radius * 0.62).fill({ color: 0xb07a1f, alpha: 0.9 });
      gfx.x = rand * width;
      gfx.y = -20 - index * 4;
      this.container.addChild(gfx);
      this.#coins.push({ gfx, x: gfx.x, y: gfx.y, vx: (rand - 0.5) * 0.16, vy: 0.18 + rand * 0.12, spin: (rand - 0.5) * 0.02 });
    }
  }

  update(deltaMS: number): void {
    if (!this.#coins.length) return;
    const keep: Coin[] = [];
    for (const coin of this.#coins) {
      coin.vy += 0.0016 * deltaMS;
      coin.x += coin.vx * deltaMS;
      coin.y += coin.vy * deltaMS;
      coin.gfx.x = coin.x;
      coin.gfx.y = coin.y;
      coin.gfx.rotation += coin.spin * deltaMS;
      coin.gfx.alpha = Math.max(0, 1 - (coin.y - 420) / 160);
      if (coin.y > 640) {
        coin.gfx.destroy();
        continue;
      }
      keep.push(coin);
    }
    this.#coins = keep;
  }

  clear(): void {
    for (const coin of this.#coins) coin.gfx.destroy();
    this.#coins = [];
  }
}
