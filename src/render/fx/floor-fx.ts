/** Partikel und Shake auf der Pixi-Buehne: Weltkoordinaten, ein Ticker, kein React. */
import { Container } from 'pixi.js';
import { on } from '../../core/sim/events';
import { TILE } from '../../core/sim/types';
import { ROLE } from '../art-tokens';
import { playPinRun, playSfx } from '../sound-fx';
import { Emitter } from './emitter';

const SHAKE_MS = 220;

export class FloorFx {
  readonly root = new Container();
  readonly #emitter = new Emitter();
  readonly #locate: () => { x: number; y: number };
  readonly #unsubscribe: (() => void)[] = [];
  #shakeUntil = 0;
  #shakeAmp = 0;
  #last = -1;

  constructor(locate: () => { x: number; y: number }) {
    this.#locate = locate;
    this.root.eventMode = 'none';
    this.root.addChild(this.#emitter.container);
  }

  /** Meldet sich an die Spielereignisse; die Szene liefert nur die Position. */
  start(): void {
    this.#unsubscribe.push(
      on('slot:jackpot', () => {
        playSfx('win');
        const p = this.#locate();
        this.#emitter.burst('jackpot-burst', p.x, p.y, { count: 28, size: 16 });
        this.shake(8);
      }),
      on('slot:chargeDischarge', () => {
        playSfx('coin');
        const p = this.#locate();
        this.#emitter.burst('machine-sparks', p.x, p.y, { count: 14, size: 10 });
        this.shake(4);
      }),
      on('plinko:drop', ({ pockets }: { pockets: number[] }) => {
        playPinRun(pockets.length);
        const p = this.#locate();
        this.#emitter.burst('coin-burst', p.x, p.y, { count: 18, size: 12 });
        this.shake(5);
      }),
      on('dispute:start', ({ x, y }: { x: number; y: number }) => {
        playSfx('brawl');
        this.#emitter.burst('coin-burst', (x + 0.5) * TILE, (y + 0.6) * TILE, { count: 20, size: 10, tint: ROLE.danger });
        this.shake(10);
      }),
    );
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
    this.#shakeAmp = 0;
    this.#shakeUntil = 0;
  }

  destroy(): void {
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    this.#unsubscribe.length = 0;
    this.#emitter.destroy();
    this.root.destroy({ children: false });
  }
}
