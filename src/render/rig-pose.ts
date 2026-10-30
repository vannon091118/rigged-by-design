/** Reine Pose-Mathematik fuer das Pixel-Rig; ohne Pixi testbar. */

export type ActorState =
  | 'idle' | 'walk' | 'sit' | 'play' | 'win' | 'lose'
  | 'drink' | 'angry' | 'carry';

interface ActorPose {
  readonly bob: number;
  readonly lean: number;
  readonly headY: number;
  readonly headRot: number;
  readonly armL: number;
  readonly armR: number;
  readonly legL: number;
  readonly legR: number;
  readonly hop: number;
}

const WAVE = (now: number, speed: number, phase: number): number => Math.sin((now / 1000) * speed + phase);
const PIXEL = 1 / 16;

/** Jede Phase ist an denselben Takt gebunden; kein Zustand braucht Zufall. */
export function poseFor(state: ActorState, nowMs: number, phase: number): ActorPose {
  const wave = WAVE(nowMs, 7, phase);
  const fast = WAVE(nowMs, 12, phase);
  switch (state) {
    case 'walk':
      return {
        bob: Math.abs(fast) * 1.4 * PIXEL, lean: fast * 0.1 * PIXEL,
        headY: 0, headRot: fast * 0.06,
        armL: fast * 0.45, armR: -fast * 0.45, legL: -fast * 0.5, legR: fast * 0.5,
        hop: Math.abs(fast) * 1.2,
      };
    case 'sit':
      return { bob: 0, lean: 0, headY: 0.5, headRot: 0, armL: 0.5, armR: 0.5, legL: 1.45, legR: 1.45, hop: 0 };
    case 'play':
      return {
        bob: Math.abs(wave) * 0.6, lean: 0.02, headY: 0, headRot: wave * 0.05,
        armL: 1.15 + wave * 0.25, armR: 1.15 - wave * 0.25, legL: 0.15, legR: -0.15, hop: 0,
      };
    case 'win':
      return {
        bob: 0, lean: 0, headY: -1, headRot: 0, armL: -2.5, armR: -2.5,
        legL: -0.2, legR: 0.2, hop: Math.abs(wave) * 2,
      };
    case 'lose':
      return {
        bob: 0.6, lean: 0.12, headY: 1.2, headRot: 0.15, armL: 1.5, armR: 1.5,
        legL: 0, legR: 0, hop: 0,
      };
    case 'drink':
      return {
        bob: 0, lean: 0, headY: 0, headRot: -0.08, armL: 2.3 + wave * 0.12, armR: 0.4,
        legL: 0.2, legR: 0.2, hop: 0,
      };
    case 'angry':
      return {
        bob: Math.abs(fast) * 0.8, lean: fast * 0.12, headY: -0.4, headRot: fast * 0.12,
        armL: -1.9 + fast * 0.35, armR: -1.9 - fast * 0.35, legL: 0.2, legR: -0.2, hop: 0,
      };
    case 'carry':
      return {
        bob: Math.abs(fast) * 0.9, lean: 0.04, headY: 0, headRot: 0,
        armL: 1.6, armR: 1.6, legL: -fast * 0.45, legR: fast * 0.45, hop: 0,
      };
    default:
      return {
        bob: wave * 0.35, lean: 0, headY: wave * 0.3, headRot: wave * 0.03,
        armL: wave * 0.08, armR: -wave * 0.08, legL: 0, legR: 0, hop: 0,
      };
  }
}

interface ActorStateInput {
  readonly state: string;
  readonly pathLength: number;
  readonly pathIndex: number;
  readonly lastResult?: string;
  readonly carrying?: string;
  readonly isPlayer?: boolean;
}

const WIN = /gewinn|gewonnen|×|x\s*\d|win/i;
const LOSS = /nichts|leer|verlor|verloren|loss/i;

/** Weltzustand -> Animationszustand. Eine Stelle, damit Floor und Tests gleich urteilen. */
export function actorStateFor(input: ActorStateInput): ActorState {
  const moving = input.pathIndex < input.pathLength;
  if (input.isPlayer) {
    if (input.carrying === 'DRINK' || input.carrying?.startsWith('KRATE:')) return 'carry';
    return moving ? 'walk' : 'idle';
  }
  if (input.carrying === 'DRINK' || input.carrying?.startsWith('KRATE:')) return 'carry';
  switch (input.state) {
    case 'PLAY':
      if (input.lastResult && WIN.test(input.lastResult)) return 'win';
      if (input.lastResult && LOSS.test(input.lastResult)) return 'lose';
      return 'play';
    case 'DRINK': return 'drink';
    case 'TOILET':
    case 'WAIT': return 'sit';
    case 'ANGRY': return 'angry';
    case 'LEAVE': return moving ? 'walk' : 'idle';
    case 'ENTER':
    case 'CHOOSE':
    case 'EXCHANGE':
    case 'CASHOUT': return moving ? 'walk' : 'idle';
    default: return 'idle';
  }
}
