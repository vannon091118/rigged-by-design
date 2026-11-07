/** Plinko als echte Simulation: Zufall nur in den Startbedingungen, danach entscheidet die Kollision. */
import { ballBody, staticBody, type Body, type Vec2 } from '../physics/body';
import { PhysicsWorld } from '../physics/world';
import type { Prng } from '../rng/prng';
import {
  defaultPlinkoConfig, normalizePlinkoConfig, PEG_PHYSICS,
  type PlinkoConfig, type PlinkoDrop, type PlinkoMode,
} from './plinko-config';

const WIDTH = 100;
const TOP = 8;
const ROW_GAP = 11;
const PEG_RADIUS = 1.8;
const BALL_RADIUS = 2.2;
const MAX_STEPS = 1_800;
const PEG_COLUMNS = 8;
export const PLINKO_POCKETS = 9;

interface BallTrack {
  readonly body: Body;
  readonly track: Vec2[];
  splitUsed: boolean;
  pocket: number | null;
}

interface PlinkoBoard {
  readonly rows: number;
  readonly config: PlinkoConfig;
  drop(prng: Prng, mode?: PlinkoMode, captureTracks?: boolean): PlinkoDrop;
}

function pocketAt(widths: readonly number[], x: number): number {
  let edge = 0;
  for (let index = 0; index < widths.length; index += 1) {
    edge += widths[index]!;
    if (x < edge) return index;
  }
  return widths.length - 1;
}

function ballAt(x: number, y: number, vx: number, vy: number): Body {
  return ballBody(BALL_RADIUS, {
    position: { x, y }, velocity: { x: vx, y: vy }, restitution: 0.5, friction: 0.2, mass: 1,
  });
}

/** Ein Board: alle Hindernisse statisch, pro Wurf werden nur die Ballkoerper getauscht. */
export function createPlinkoBoard(input: PlinkoConfig = defaultPlinkoConfig(), rows = 8): PlinkoBoard {
  const config = normalizePlinkoConfig(input);
  const rowCount = Math.max(8, Math.min(12, Math.trunc(rows)));
  const floorY = 120 + (rowCount - 8) * ROW_GAP;
  const world = new PhysicsWorld({ gravity: { x: 0, y: 620 }, fixedDt: 1 / 120, maxSteps: 4 });
  world.add(staticBody({ kind: 'segment', ax: 4, ay: TOP, bx: 4, by: floorY }, { restitution: 0.2, friction: 0.2 }));
  world.add(staticBody({ kind: 'segment', ax: WIDTH - 4, ay: TOP, bx: WIDTH - 4, by: floorY }, { restitution: 0.2, friction: 0.2 }));

  const special = new Map(config.pegs.map((peg) => [`${peg.row}:${peg.column}`, peg.kind]));
  const splitPegs: Vec2[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const y = 26 + row * ROW_GAP;
    const offset = row % 2 === 0 ? 0 : 5.5;
    for (let column = 0; column < PEG_COLUMNS; column += 1) {
      const x = 10 + offset + column * 11;
      if (x > WIDTH - 6) continue;
      const kind = special.get(`${row}:${column}`) ?? 'NORMAL_PEG';
      const physics = PEG_PHYSICS[kind];
      const position = { x, y };
      world.add(staticBody(
        { kind: 'circle', radius: PEG_RADIUS },
        { position, restitution: physics.restitution, friction: physics.friction },
      ));
      if (physics.magnetRadius > 0) {
        world.addAttractor({ position, radius: physics.magnetRadius, strength: physics.magnetStrength });
      }
      if (physics.split) splitPegs.push(position);
    }
  }
  // Deflektoren ueber den Randfaechern halten den Ball im Feld.
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: 12, y: floorY - 12 }, restitution: 0.7, bouncy: true }));
  world.add(staticBody({ kind: 'circle', radius: 3.4 }, { position: { x: WIDTH - 12, y: floorY - 12 }, restitution: 0.7, bouncy: true }));

  return {
    rows: rowCount,
    config,
    drop(prng: Prng, mode: PlinkoMode = 'SINGLE', captureTracks = true): PlinkoDrop {
      const offsets = mode === 'TRIPLE' ? [-8, 0, 8] : mode === 'TWIN' ? [-4, 4] : [0];
      const balls: BallTrack[] = offsets.map((offset) => {
        const body = ballAt(
          WIDTH / 2 + offset + (prng.nextFloat() - 0.5) * 1.2,
          TOP,
          (prng.nextFloat() - 0.5) * 24,
          0,
        );
        world.add(body);
        return { body, track: captureTracks ? [{ ...body.position }] : [], splitUsed: false, pocket: null };
      });
      const created = balls.map((entry) => entry.body);
      let steps = 0;
      while (balls.some((entry) => entry.pocket === null) && steps < MAX_STEPS) {
        world.step(1 / 60);
        steps += 1;
        for (const entry of balls) {
          if (captureTracks) entry.track.push({ ...entry.body.position });
          if (entry.pocket === null && entry.body.position.y >= floorY) {
            entry.pocket = pocketAt(config.pocketWidths, entry.body.position.x);
          }
          if (entry.splitUsed || entry.pocket !== null) continue;
          const hit = splitPegs.some((peg) =>
            Math.hypot(entry.body.position.x - peg.x, entry.body.position.y - peg.y) <= PEG_RADIUS + BALL_RADIUS + 0.2);
          if (!hit) continue;
          entry.splitUsed = true;
          const side = entry.body.velocity.x >= 0 ? 1 : -1;
          entry.body.velocity = { x: entry.body.velocity.x - side * 18, y: entry.body.velocity.y };
          const clone = ballAt(
            entry.body.position.x, entry.body.position.y,
            entry.body.velocity.x + side * 36, entry.body.velocity.y,
          );
          world.add(clone);
          created.push(clone);
          balls.push({
            body: clone, track: captureTracks ? [{ ...clone.position }] : [], splitUsed: true, pocket: null,
          });
        }
      }
      const pockets = balls.map((entry) => entry.pocket ?? pocketAt(config.pocketWidths, entry.body.position.x));
      const tracks = balls.map((entry) => entry.track);
      for (const body of created) world.remove(body);
      return { pockets, tracks, steps };
    },
  };
}
