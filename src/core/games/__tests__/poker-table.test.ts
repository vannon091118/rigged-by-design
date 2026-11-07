/**
 * @test-target: src/core/games/poker-table.ts
 * @error-code: ERR-1003
 *
 * Rundenpoker am Tisch: Handbewertung, Side Pots nach Einsatzniveaus,
 * Fold-Abrechnung und die Trennung von Video Poker (dessen Vertrag liegt
 * in round.ts und wird ueber VIDEO_POKER bedient).
 */
import { describe, expect, it } from 'vitest';
import { randomSeed } from '../../../test/random-seed';
import { Prng } from '../../rng/prng';
import type { Card } from '../../rng/shoe';
import { createShoe, DECK_SIZE } from '../../rng/shoe';
import { playRound } from '../round';
import { bestHand, compareRank, handName } from '../poker-hand';
import { settleShowdown } from '../poker-settle';
import { humanAct, startHand, toCall } from '../poker-table';
import { POKER_STYLES } from '../poker-strategy';
import type { PokerPlayer, PokerTable } from '../poker-types';

const card = (rank: string, suit: Card['suit']): Card => ({ rank, suit });

const player = (id: string, committed: number, hole: readonly Card[], folded = false): PokerPlayer => ({
  id, human: id === 'DU', hole, stack: 0, committed, streetCommitted: committed, folded, allIn: false, acted: true,
});

describe('Poker-Tisch', () => {
  it('bewertet Siebenkarten-Haende mit Kickern und Namen', () => {
    const quads = bestHand([
      card('A', '♠'), card('A', '♥'), card('A', '♦'), card('A', '♣'),
      card('K', '♠'), card('2', '♦'), card('3', '♣'),
    ]);
    expect(quads.cat).toBe(7);
    expect(handName(quads)).toBe('Vier einerlei');

    const wheel = bestHand([
      card('A', '♠'), card('2', '♠'), card('3', '♠'), card('4', '♠'), card('5', '♠'),
      card('K', '♦'), card('Q', '♦'),
    ]);
    expect(wheel.cat).toBe(8);
    expect(wheel.kickers[0]).toBe(5);

    const broadway = bestHand([
      card('10', '♠'), card('J', '♠'), card('Q', '♠'), card('K', '♠'), card('A', '♠'),
      card('2', '♦'), card('3', '♦'),
    ]);
    expect(handName(broadway)).toBe('Royal Flush');

    const aceHigh = bestHand([card('9', '♠'), card('10', '♦'), card('J', '♣'), card('Q', '♥'), card('K', '♠')]);
    const kingHigh = bestHand([card('8', '♠'), card('9', '♦'), card('10', '♣'), card('J', '♥'), card('Q', '♠')]);
    expect(compareRank(aceHigh, kingHigh)).toBeGreaterThan(0);
  });

  it('teilt aus einem Schuh ohne doppelte Karte', () => {
    const table = startHand(new Prng(randomSeed()), { stake: 10_000 });
    const dealt = table.players.flatMap((entry) => entry.hole);
    const labels = dealt.map((entry) => `${entry.rank}${entry.suit}`);
    expect(new Set(labels).size).toBe(dealt.length);
    expect(table.shoe.remaining).toBe(DECK_SIZE - dealt.length);
  });

  it('verteilt den Pot in Ebenen und laesst den Side Pot beim Hoechsteinsatz', () => {
    const table: PokerTable = {
      players: [
        player('DU', 100, [card('A', '♠'), card('A', '♦')]),
        player('GAST 1', 300, [card('K', '♣'), card('Q', '♣')]),
        player('GAST 2', 100, [card('8', '♥'), card('6', '♥')]),
        player('GAST 3', 100, [card('2', '♥'), card('2', '♣')], true),
      ],
      board: [card('9', '♠'), card('7', '♦'), card('4', '♣'), card('J', '♥'), card('3', '♠')],
      shoe: createShoe(new Prng(randomSeed())),
      pot: 600, stake: 1000, unit: 250, street: 'SHOWDOWN', toAct: -1, bet: 300, raises: 1, result: null,
    };
    const settled = settleShowdown(table);
    // 900 Ruestgeld zurueck plus 380 vom ersten Ebene-100-Pot (400 abzueglich 5 % Hausanteil).
    expect(settled.result?.multiplierBps).toBe(12_800);
    expect(settled.result?.net).toBe(true);
    // Waere der Side Pot des Hoechsteinsatzes mitverteilt, stünde hier 14_700.
    expect(settled.result?.label).toContain('Paar');
  });

  it('gibt jedem Gast ein eigenes Profil und bucht je Spieler nur das Ante', () => {
    const table = startHand(new Prng(randomSeed()), { stake: 10_000 });
    expect(table.players.map((entry) => entry.style)).toEqual([undefined, 'FELS', 'BUCHHALTER', 'HAI']);
    expect(table.players.map((entry) => entry.stack)).toEqual([7_500, 27_500, 17_500, 7_500]);
    expect(table.players.every((entry) => entry.streetCommitted === 0)).toBe(true);
    expect(table.pot).toBe(10_000);
    expect(table.unit).toBe(2_500);
  });

  it('trennt den offenen Einsatz einer Strasse vom kumulierten Einsatz', () => {
    const table = startHand(new Prng(randomSeed()), { stake: 10_000 });
    expect(table.players[0]?.committed).toBe(2_500);
    expect(toCall(table, table.players[0]!)).toBe(0);
    const raised: PokerTable = { ...table, bet: 5_000 };
    expect(toCall(raised, raised.players[0]!)).toBe(5_000);
  });

  it('staffelt die CPU-Profile nach Range, Aggression und Einsatzgroesse', () => {
    expect(POKER_STYLES.FELS.raiseAt).toBeGreaterThan(POKER_STYLES.BUCHHALTER.raiseAt);
    expect(POKER_STYLES.BUCHHALTER.raiseAt).toBeGreaterThan(POKER_STYLES.HAI.raiseAt);
    expect(POKER_STYLES.FELS.callMargin).toBeGreaterThan(POKER_STYLES.BUCHHALTER.callMargin);
    expect(POKER_STYLES.BUCHHALTER.callMargin).toBeGreaterThan(POKER_STYLES.HAI.callMargin);
    expect(POKER_STYLES.FELS.sizing).toBeLessThan(POKER_STYLES.HAI.sizing);
  });

  it('bucht beim Mitgehen den offenen Einsatz und gibt die Strasse frei', () => {
    const table: PokerTable = {
      players: [
        { id: 'DU', human: true, hole: [card('A', '♠'), card('K', '♦')], stack: 900, committed: 100, streetCommitted: 100, folded: false, allIn: false, acted: false },
        { id: 'GAST 1', human: false, hole: [card('Q', '♣'), card('J', '♣')], stack: 0, committed: 300, streetCommitted: 300, folded: false, allIn: true, acted: true },
      ],
      board: [], shoe: createShoe(new Prng(randomSeed())),
      pot: 400, stake: 1000, unit: 250, street: 'PREFLOP', toAct: 0, bet: 300, raises: 1, result: null,
    };
    const after = humanAct(table, 'CALL', new Prng(randomSeed()));
    expect(after.players[0]?.committed).toBe(300);
    expect(after.players[0]?.stack).toBe(700);
    expect(after.street).toBe('FLOP');
    expect(after.players[0]?.acted).toBe(false);
  });

  it('oeffnet nach einem Check auf einer spaeteren Strasse keine neue Setzrunde', () => {
    const table: PokerTable = {
      players: [
        { id: 'DU', human: true, hole: [card('A', '♠'), card('K', '♦')], stack: 800, committed: 100, streetCommitted: 50, folded: false, allIn: false, acted: false },
        { id: 'GAST 1', human: false, hole: [card('Q', '♣'), card('J', '♣')], stack: 0, committed: 100, streetCommitted: 50, folded: false, allIn: true, acted: true },
      ],
      board: [card('2', '♠'), card('3', '♥'), card('4', '♦'), card('5', '♣'), card('6', '♠')],
      shoe: createShoe(new Prng(randomSeed())),
      pot: 200, stake: 1_000, unit: 50, street: 'RIVER', toAct: 0, bet: 50, raises: 0, result: null,
    };
    const after = humanAct(table, 'CHECK', new Prng(randomSeed()));
    expect(after.result).not.toBeNull();
    expect(after.toAct).toBe(-1);
    expect(after.pot).toBe(200);
  });

  it('gibt nach einem Fold nur das ungespielte Ruestgeld zurueck', () => {
    const stake = 10_000;
    const table = startHand(new Prng(randomSeed()), { stake });
    const done = humanAct(table, 'FOLD', new Prng(randomSeed()));
    expect(done.result).not.toBeNull();
    expect(done.result?.label).toBe('Aufgegeben');
    expect(done.result?.multiplierBps).toBe(7_500);
  });

  it('die Automatik-Runde bleibt eine gueltige Buchung', () => {
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 20; index += 1) {
      const round = playRound('POKER', prng);
      expect(round.detail[0]).toMatch(/^Pot \d/);
      expect(round.multiplierBps).toBeGreaterThanOrEqual(0);
      expect(Number.isSafeInteger(round.multiplierBps)).toBe(true);
    }
  });

  it('VIDEO_POKER bleibt die alte Automaten-Hand und kein Tisch', () => {
    const prng = new Prng(randomSeed());
    for (let index = 0; index < 20; index += 1) {
      const video = playRound('VIDEO_POKER', prng);
      expect(video.detail[0]).not.toMatch(/^Pot /);
      expect(video.label).not.toContain('Pot gewonnen');
      expect(video.label).not.toBe('Aufgegeben');
    }
  });

  it('lehnt einen Einsatz unter vier Mikro-VC ab', () => {
    expect(() => startHand(new Prng(randomSeed()), { stake: 3 })).toThrow(/ungueltig/);
  });
});
