/**
 * Lauf- und Richtungsvertrag für Figuren.
 *
 * Der Frame kommt aus dem Tick und einer festen Phase, nie aus `Date.now()`.
 * Zwei gleiche Ticks ergeben denselben Frame; Stillstand ergibt keinen
 * Lauframe. Die Blickrichtung folgt der tatsächlichen Bewegung.
 */

export type Facing = 'left' | 'right';
export const GAIT_FRAMES = 4;

interface Gait {
  readonly frame: 0 | 1 | 2 | 3;
  readonly facing: Facing;
  readonly moving: boolean;
}

/** Richtung aus dx; ohne Bewegung bleibt die letzte Richtung stehen. */
function facingFor(dx: number, previous: Facing = 'right'): Facing {
  if (dx > 0.001) return 'right';
  if (dx < -0.001) return 'left';
  return previous;
}

/**
 * Vier Lauframes, zwei Richtungen, deterministisch aus Tick und Phase.
 * `phase` ist die bestehende Figur-Phase (0..1), damit zwei Figuren nicht
 * synchron marschieren.
 */
export function gaitFor(dx: number, tick: number, phase: number, previous: Facing = 'right'): Gait {
  const facing = facingFor(dx, previous);
  if (Math.abs(dx) <= 0.001) return { frame: 0, facing, moving: false };
  const offset = Math.floor(((phase % 1) + 1) % 1 * GAIT_FRAMES);
  const frame = ((Math.floor(tick / 2) + offset) % GAIT_FRAMES) as 0 | 1 | 2 | 3;
  return { frame, facing, moving: true };
}
