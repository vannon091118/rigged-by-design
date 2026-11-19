/**
 * Drei Leistungsstufen mit Hysterese. Der Governor bekommt nur deltaMS; er
 * kennt weder Uhr noch Renderer und laesst sich deshalb rein testen.
 */
export type PerfTier = 'high' | 'mid' | 'low';

interface PerfBudget {
  readonly dpr: number;
  readonly fps: number;
  readonly particles: number;
  readonly lights: number;
}

export const PERF_TIERS: Readonly<Record<PerfTier, PerfBudget>> = {
  high: { dpr: 1.5, fps: 60, particles: 200, lights: 6 },
  mid: { dpr: 1.25, fps: 60, particles: 120, lights: 4 },
  low: { dpr: 1, fps: 30, particles: 60, lights: 0 },
};

const PERF_ORDER: readonly PerfTier[] = ['low', 'mid', 'high'];
const SWITCH_MS = 2000;
// Hochschalten braucht deutlich laenger als runterschalten, damit der Governor
// nicht zwischen high und mid (gleiche FPS-Schwelle, anderes dpr) hin- und her-
// schaltet, sobald die Frames an der Grenz-FPS oszillieren.
const SWITCH_UP_MS = SWITCH_MS * 2;

export class PerfGovernor {
  #tier: PerfTier = 'high';
  #badMs = 0;
  #goodMs = 0;

  get tier(): PerfTier { return this.#tier; }

  get budget(): PerfBudget { return PERF_TIERS[this.#tier]; }

  /** Ein Frame; liefert die aktive Stufe nach moeglicher Anpassung. */
  update(deltaMS: number): PerfTier {
    const frameMs = 1000 / PERF_TIERS[this.#tier].fps;
    const delta = Math.min(120, Math.max(0, deltaMS));
    if (delta > frameMs * 1.35) {
      this.#badMs += delta;
      this.#goodMs = 0;
    } else if (delta < frameMs * 0.9) {
      this.#goodMs += delta;
      this.#badMs = 0;
    } else {
      this.#badMs = 0;
      this.#goodMs = 0;
    }
    if (this.#badMs >= SWITCH_MS) this.#switch(-1);
    else if (this.#goodMs >= SWITCH_UP_MS) {
      // Hochschalten nur, wenn die ZIELSTUFE die aktuelle Belastung als "gut"
      // einstuft. Verhindert Flappen zwischen Stufen mit gleicher FPS-Schwelle
      // (high/mid) und verhindert, dass bei konstanter Grenz-FPS-Belastung
      // endlos hoch- und runter geschaltet wird (z. B. 23 ms: high/mid = schlecht,
      // low = gut, aber mid wuerde 23 ms wieder als schlecht einstufen).
      const index = PERF_ORDER.indexOf(this.#tier);
      const nextTier = PERF_ORDER[index + 1];
      if (nextTier) {
        const nextFrameMs = 1000 / PERF_TIERS[nextTier].fps;
        if (delta < nextFrameMs * 0.9) this.#switch(1);
      }
    }
    return this.#tier;
  }

  #switch(direction: number): void {
    const index = PERF_ORDER.indexOf(this.#tier);
    const next = PERF_ORDER[Math.min(PERF_ORDER.length - 1, Math.max(0, index + direction))];
    if (next && next !== this.#tier) this.#tier = next;
    this.#badMs = 0;
    this.#goodMs = 0;
  }
}
