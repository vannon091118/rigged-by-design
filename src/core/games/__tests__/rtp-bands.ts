/**
 * Gemeinsame Parameter der RTP-Monte-Carlo-Laeufe. Kein Testfall: die Messung
 * liegt hier, damit mehrere Testdateien sie parallel in eigenen Workern fahren
 * koennen, statt eine Datei mit synchronen Schleifen den ganzen Lauf zu blockieren.
 */
import { Prng } from '../../rng/prng';
import { randomSeed } from '../../../test/random-seed';
import type { GameId } from '../../sim/types';
import { playRound } from '../round';

type Band = readonly [number, number];

const ROUNDS: Readonly<Record<GameId, number>> = {
  SLOT: 200_000, BLACKJACK: 100_000, ROULETTE: 100_000, SHELL: 300_000, DICE: 100_000, PLINKO: 5_000,
  POKER: 400_000, VIDEO_POKER: 400_000,
};

/**
 * RTP-Band je Spiel, aus gemessener Streuung abgeleitet (6-30 frische Seeds je Spiel,
 * Monte-Carlo-Standardfehler auf die konfigurierte Rundenzahl hochgerechnet):
 * POKER 0,9132 +- 0,0110 | PLINKO 0,9225 +- 0,0097 | SLOT 0,9196 +- 0,0049 |
 * VIDEO_POKER 0,9132 +- 0,0110: VIDEO_POKER ist der fruehere POKER-Wert, die Messung
 * lief weiter, nur der Name des Trägers wanderte um.
 * SHELL 0,9510 +- 0,0031 | ROULETTE 0,9461 +- 0,0026 | BLACKJACK 0,9395 +- 0,0020.
 * Ein einheitliches 0,90-0,96-Band kippte dadurch bei POKER in rund 11 % und bei
 * PLINKO in rund 1 % der Laeufe. Diese Baender halten ueber 4 Sigma Abstand zu den
 * gemessenen Mittelwerten und fangen trotzdem kaputte Auszahlungstabellen
 * (das zu centerlastige Plinko-Brett liegt gemessen bei 0,85).
 */
export const RTP_BAND: Readonly<Record<GameId, Band>> = {
  SLOT: [0.895, 0.96], BLACKJACK: [0.9, 0.96], ROULETTE: [0.9, 0.96], DICE: [0.9, 0.96],
  POKER: [0.86, 0.96], VIDEO_POKER: [0.86, 0.96], PLINKO: [0.87, 0.97], SHELL: [0.9, 0.97],
};

/** Ein Monte-Carlo-Lauf mit frischem Seed; liefert RTP und Trefferquote. */
export function measureRound(game: GameId): { rtp: number; hitRate: number; rounds: number } {
  const rounds = ROUNDS[game];
  const prng = new Prng(randomSeed());
  let returned = 0;
  let winners = 0;
  for (let index = 0; index < rounds; index += 1) {
    const result = playRound(game, prng);
    returned += result.multiplierBps;
    // Treffer ist jede Auszahlung ueber null; ein haeufiges Teil-Payout zaehlt
    // als Treffer, auch wenn der Netto-Spin ein Verlust bleibt.
    if (result.multiplierBps > 0) winners += 1;
  }
  return { rtp: returned / rounds / 10_000, hitRate: winners / rounds, rounds };
}
