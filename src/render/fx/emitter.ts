/** Partikel aus dem Paket: Gewinn- und Verlustmomente nutzen dieselben Emitter wie die Bibliothek. */
import { Container, Sprite, type Texture } from 'pixi.js';
import manifest from '../assets/manifest.json';
import { textureFor } from '../assets/textures';

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

interface BurstOptions {
  readonly count?: number;
  readonly size?: number;
  readonly alpha?: number;
  /** Gedämpfte Tönung fuer Verluste; ohne Angabe bleibt die Textur unverändert. */
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
  return min + Math.random() * (max - min);
};

export class Emitter {
  readonly container = new Container();
  #particles: Particle[] = [];

  burst(name: string, x: number, y: number, options: BurstOptions = {}): void {
    const def = EMITTERS[name];
    if (!def) return;
    const available = (def.textures ?? [])
      .map((path) => textureFor(path))
      .filter((entry): entry is Texture => entry !== null);
    if (!available.length) return;
    const count = Math.max(1, Math.min(options.count ?? def.count, 48));
    const size = options.size ?? 14;
    for (let index = 0; index < count; index += 1) {
      const sprite = new Sprite(available[index % available.length]!);
      sprite.anchor.set(0.5);
      const scale = between(def.scale, 1) * size;
      sprite.width = scale;
      sprite.height = scale;
      sprite.position.set(x, y);
      sprite.alpha = options.alpha ?? 1;
      sprite.tint = options.tint ?? 0xffffff;
      sprite.rotation = Math.random() * Math.PI * 2;
      let vx: number;
      let vy: number;
      if (def.speedX && def.speedY) {
        vx = between(def.speedX, 0);
        vy = between(def.speedY, 0);
      } else {
        const speed = between(def.speed, 0.3);
        const angle = Math.random() * Math.PI * 2;
        vx = Math.cos(angle) * speed;
        vy = Math.sin(angle) * speed;
      }
      this.container.addChild(sprite);
      this.#particles.push({
        sprite, vx, vy, age: 0,
        ttl: between(def.lifetimeMs, 600),
        gravity: def.gravity ?? 0,
        spin: (Math.random() - 0.5) * 0.025,
      });
    }
  }

  /** Bewege alle Partikel; tote Sprites werden sofort freigegeben. */
  update(deltaMS: number): void {
    if (!this.#particles.length) return;
    const keep: Particle[] = [];
    for (const particle of this.#particles) {
      particle.age += deltaMS;
      if (particle.age >= particle.ttl) {
        particle.sprite.destroy();
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
  }

  clear(): void {
    for (const particle of this.#particles) particle.sprite.destroy();
    this.#particles = [];
  }

  destroy(): void {
    this.clear();
    this.container.destroy({ children: false });
  }
}
