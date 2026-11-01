/** Deterministischer Mulberry32-PRNG. Zustand ist ein uint32 und exakt wiederherstellbar. */

/** Zwei Namespaces: Spielzustand und Darstellung teilen nie denselben Strom. */
export type RngRole = 'gameplay' | 'presentation';

export class Prng {
  readonly seed: number;
  readonly role: RngRole;
  #state: number;

  constructor(seed: number, role: RngRole = 'gameplay') {
    if (!Number.isFinite(seed)) throw new Error(`Prng: Seed muss endlich sein, erhalten ${String(seed)}`);
    this.seed = Math.floor(seed) >>> 0;
    this.role = role;
    this.#state = this.seed;
  }

  /** Ein Schritt des Mulberry32-Kerns, 32 Bit. */
  nextUint32(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** Gleichverteilt in [0, 1) mit 32 Bit Aufloesung. */
  nextFloat(): number {
    return this.nextUint32() / 4294967296;
  }

  /** Inklusiv [min, max], ohne Modulo-Bias (Rejection Sampling). */
  nextInt(min: number, max: number): number {
    if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max)) {
      throw new Error('Prng.nextInt: sichere Ganzzahlen erwartet');
    }
    if (max < min) throw new Error(`Prng.nextInt: max (${max}) < min (${min})`);
    const range = max - min + 1;
    if (range > 4294967296) throw new Error('Prng.nextInt: Bereich groesser als 2^32');
    const limit = 4294967296 - (4294967296 % range);
    let draw = this.nextUint32();
    while (draw >= limit) draw = this.nextUint32();
    return min + (draw % range);
  }

  getState(): number {
    return this.#state;
  }

  setState(state: number): void {
    if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
      throw new Error('Prng.setState: uint32 erwartet');
    }
    this.#state = state >>> 0;
  }
}
