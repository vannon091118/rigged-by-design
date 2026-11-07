/**
 * @test-target: src/render/rig-pose.ts
 * @error-code: ERR-1003
 *
 * Rendering-nahe Posekosten; bewusst nicht Teil von verify:all.
 */
import { test } from 'vitest';
import { measure } from '../test/measure';
import { actorStateFor, poseFor } from './rig-pose';

const STATES = ['idle', 'walk', 'sit', 'play', 'win', 'lose', 'drink', 'angry', 'carry'] as const;

test('Posen für 200 Figuren', { timeout: 60_000 }, () => {
  measure('200 Posen', () => {
    for (let index = 0; index < 200; index += 1) {
      poseFor(STATES[index % STATES.length]!, index * 16.7, index * 0.7);
    }
  }, { iterations: 20 });

  measure('200 Zustandsabbildungen', () => {
    for (let index = 0; index < 200; index += 1) {
      actorStateFor({
        state: index % 3 === 0 ? 'PLAY' : index % 3 === 1 ? 'WAIT' : 'ANGRY',
        pathLength: index % 5, pathIndex: 0, lastResult: index % 2 === 0 ? 'Gewinn 2x' : '',
      });
    }
  }, { iterations: 20 });
});
