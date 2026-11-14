/**
 * Binaerer Min-Heap auf Tile-Indizes fuer A*: der Schluessel liegt im
 * uebergebenen fScore-Array, nicht im Heap. Kein Sortieren, keine String-Keys.
 * Eigene Datei, damit `pathfinding.ts` innerhalb seines LOC-Budgets bleibt.
 */
export class TileHeap {
  readonly #items: Int32Array;
  readonly #f: Int32Array;
  #length = 0;

  constructor(capacity: number, f: Int32Array) {
    this.#items = new Int32Array(capacity);
    this.#f = f;
  }

  get size(): number {
    return this.#length;
  }

  push(node: number): void {
    const items = this.#items;
    let index = this.#length;
    this.#length = index + 1;
    items[index] = node;
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (this.#f[items[parent]!]! <= this.#f[items[index]!]!) break;
      const swap = items[parent]!;
      items[parent] = items[index]!;
      items[index] = swap;
      index = parent;
    }
  }

  pop(): number {
    const items = this.#items;
    const top = items[0]!;
    this.#length -= 1;
    if (this.#length === 0) return top;
    items[0] = items[this.#length]!;
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let best = index;
      if (left < this.#length && this.#f[items[left]!]! < this.#f[items[best]!]!) best = left;
      if (right < this.#length && this.#f[items[right]!]! < this.#f[items[best]!]!) best = right;
      if (best === index) break;
      const swap = items[best]!;
      items[best] = items[index]!;
      items[index] = swap;
      index = best;
    }
    return top;
  }
}
