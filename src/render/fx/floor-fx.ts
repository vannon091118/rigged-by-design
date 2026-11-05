/** Partikel, Licht und Shake auf der Pixi-Buehne: Weltkoordinaten, ein Ticker, kein React. */
import { Container, Graphics } from 'pixi.js';
import { Emitter, setParticleLimit, type BurstOptions } from './emitter';

const SHAKE_MS = 220;

interface Flash {
  readonly g: Graphics;
  readonly ms: number;
  start: number;
}

export class FloorFx {
  readonly root = new Container();
  readonly #emitter = new Emitter();
  readonly #flashes: Flash[] = [];
  readonly #pool: Graphics[] = [];
  #shakeUntil = 0;
  #shakeAmp = 0;
  #lightLimit = 6;
  #last = -1;

  constructor() {
    this.root.eventMode = 'none';
    this.root.addChild(this.#emitter.container);
  }

  burst(name: string, x: number, y: number, options: BurstOptions = {}): void {
    this.#emitter.burst(name, x, y, options);
  }

  /** Kurzes Licht an einem Weltpunkt; der Start faellt in den naechsten Frame. */
  flash(x: number, y: number, color: number, radius: number, ms: number): void {
    if (ms <= 0 || this.#flashes.length >= this.#lightLimit) return;
    const g = this.#pool.pop() ?? new Graphics();
    g.clear();
    g.circle(0, 0, radius).fill({ color, alpha: 0.16 });
    g.circle(0, 0, radius * 0.55).fill({ color, alpha: 0.22 });
    g.circle(0, 0, radius).stroke({ width: 2, color, alpha: 0.45 });
    g.position.set(x, y);
    g.alpha = 1;
    g.visible = true;
    this.root.addChild(g);
    this.#flashes.push({ g, ms, start: -1 });
  }

  /** Budget des Performance-Governors: Partikel und gleichzeitige Lichter. */
  setBudget(particles: number, lights: number): void {
    setParticleLimit(particles);
    this.#lightLimit = Math.max(0, lights);
    while (this.#flashes.length > this.#lightLimit) {
      const flash = this.#flashes.pop();
      if (!flash) break;
      flash.g.visible = false;
      this.#pool.push(flash.g);
    }
  }

  shake(strength: number): void {
    this.#shakeAmp = Math.max(this.#shakeAmp, strength);
    this.#shakeUntil = 0;
    this.#shakeUntil = (this.#last < 0 ? 0 : this.#last) + SHAKE_MS;
  }

  update(now: number): void {
    const delta = this.#last < 0 ? 16 : Math.min(80, now - this.#last);
    this.#last = now;
    this.#emitter.update(delta);
    for (let index = this.#flashes.length - 1; index >= 0; index -= 1) {
      const flash = this.#flashes[index]!;
      if (flash.start < 0) flash.start = now;
      const t = (now - flash.start) / flash.ms;
      if (t >= 1) {
        flash.g.visible = false;
        this.#pool.push(flash.g);
        this.#flashes.splice(index, 1);
        continue;
      }
      flash.g.alpha = 1 - t;
    }
  }

  /** Versatz fuer die Kamera; 0, wenn kein Shake laeuft. */
  offset(now: number): { x: number; y: number } {
    if (this.#shakeUntil <= now || this.#shakeAmp <= 0) {
      this.#shakeAmp = 0;
      return { x: 0, y: 0 };
    }
    const left = (this.#shakeUntil - now) / SHAKE_MS;
    const amp = this.#shakeAmp * left;
    return { x: Math.sin(now * 0.09) * amp, y: Math.cos(now * 0.13) * amp * 0.7 };
  }

  clear(): void {
    this.#emitter.clear();
    this.#hideFlashes();
    this.#shakeAmp = 0;
    this.#shakeUntil = 0;
  }

  destroy(): void {
    this.#emitter.destroy();
    this.#hideFlashes();
    for (const g of this.#pool) g.destroy();
    this.#pool.length = 0;
    this.root.destroy({ children: false });
  }

  #hideFlashes(): void {
    for (const flash of this.#flashes) {
      flash.g.visible = false;
      this.#pool.push(flash.g);
    }
    this.#flashes.length = 0;
  }
}
