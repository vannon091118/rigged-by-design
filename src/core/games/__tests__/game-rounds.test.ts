/**
 * @test-target: src/core/games/contracts.ts
 * @error-code: ERR-1003
 *
 * Auch die neuen Tischspiele muessen durch denselben Aktionspfad: Einsatz rein,
 * geprueftes Ergebnis raus. Kein UI-Code darf Geld erfinden.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import { playAction } from '../contracts';
import { fromVC, mulVC } from '../../economy/vacoin';
import { createShellRound, ballAfterMoves, shellPayoutBps } from '../shell-round';
import { spotCovers, spotInfo, totalStake } from '../roulette-table';

describe('Aktionspfad der Tischspiele', () => {
  it('bucht mehrere Roulette-Jetons als einen Satz ab', () => {
    const prng = new Prng(randomSeed());
    const chips = [
      { spot: 'N7', stake: fromVC(1) },
      { spot: 'RED', stake: fromVC(2) },
    ];
    for (let round = 0; round < 40; round += 1) {
      const result = playAction({ game: 'ROULETTE', stake: totalStake(chips), roulette: chips }, prng);
      expect(result.roulette?.number).toBeGreaterThanOrEqual(0);
      expect(result.roulette?.number).toBeLessThanOrEqual(36);
      const covered = chips.filter((chip) => spotCovers(chip.spot, result.roulette!.number));
      if (covered.length === 0) {
        expect(result.payout).toBe(0);
        expect(result.multiplierBps).toBe(0);
      } else {
        // Die Gesamtquote ist der gewichtete Anteil der deckenden Jetons am Satz.
        const won = covered.reduce((sum, chip) => sum + mulVC(chip.stake, spotInfo(chip.spot)!.bps), 0);
        expect(result.multiplierBps).toBe(Math.round((won / totalStake(chips)) * 10_000));
        expect(result.payout).toBe(result.roulette?.payout);
        expect(result.payout).toBe(mulVC(totalStake(chips), result.multiplierBps));
      }
      expect(result.roulette?.hits.map((hit) => hit.spot)).toEqual(covered.map((chip) => chip.spot));
    }
  });

  it('weist einen Einsatz ab, der nicht zu den Jetons passt', () => {
    const prng = new Prng(randomSeed());
    expect(() => playAction({
      game: 'ROULETTE', stake: fromVC(5),
      roulette: [{ spot: 'N7', stake: fromVC(1) }],
    }, prng)).toThrow(/Einsatz/);
  });

  it('rechnet die Huetchen-Wahl gegen die feste Kugel ab', () => {
    const prng = new Prng(randomSeed());
    const game = createShellRound(prng);
    const ball = ballAfterMoves(game);
    const stake = fromVC(1);
    const hit = playAction({ game: 'SHELL', stake, shell: { round: game, pick: ball } }, prng);
    expect(hit.multiplierBps).toBe(shellPayoutBps(3));
    expect(hit.payout).toBe(mulVC(stake, shellPayoutBps(3)));
    const missPick = (ball + 1) % game.cups;
    const miss = playAction({ game: 'SHELL', stake, shell: { round: game, pick: missPick } }, prng);
    expect(miss.multiplierBps).toBe(0);
    expect(miss.payout).toBe(0);
  });

  it('laesst den alten Sofort-Pfad ohne Zusatzdaten unveraendert', () => {
    const prng = new Prng(randomSeed());
    const result = playAction({ game: 'ROULETTE', stake: fromVC(1) }, prng);
    expect(result.multiplierBps).toBeGreaterThanOrEqual(0);
    expect(result.roulette).toBeUndefined();
    expect(spotInfo('N7')?.bps).toBe(360_000);
  });
});
