/**
 * @test-target: src/core/physics/world.ts
 * @error-code: ERR-1005
 *
 * Fester Zeitschritt, echte Impulse: die Render-FPS darf den Ausgang nicht aendern.
 */
import { describe, expect, it } from 'vitest';
import { ballBody, createBody, staticBody, worldPoints } from '../body';
import { PhysicsWorld } from '../world';

const G = 900;

function floor(restitution = 0.5) {
  return staticBody({ kind: 'segment', ax: -500, ay: 100, bx: 500, by: 100 }, { restitution, friction: 0.4 });
}

function energy(ball: ReturnType<typeof ballBody>): number {
  const kinetic = 0.5 * ball.mass * (ball.velocity.x ** 2 + ball.velocity.y ** 2);
  const spin = 0.5 * ball.inertia * ball.angularVelocity ** 2;
  const height = (100 - ball.position.y) * ball.mass * G;
  return kinetic + spin + height;
}

describe('Physik', () => {
  it('beschleunigt im freien Fall mit der eingestellten Gravitation', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120 });
    const ball = world.add(ballBody(2, { position: { x: 0, y: 0 } }));
    for (let index = 0; index < 240; index += 1) world.step(1 / 120);
    // 2 Sekunden Fall: halbe Weg-Zeit-Kurve, halbimpliziter Euler liegt leicht darueber.
    expect(ball.position.y).toBeGreaterThan(0.5 * G * 4 * 0.98);
    expect(ball.position.y).toBeLessThan(0.5 * G * 4 * 1.05);
    expect(ball.velocity.y).toBeCloseTo(G * 2, 0);
  });

  it('springt mit der eingestellten Restitution zurueck', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120 });
    world.add(floor(0.5));
    const ball = world.add(ballBody(2, { position: { x: 0, y: 0 }, restitution: 1 }));
    let rebound = 0;
    let touched = false;
    for (let index = 0; index < 600; index += 1) {
      world.step(1 / 120);
      if (ball.position.y > 95) touched = true;
      // Gravitation zeigt nach +y: Aufwaertsbewegung ist negativ.
      if (touched) rebound = Math.min(rebound, ball.velocity.y);
    }
    const impact = Math.sqrt(2 * G * 98);
    expect(touched).toBe(true);
    expect(-rebound / impact).toBeGreaterThan(0.4);
    expect(-rebound / impact).toBeLessThan(0.6);
  });

  it('erzeugt bei schraegem Aufprall Rotation statt nur Optik', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120 });
    world.add(floor(0.2));
    const ball = world.add(ballBody(2, { position: { x: 0, y: 90 }, velocity: { x: 120, y: 0 }, restitution: 0.4 }));
    for (let index = 0; index < 240; index += 1) world.step(1 / 120);
    // y zeigt nach unten: positives Omega laesst den Kontaktpunkt nach -x laufen, also echtes Rollen.
    expect(ball.angularVelocity).toBeGreaterThan(0);
    expect(ball.rotation).toBeGreaterThan(0);
  });

  it('laesst einen Ball nicht in einen Peg eindringen und lenkt ihn ab', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120 });
    const peg = world.add(staticBody({ kind: 'circle', radius: 4 }, { position: { x: 0, y: 60 }, bouncy: true, restitution: 0.8 }));
    const ball = world.add(ballBody(2, { position: { x: -0.8, y: 20 }, restitution: 0.6 }));
    let penetrated = 0;
    for (let index = 0; index < 200; index += 1) {
      world.step(1 / 120);
      const distance = Math.hypot(ball.position.x - peg.position.x, ball.position.y - peg.position.y);
      penetrated = Math.max(penetrated, 6 - distance);
    }
    expect(penetrated).toBeLessThan(0.5);
    expect(Math.abs(ball.position.x)).toBeGreaterThan(1);
  });

  it('liefert dasselbe Ergebnis unabhaengig von der Render-Schrittweite', () => {
    const build = () => {
      const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120, maxSteps: 64 });
      world.add(floor(0.6));
      const ball = world.add(ballBody(3, { position: { x: 3, y: 10 }, velocity: { x: 40, y: 0 } }));
      return { world, ball };
    };
    const fast = build();
    const slow = build();
    for (let index = 0; index < 120; index += 1) fast.world.step(1 / 60);
    for (let index = 0; index < 480; index += 1) slow.world.step(1 / 240);
    expect(fast.ball.position.x).toBeCloseTo(slow.ball.position.x, 6);
    expect(fast.ball.position.y).toBeCloseTo(slow.ball.position.y, 6);
  });

  it('gewinnt keine Energie durch Kollisionen', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: G }, fixedDt: 1 / 120 });
    world.add(floor(0.7));
    world.add(staticBody({ kind: 'segment', ax: -50, ay: 0, bx: -50, by: 100 }, { restitution: 0.7 }));
    const ball = world.add(ballBody(2, { position: { x: 0, y: 40 }, restitution: 0.7 }));
    const start = energy(ball);
    for (let index = 0; index < 720; index += 1) world.step(1 / 120);
    expect(energy(ball)).toBeLessThan(start + 1e-6);
  });

  it('weist ungueltige Bodies ab und laesst statische Koerper ohne Masse', () => {
    expect(() => createBody({ kind: 'circle', radius: 0 })).toThrow();
    expect(() => createBody({ kind: 'circle', radius: -2 })).toThrow();
    expect(() => createBody({ kind: 'polygon', points: [{ x: 0, y: 0 }] })).toThrow();
    expect(() => createBody({ kind: 'segment', ax: 1, ay: 1, bx: 1, by: 1 })).toThrow();
    expect(() => createBody({ kind: 'circle', radius: 1 }, { static: false, mass: -1 })).toThrow();
    const wall = createBody({ kind: 'circle', radius: 5 });
    expect(wall.inverseMass).toBe(0);
    expect(wall.inverseInertia).toBe(0);
  });

  it('dreht statische Hindernisse und uebertraegt ihre Bewegung', () => {
    const world = new PhysicsWorld({ gravity: { x: 0, y: 0 }, fixedDt: 1 / 120 });
    const spinner = world.add(staticBody(
      { kind: 'segment', ax: -10, ay: 0, bx: 10, by: 0 },
      { position: { x: 0, y: 0 }, angularVelocity: Math.PI },
    ));
    const before = worldPoints(spinner)[1]!;
    world.step(0.5);
    const after = worldPoints(spinner)[1]!;
    expect(after.x).not.toBeCloseTo(before.x, 3);
  });
});
