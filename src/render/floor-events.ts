/** Die eine Tabelle: Ereignis -> Burst, Ton, Licht, Shake und Anker. */
import { on } from '../core/sim/events';
import { TILE, type Furniture } from '../core/sim/types';
import type { GameView } from '../store/types';
import { ROLE } from './art-tokens';
import type { FloorFx } from './fx/floor-fx';
import { playPinRun, playSfx, type SfxKind } from './sound-fx';

interface Spec {
  readonly burst?: string;
  readonly count?: number;
  readonly size?: number;
  readonly tint?: number;
  readonly sfx?: SfxKind;
  readonly pins?: boolean;
  readonly light?: { readonly color: number; readonly radius: number; readonly ms: number };
  readonly shake?: number;
}

/** Acht Ereignisse, je eine Zeile: kein Ton ohne sichtbares Pendant. */
const SPECS: Readonly<Record<string, Spec>> = {
  'slot:jackpot': {
    burst: 'jackpot-burst', count: 30, size: 16, sfx: 'win', shake: 6,
    light: { color: ROLE.value, radius: 96, ms: 620 },
  },
  'money:bigPayout': {
    burst: 'coin-burst', count: 22, size: 12, sfx: 'coin',
    light: { color: ROLE.warning, radius: 74, ms: 450 },
  },
  'dispute:start': {
    burst: 'smoke-puff', count: 16, size: 15, sfx: 'brawl', shake: 10,
    light: { color: ROLE.danger, radius: 86, ms: 700 },
  },
  'slot:chargeReady': {
    sfx: 'pinHit', light: { color: ROLE.service, radius: 42, ms: 520 },
  },
  'slot:chargeDischarge': {
    burst: 'machine-sparks', count: 14, size: 10, sfx: 'coin', shake: 4,
    light: { color: ROLE.warning, radius: 52, ms: 360 },
  },
  'slot:spin': {
    sfx: 'reelStop', light: { color: ROLE.identity, radius: 30, ms: 260 },
  },
  'plinko:drop': {
    burst: 'plinko-impact', count: 16, size: 11, pins: true, shake: 5,
    light: { color: 0x54e0ff, radius: 48, ms: 380 },
  },
  'dispute:sabotage': {
    burst: 'machine-sparks', count: 16, size: 9, tint: ROLE.danger, sfx: 'brawl', shake: 6,
    light: { color: ROLE.danger, radius: 60, ms: 420 },
  },
};

const EVENTS = Object.keys(SPECS);

interface Payload {
  readonly itemId?: number;
  readonly guestId?: number;
  readonly guestIds?: readonly number[];
  readonly x?: number;
  readonly y?: number;
}

export class FloorEvents {
  readonly #fx: FloorFx;
  readonly #view: () => GameView;
  readonly #unsubscribe: (() => void)[] = [];

  constructor(fx: FloorFx, view: () => GameView) {
    this.#fx = fx;
    this.#view = view;
  }

  start(): void {
    for (const name of EVENTS) {
      this.#unsubscribe.push(on(name, (payload) => this.#fire(name, payload)));
    }
  }

  stop(): void {
    for (const unsubscribe of this.#unsubscribe) unsubscribe();
    this.#unsubscribe.length = 0;
  }

  #fire(name: string, payload: unknown): void {
    const spec = SPECS[name];
    if (!spec) return;
    const point = this.#anchor(name, payload);
    if (spec.burst) {
      this.#fx.burst(spec.burst, point.x, point.y, { count: spec.count, size: spec.size, tint: spec.tint });
    }
    if (spec.light) this.#fx.flash(point.x, point.y, spec.light.color, spec.light.radius, spec.light.ms);
    if (spec.shake) this.#fx.shake(spec.shake);
    if (spec.pins) playPinRun(7);
    else if (spec.sfx) playSfx(spec.sfx);
  }

  /** Anker aus dem Snapshot: Geraet, Gast oder Kasse statt Bildmitte. */
  #anchor(name: string, payload: unknown): { x: number; y: number } {
    const data = (payload ?? {}) as Payload;
    const view = this.#view();
    if (name === 'money:bigPayout') {
      const desk = view.furniture.find((item) => item.kind === 'EXCHANGE');
      if (desk) return furniturePoint(desk);
    }
    if (data.itemId !== undefined) {
      const item = view.furniture.find((entry) => entry.id === data.itemId);
      if (item) return furniturePoint(item);
    }
    if (name === 'plinko:drop') {
      const board = view.furniture.find((item) => item.gameId === 'PLINKO');
      if (board) return furniturePoint(board);
    }
    const guestId = data.guestId ?? data.guestIds?.[0];
    if (guestId !== undefined) {
      const guest = view.guests.find((entry) => entry.id === guestId);
      if (guest) return { x: (guest.position.x + 0.5) * TILE, y: (guest.position.y + 0.6) * TILE };
    }
    if (data.x !== undefined && data.y !== undefined) {
      return { x: (data.x + 0.5) * TILE, y: (data.y + 0.6) * TILE };
    }
    return { x: (view.player.position.x + 0.5) * TILE, y: (view.player.position.y + 0.6) * TILE };
  }
}

function furniturePoint(item: Furniture): { x: number; y: number } {
  return { x: (item.x + item.w / 2) * TILE, y: (item.y + item.h * 0.7) * TILE };
}
