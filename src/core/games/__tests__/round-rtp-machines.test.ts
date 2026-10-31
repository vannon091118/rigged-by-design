/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Zweite Datei für die günstigen Spiele: sie läuft in einem eigenen Worker
 * parallel zu den teuren Läufen, statt in derselben Datei hinter ihnen zu warten.
 */
import { describe, expect, it } from 'vitest';
import type { GameId } from '../../sim/types';
import { measureRound, RTP_BAND } from './rtp-bands';

const GAMES: readonly GameId[] = ['SLOT', 'BLACKJACK', 'ROULETTE', 'DICE'];

describe('RTP der Automaten und Tische', () => {
  it.each(GAMES)('%s zahlt im gemessenen Band aus und zeigt Gewinner', { timeout: 180_000 }, (game) => {
    const { rtp, hitRate, rounds } = measureRound(game);
    const [low, high] = RTP_BAND[game];
    expect(rtp, `${game} RTP bei ${rounds} Runden`).toBeGreaterThan(low);
    expect(rtp, `${game} RTP bei ${rounds} Runden`).toBeLessThan(high);
    expect(hitRate, `${game} Gewinnrate`).toBeGreaterThan(0.25);
    expect(hitRate, `${game} Gewinnrate`).toBeLessThan(0.7);
  });
});
