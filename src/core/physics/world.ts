/** Deterministische 2D-Physik: fester Zeitschritt, Impulse, Drehmoment, kein Renderer. */
import { type Body, type Vec2, worldPoints } from './body';
import { closestOnSegment, edgesOf, EPS, insidePolygon, obstacleVelocity } from './geometry';

interface Contact { readonly point: Vec2; readonly normal: Vec2; readonly depth: number }

/** Kontakt zwischen Ball und Hindernis; null, wenn sie sich nicht beruehren. */
function contactOf(ball: Body, obstacle: Body): Contact | null {
  if (ball.shape.kind !== 'circle') throw new Error('contactOf: nur Kreis-Baelle werden aufgeloest');
  const radius = ball.shape.radius;
  if (obstacle.shape.kind === 'circle') {
    const dx = ball.position.x - obstacle.position.x;
    const dy = ball.position.y - obstacle.position.y;
    const distance = Math.hypot(dx, dy);
    const sum = radius + obstacle.shape.radius;
    if (distance > sum) return null;
    const nx = distance > EPS ? dx / distance : 0;
    const ny = distance > EPS ? dy / distance : -1;
    return {
      point: { x: obstacle.position.x + nx * obstacle.shape.radius, y: obstacle.position.y + ny * obstacle.shape.radius },
      normal: { x: nx, y: ny },
      depth: sum - distance,
    };
  }
  const points = worldPoints(obstacle);
  let closest: Vec2 | null = null;
  let best = Infinity;
  for (const [a, b] of edgesOf(obstacle, points)) {
    const entry = closestOnSegment(ball.position, a, b);
    const distance = Math.hypot(ball.position.x - entry.x, ball.position.y - entry.y);
    if (distance < best) { best = distance; closest = entry; }
  }
  if (!closest) return null;
  const inside = obstacle.shape.kind === 'polygon' && insidePolygon(ball.position, points);
  if (!inside && best > radius) return null;
  let nx = ball.position.x - closest.x;
  let ny = ball.position.y - closest.y;
  const length = Math.hypot(nx, ny);
  if (length <= EPS) { nx = 0; ny = inside ? -1 : 1; } else { nx /= length; ny /= length; }
  if (inside) { nx = -nx; ny = -ny; }
  return { point: closest, normal: { x: nx, y: ny }, depth: inside ? radius + best : radius - best };
}

interface PhysicsOptions {
  readonly gravity?: Vec2;
  readonly fixedDt?: number;
  readonly maxSteps?: number;
}

interface Attractor { readonly position: Vec2; readonly radius: number; readonly strength: number; }
/** Fester Zeitschritt, deterministische Reihenfolge: Render-FPS aendert kein Ergebnis. */
export class PhysicsWorld {
  readonly gravity: Vec2;
  readonly fixedDt: number;
  readonly maxSteps: number;
  readonly bodies: Body[] = [];
  readonly attractors: Attractor[] = [];
  readonly #statics: Body[] = [];
  readonly #dynamics: Body[] = [];
  #accumulator = 0;

  constructor(options: PhysicsOptions = {}) {
    this.gravity = options.gravity ?? { x: 0, y: 900 };
    this.fixedDt = options.fixedDt ?? 1 / 120;
    this.maxSteps = options.maxSteps ?? 8;
  }

  add<T extends Body>(body: T): T {
    this.bodies.push(body);
    (body.isStatic ? this.#statics : this.#dynamics).push(body);
    return body;
  }

  remove(body: Body): void {
    const lists = [this.bodies, body.isStatic ? this.#statics : this.#dynamics];
    for (const list of lists) {
      const index = list.indexOf(body);
      if (index >= 0) list.splice(index, 1);
    }
  }

  addAttractor(attractor: Attractor): void {
    if (!(attractor.radius > 0) || !(attractor.strength >= 0)) throw new Error('Physik: ungueltiger Attraktor');
    this.attractors.push(attractor);
  }

  /** Fuehrt so viele feste Schritte aus, wie in `dt` passen. */
  step(dt: number): number {
    this.#accumulator += dt;
    let steps = 0;
    while (this.#accumulator >= this.fixedDt && steps < this.maxSteps) {
      this.#accumulator -= this.fixedDt;
      this.substep();
      steps += 1;
    }
    return steps;
  }

  substep(): void {
    for (let index = 0; index < this.#statics.length; index += 1) {
      const body = this.#statics[index]!;
      if (body.angularVelocity !== 0) body.rotation += body.angularVelocity * this.fixedDt;
    }
    for (let index = 0; index < this.#dynamics.length; index += 1) {
      const body = this.#dynamics[index]!;
      body.velocity = {
        x: body.velocity.x + this.gravity.x * this.fixedDt,
        y: body.velocity.y + this.gravity.y * this.fixedDt,
      };
      for (const attractor of this.attractors) {
        const dx = attractor.position.x - body.position.x;
        const dy = attractor.position.y - body.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= EPS || distance > attractor.radius) continue;
        const pull = attractor.strength * (1 - distance / attractor.radius);
        body.velocity = {
          x: body.velocity.x + (dx / distance) * pull * this.fixedDt,
          y: body.velocity.y + (dy / distance) * pull * this.fixedDt,
        };
      }
      body.position = {
        x: body.position.x + body.velocity.x * this.fixedDt,
        y: body.position.y + body.velocity.y * this.fixedDt,
      };
      body.rotation += body.angularVelocity * this.fixedDt;
    }
    for (let index = 0; index < this.#dynamics.length; index += 1) {
      const body = this.#dynamics[index]!;
      for (let other = 0; other < this.#statics.length; other += 1) {
        const obstacle = this.#statics[other]!;
        if (obstacle.trigger !== null) continue;
        this.#resolve(body, obstacle);
      }
    }
  }

  /** Namen aller Triggerzonen, die diesen Koerper gerade beruehren. */
  triggerHits(body: Body): string[] {
    const hits: string[] = [];
    for (let index = 0; index < this.#statics.length; index += 1) {
      const obstacle = this.#statics[index]!;
      if (obstacle.trigger === null) continue;
      const contact = contactOf(body, obstacle);
      if (contact && contact.depth > 0) hits.push(obstacle.trigger);
    }
    return hits;
  }

  #resolve(ball: Body, obstacle: Body): void {
    if (ball.shape.kind !== 'circle') return;
    // Breitphase ohne Allokation: der haeufigste Fall ist "kein Kontakt".
    const reach = ball.shape.radius + obstacle.boundingRadius;
    const dx = ball.position.x - obstacle.position.x;
    const dy = ball.position.y - obstacle.position.y;
    if (dx * dx + dy * dy > reach * reach) return;
    const contact = contactOf(ball, obstacle);
    if (!contact || contact.depth <= 0) return;
    ball.position = {
      x: ball.position.x + contact.normal.x * contact.depth,
      y: ball.position.y + contact.normal.y * contact.depth,
    };
    const surface = obstacleVelocity(obstacle, contact.point);
    const relX = ball.velocity.x - surface.x;
    const relY = ball.velocity.y - surface.y;
    const normalSpeed = relX * contact.normal.x + relY * contact.normal.y;
    if (normalSpeed >= 0) return;
    const restitution = ball.restitution * obstacle.restitution * (obstacle.bouncy ? 2 : 1);
    const inverseMass = ball.inverseMass + obstacle.inverseMass;
    const normalImpulse = (-(1 + Math.min(restitution, 1.5)) * normalSpeed) / inverseMass;
    ball.velocity = {
      x: ball.velocity.x + contact.normal.x * normalImpulse * ball.inverseMass,
      y: ball.velocity.y + contact.normal.y * normalImpulse * ball.inverseMass,
    };
    // Reibung am Kontakt: erzeugt Drehmoment, eine rein optische Drehung gibt es nicht.
    const tangentX = -contact.normal.y;
    const tangentY = contact.normal.x;
    const tangentSpeed = relX * tangentX + relY * tangentY;
    const frictionLimit = Math.sqrt(ball.friction * obstacle.friction) * normalImpulse;
    const rawTangent = -tangentSpeed / inverseMass;
    const tangentImpulse = rawTangent > frictionLimit ? frictionLimit : rawTangent < -frictionLimit ? -frictionLimit : rawTangent;
    ball.velocity = {
      x: ball.velocity.x + tangentX * tangentImpulse * ball.inverseMass,
      y: ball.velocity.y + tangentY * tangentImpulse * ball.inverseMass,
    };
    const rx = contact.point.x - ball.position.x;
    const ry = contact.point.y - ball.position.y;
    ball.angularVelocity += (rx * tangentY - ry * tangentX) * tangentImpulse * ball.inverseInertia;
  }
}
