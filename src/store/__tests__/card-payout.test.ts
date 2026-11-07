/**
 * @test-target: src/store/foreign-play.ts
 * @error-code: ERR-1003
 *
 * Der Hausvorteil des fremden Hauses darf nur den Gewinn treffen. Einsatz,
 * Push und ungespieltes Ruestgeld muessen unangetastet zurueckkommen.
 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { cardPayout } from '../foreign-play';

describe('Karten-Auszahlung', () => {
  it('gibt bei einem Push den Einsatz vollstaendig zurueck', () => {
    expect(cardPayout(fromVC(1), 10_000, 210)).toBe(fromVC(1));
  });

  it('zieht den Hausvorteil nur vom Gewinn ab', () => {
    expect(cardPayout(fromVC(1), 20_000, 210)).toBe(19_790);
  });

  it('laesst Verlust und Refund ohne Abzug', () => {
    expect(cardPayout(fromVC(1), 0, 210)).toBe(0);
    expect(cardPayout(fromVC(1), 7_500, 210)).toBe(fromVC(0.75));
  });

  it('behaelt bei einer verlorenen Paar-Wette nur den Basis-Push', () => {
    expect(cardPayout(fromVC(2), 5_000, 210)).toBe(fromVC(1));
  });
});
