/** Partikel aus dem Paket: Gewinn- und Verlustmomente nutzen dieselben Emitter wie die Bibliothek. */
import { Container, Sprite, type Texture } from 'pixi.js';
import manifest from '../assets/manifest.json';
import { textureFor } from '../assets/textures';
import { presentation } from '../rng';

interface EmitterDef {
  readonly textures?: readonly string[];
  readonly count: number;
  readonly lifetimeMs: readonly number[];
  readonly speed?: readonly number[];
  readonly speedX?: readonly number[];
  readonly speedY?: readonly number[];
  readonly gravity?: number;
  readonly scale?: readonly number[];
}

const EMITTERS = manifest.emitters as unknown as Readonly<Record<string, EmitterDef>>;
const ANIMATIONS = manifest.animations as unknown as Readonly<Record<string, { readonly frames: readonly string[] }>>;

/** Animationen ohne Emitter-Definition, aber mit fertigen Frames (Rauch am Streit). */
const EXTRA_EMITTERS: Readonly<Record<string, EmitterDef>> = {
  'smoke-puff': {
    textures: ANIMATIONS['smoke-puff']?.frames,
    count: 16,
    lifetimeMs: [520, 900],
    speed: [0.08, 0.28],
    speedY: [-0.35, -0.08],
    scale: [0.9, 1.6],
  },
};

/** Obergrenze: mehr Sprites bringt kein Bild, nur Last; der Governor setzt sie. */
let particleLimit = 200;
export const setParticleLimit = (limit: number): void => {
  particleLimit = Math.max(0, Math.floor(limit));
};

/** Wie viele Emitter gerade sichtbare Partikel halten (Werkstatt-HUD). */
let activeEmitters = 0;
export const activeEmitterCount = (): number => activeEmitters;

export interface BurstOptions {
  readonly count?: number;
  readonly size?: number;
  readonly alpha?: number;
  /** Gedaempfte Toenung fuer Verluste; ohne Angabe bleibt die Textur unveraendert. */
  readonly tint?: number;
}

interface Particle {
  readonly sprite: Sprite;
  vx: number;
  vy: number;
  age: number;
  readonly ttl: number;
  readonly gravity: number;
  readonly spin: number;
}

const between = (range: readonly number[] | undefined, fallback: number): number => {
  const min = range?.[0] ?? fallback;
  const max = range?.[1] ?? min;
  return min + presentation.nextFloat() * (max - min);
};

export class Emitter {
  readonly container = new Container();
  readonly #pool: Sprite[] = [];
  #particles: Particle[] = [];
  #active = false;

  /** Ein Sprite aus dem Pool; im Frame wird nie etwas zerstört. */
  #acquire(texture: Texture): Sprite {
    const sprite = this.#pool.pop();
    if (!sprite) {
      const fresh = new Sprite(texture);
      fresh.anchor.set(0.5);
      this.container.addChild(fresh);
      return fresh;
    }
    sprite.texture = texture;
    sprite.visible = true;
    return sprite;
  }

  #release(sprite: Sprite): void {
    sprite.visible = false;
    this.#pool.push(sprite);
  }

  burst(name: string, x: number, y: number, options: BurstOptions = {}): void {
    const def = EMITTERS[name] ?? EXTRA_EMITTERS[name];
    if (!def) return;
    // Einmal je Burst aufloesen, nicht je Partikel.
    const available = (def.textures ?? [])
      .map((path) => textureFor(path))
      .filter((entry): entry is Texture => entry !== null);
    if (!available.length) return;
    const room = particleLimit - this.#particles.length;
    const count = Math.max(0, Math.min(options.count ?? def.count, 48, room));
    const size = options.size ?? 14;
    for (let index = 0; index < count; index += 1) {
      const sprite = this.#acquire(available[index % available.length]!);
      const scale = between(def.scale, 1) * size;
      sprite.width = scale;
      sprite.height = scale;
      sprite.position.set(x, y);
      sprite.alpha = options.alpha ?? 1;
      sprite.tint = options.tint ?? 0xffffff;
      sprite.rotation = presentation.nextFloat() * Math.PI * 2;
      let vx: number;
      let vy: number;
      if (def.speedX && def.speedY) {
        vx = between(def.speedX, 0);
        vy = between(def.speedY, 0);
      } else {
        const speed = between(def.speed, 0.3);
        const angle = presentation.nextFloat() * Math.PI * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
      this.#particles.push({
        sprite, vx, vy, age: 0,
        ttl: between(def.lifetimeMs, 600),
        gravity: def.gravity ?? 0,
        spin: (presentation.nextFloat() - 0.5) * 0.025,
      });
    }
    if (count > 0 && !this.#active) {
      this.#active = true;
      activeEmitters += 1;
    }
  }

  /** Bewege alle Partikel; tote Sprites wandern zurueck in den Pool. */
  update(deltaMS: number): void {
    if (!this.#particles.length) {
      if (this.#active) { this.#active = false; activeEmitters -= 1; }
      return;
    }
    const keep: Particle[] = [];
    for (const particle of this.#particles) {
      particle.age += deltaMS;
      if (particle.age >= particle.ttl) {
        this.#release(particle.sprite);
        continue;
      }
      particle.vy += particle.gravity * deltaMS;
      particle.sprite.x += particle.vx * deltaMS;
      particle.sprite.y += particle.vy * deltaMS;
      particle.sprite.rotation += particle.spin * deltaMS;
      particle.sprite.alpha = Math.max(0, 1 - particle.age / particle.ttl);
      keep.push(particle);
    }
    this.#particles = keep;
    if (!keep.length && this.#active) { this.#active = false; activeEmitters -= 1; }
  }

  clear(): void {
    for (const particle of this.#particles) this.#release(particle.sprite);
    this.#particles = [];
    if (this.#active) { this.#active = false; activeEmitters -= 1; }
  }

  destroy(): void {
    this.clear();
    this.#pool.length = 0;
    this.container.destroy({ children: true });
  }
}
