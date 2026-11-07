/** Wiederverwendbare Figuren und Sticker: im Frame entstehen keine neuen Text-/Graphics-Objekte. */
import { createGuestArt, type GuestArt } from './guest-art';

const POOL_SIZE = 32;

export class ActorPool {
  readonly #free: GuestArt[] = [];
  readonly #active = new Map<number, GuestArt>();
  readonly #all: GuestArt[] = [];
  readonly #attach: (art: GuestArt) => void;

  constructor(attach: (art: GuestArt) => void, size = POOL_SIZE) {
    this.#attach = attach;
    for (let index = 0; index < size; index += 1) {
      const art = createGuestArt('STREET', '', false, index * 0.7);
      art.root.visible = false;
      this.#all.push(art);
      this.#free.push(art);
    }
  }

  get all(): readonly GuestArt[] {
    return this.#all;
  }

  get active(): ReadonlyMap<number, GuestArt> {
    return this.#active;
  }

  get(id: number): GuestArt | undefined {
    return this.#active.get(id);
  }

  acquire(guest: { id: number; persona: string; name: string }): GuestArt {
    let art = this.#free.pop();
    if (!art) {
      art = createGuestArt(guest.persona, guest.name, false, this.#all.length * 0.7);
      this.#all.push(art);
      this.#attach(art);
    }
    art.setPersona(guest.persona);
    art.setName(guest.name);
    art.root.visible = true;
    this.#active.set(guest.id, art);
    return art;
  }

  release(id: number): void {
    const art = this.#active.get(id);
    if (!art) return;
    this.#active.delete(id);
    art.setEmotion('NONE');
    art.root.visible = false;
    art.sticker.visible = false;
    this.#free.push(art);
  }

  clear(): void {
    this.#active.clear();
  }
}
