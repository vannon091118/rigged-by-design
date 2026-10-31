/**
 * @test-target: src/core/games/round.ts
 * @error-code: ERR-1003
 *
 * Eigene Datei statt einer Schleife in round.test.ts: Vitest verteilt Dateien
 * auf Worker, synchrone Schleifen innerhalb einer Datei laufen dagegen seriell.
 * Die teuren Spiele liegen zusammen, damit die kleine Datei den Lauf nicht blockiert.
 */
import { describe, expect, it } from 'vitest';
import type { GameId } from '../../sim/types';
import { measureRound, RTP_BAND } from './rtp-bands';

const GAMES: readonly GameId[] = ['POKER', 'SHELL', 'PLINKO'];

describe('RTP der teuren Spiele', () => {
  it.each(GAMES)('%s zahlt im gemessenen Band aus und zeigt Gewinner', { timeout: 180_000 }, (game) => {
    const { rtp, hitRate, rounds } = measureRound(game);
    const [low, high] = RTP_BAND[game];
    expect(rtp, `${game} RTP bei ${rounds} Runden`).toBeGreaterThan(low);
    expect(rtp, `${game} RTP bei ${rounds} Runden`).toBeLessThan(high);
    expect(hitRate, `${game} Gewinnrate`).toBeGreaterThan(0.25);
    expect(hitRate, `${game} Gewinnrate`).toBeLessThan(0.7);
  });
});
