/**
 * @test-target: src/render/rig-pose.ts
 * @error-code: ERR-1003
 *
 * Das Rig ist reine Mathematik: gleiche Zeit, gleiche Pose, klarer Zustand.
 */
import { describe, expect, it } from 'vitest';
import { actorStateFor, poseFor } from '../rig-pose';

describe('Figuren-Rig', () => {
  it('erzeugt für denselben Zustand und Zeitpunkt dieselbe Pose', () => {
    expect(poseFor('walk', 1234, 0.7)).toEqual(poseFor('walk', 1234, 0.7));
  });

  it('unterscheidet Sitzen, Gewinnen und Laufen sichtbar', () => {
    const sit = poseFor('sit', 1000, 0);
    const win = poseFor('win', 1000, 0);
    const walk = poseFor('walk', 1000, 0);
    expect(sit.legL).toBeGreaterThan(1);
    expect(win.armL).toBeLessThan(-2);
    expect(Math.sign(walk.armL)).toBe(-Math.sign(walk.armR));
    expect(walk.legL).not.toBe(sit.legL);
  });

  it('bildet Weltzustände auf Animationszustände ab', () => {
    expect(actorStateFor({ state: 'PLAY', pathLength: 0, pathIndex: 0 })).toBe('play');
    expect(actorStateFor({ state: 'PLAY', pathLength: 0, pathIndex: 0, lastResult: 'Gewinn 5x' })).toBe('win');
    expect(actorStateFor({ state: 'PLAY', pathLength: 0, pathIndex: 0, lastResult: 'Nichts' })).toBe('lose');
    expect(actorStateFor({ state: 'ANGRY', pathLength: 0, pathIndex: 0 })).toBe('angry');
    expect(actorStateFor({ state: 'WAIT', pathLength: 0, pathIndex: 0 })).toBe('sit');
    expect(actorStateFor({ state: 'DRINK', pathLength: 0, pathIndex: 0 })).toBe('drink');
    expect(actorStateFor({ state: 'WAIT', pathLength: 2, pathIndex: 0, isPlayer: true })).toBe('walk');
    expect(actorStateFor({
      state: 'WAIT', pathLength: 0, pathIndex: 0, carrying: 'KRATE:3', isPlayer: true,
    })).toBe('carry');
  });
});
