/**
 * @test-target: src/core/games/shell-round.ts
 * @error-code: ERR-1003
 *
 * Das Huetchenspiel muss vor der Wahl feststehen, ehrlich mischen und jede
 * Becherwahl gleich behandeln, sonst ist die Wahl des Spielers Theater.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { ballAfterMoves, createShellRound, resolveShellPick, shellPayoutBps } from '../shell-round';

describe('Huetchenspiel-Runde', () => {
  it('startet mit drei Bechern und einer versteckten Perle', () => {
    const prng = new Prng(randomSeed());
    for (let round = 0; round < 100; round += 1) {
      const game = createShellRound(prng);
      expect(game.cups).toBe(3);
      expect(game.ballCup).toBeGreaterThanOrEqual(0);
      expect(game.ballCup).toBeLessThan(3);
      expect(game.moves.length).toBeGreaterThanOrEqual(7);
      for (const move of game.moves) {
        expect(move.left).not.toBe(move.right);
        expect(move.left).toBeGreaterThanOrEqual(0);
        expect(move.left).toBeLessThan(3);
      }
    }
  });

  it('zieht die Kugel bei jedem Tausch genau einmal mit', () => {
    const game = createShellRound(new Prng(randomSeed()));
    let expected = game.ballCup;
    for (const move of game.moves) {
      if (expected === move.left) expected = move.right;
      else if (expected === move.right) expected = move.left;
    }
    expect(ballAfterMoves(game)).toBe(expected);
  });

  it('trifft nur den Becher, unter dem die Kugel liegt', () => {
    const game = createShellRound(new Prng(randomSeed()));
    const ball = ballAfterMoves(game);
    for (let pick = 0; pick < game.cups; pick += 1) {
      const outcome = resolveShellPick(game, pick);
      expect(outcome.won).toBe(pick === ball);
      expect(outcome.multiplierBps).toBe(pick === ball ? shellPayoutBps(game.cups) : 0);
    }
  });

  it('haelt die Auszahlung im Band von 90 bis 96 Prozent', () => {
    for (const cups of [3, 4, 5]) {
      const rtp = (1 / cups) * (shellPayoutBps(cups) / 10_000);
      expect(rtp).toBeGreaterThanOrEqual(0.9);
      expect(rtp).toBeLessThanOrEqual(0.96);
    }
  });

  it('weist Becher ausserhalb des Tisches ab', () => {
    const game = createShellRound(new Prng(randomSeed()));
    expect(() => resolveShellPick(game, 3)).toThrow(/gibt es nicht/);
    expect(() => resolveShellPick(game, -1)).toThrow(/gibt es nicht/);
  });
});
