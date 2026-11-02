/** @test-target: src/core/sim/guest-play.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { isJackpotLabel } from '../guest-play';

describe('JACKPOT-Label', () => {
  it('nennt einen Push von 1,0x nicht Jackpot', () => {
    expect(isJackpotLabel(10_000)).toBe(false);
  });

  it('nennt einen echten Mehrfachgewinn Jackpot', () => {
    expect(isJackpotLabel(30_000)).toBe(true);
  });
});
