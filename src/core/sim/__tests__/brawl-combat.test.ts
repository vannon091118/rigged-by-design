/**
 * @test-target: src/core/sim/brawl-combat.ts
 * @error-code: ERR-1003
 *
 * Die Siegchance im Tooltip ist keine Schaetzung: dieselbe Konstellation
 * tausendfach gefuehrt muss um die gerechnete Wahrscheinlichkeit streuen.
 * Zweiter Teil: die Kampffolge traegt Lebenspunkte und Verletzung wirklich
 * in den Spielerkoerper, den auch die Vorschau anzeigt.
 */
import { describe, expect, it } from 'vitest';
import { Prng } from '../../rng/prng';
import { applyFightOutcome, fighters, simulateFight, winProbability } from '../brawl-combat';
import type { DuelOpponent } from '../duel-opponent';
import { isInjured, newPlayerRpg, playerMaxHp, playerStepsPerTick, type PlayerRpgState } from '../player-rpg';
import { randomSeed } from '../../../test/random-seed';

const OPPONENT: DuelOpponent = {
  guestId: 1, name: 'Kalle', archetype: 'Straßenschläger', strength: 5, greed: 6, nerve: 4, toughness: 5,
};

const rpg = (brawlLevel: number): PlayerRpgState => ({ ...newPlayerRpg(), brawlLevel });

describe('Kampfmechanik und ihre Anzeige', () => {
  it('gewinnt in der Simulation so oft, wie die gerechnete Chance sagt', () => {
    const [player, rival] = fighters(rpg(3), OPPONENT, 0);
    const expected = winProbability(player, rival);
    expect(expected).toBeGreaterThan(0);
    expect(expected).toBeLessThan(1);

    const prng = new Prng(randomSeed());
    const fights = 4000;
    let won = 0;
    for (let index = 0; index < fights; index += 1) {
      if (simulateFight(player, rival, prng).playerWon) won += 1;
    }
    // Drei Standardfehler bei 4000 Kaempfen sind rund 0,02.
    expect(Math.abs(won / fights - expected), `Soll ${expected.toFixed(3)}`).toBeLessThan(0.03);
  });

  it('mehr Brawl-Stufe hebt Chance, Lebenspunkte und Schlagkraft', () => {
    const weak = fighters(rpg(0), OPPONENT, 0);
    const strong = fighters(rpg(6), OPPONENT, 0);
    expect(winProbability(strong[0], strong[1])).toBeGreaterThan(winProbability(weak[0], weak[1]));
    expect(strong[0].maxHp).toBe(weak[0].maxHp + 36);
    expect(strong[0].attack).toBeGreaterThan(weak[0].attack);
    expect(strong[0].hit).toBeGreaterThan(weak[0].hit);
    expect(strong[1].hit).toBeLessThan(weak[1].hit);
    expect(playerMaxHp(rpg(6))).toBe(strong[0].maxHp);
  });

  it('eine Niederlage verletzt, ein knapper Sieg auch, ein klarer nicht', () => {
    const beaten = rpg(0);
    applyFightOutcome(beaten, { playerWon: false, rounds: 5, playerHp: 0, opponentHp: 14, log: [] }, playerMaxHp(beaten));
    expect(beaten.hp).toBe(1);
    expect(isInjured(beaten)).toBe(true);
    expect(beaten.injuryTicks).toBeGreaterThan(60);

    const scraped = rpg(0);
    applyFightOutcome(scraped, { playerWon: true, rounds: 6, playerHp: 20, opponentHp: 0, log: [] }, playerMaxHp(scraped));
    expect(scraped.hp).toBe(20);
    expect(isInjured(scraped)).toBe(true);

    const fine = rpg(0);
    applyFightOutcome(fine, { playerWon: true, rounds: 4, playerHp: 55, opponentHp: 0, log: [] }, playerMaxHp(fine));
    expect(fine.hp).toBe(55);
    expect(isInjured(fine)).toBe(false);
  });

  it('die Verletzung bremst die Beine, die Simulationsuhr nicht', () => {
    const fit = { ...newPlayerRpg(), speedLevel: 6 };
    const hurt = { ...fit, injuryTicks: 10 };
    expect(playerStepsPerTick(fit)).toBe(3);
    expect(playerStepsPerTick(hurt)).toBe(2);
    expect(playerMaxHp(hurt)).toBe(playerMaxHp(fit));
    expect(isInjured(hurt)).toBe(true);
  });
});
