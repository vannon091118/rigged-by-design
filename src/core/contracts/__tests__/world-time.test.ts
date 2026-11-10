/**
 * @test-target: src/core/contracts/world-time.ts
 * @error-code: ERR-1002
 *
 * Contract world-time v1.0: WorldTime, Calendar-Bezug und TimeDomain-Schlüssel.
 */
import { describe, expect, it } from 'vitest';
import type { TimeDomain } from '../world-time';
import { ACTOR_ID_PREFIXES } from '../actor-id';
import {
  TICK_MS,
  TICKS_PER_DAY,
  dayFromTick,
  tickInDay,
  isDayStart,
  timeKey,
} from '../world-time';

describe('Contract: world-time v1.0', () => {
  it('legt TICK_MS auf 520 ms fest', () => {
    expect(TICK_MS).toBe(520);
  });

  it('legt TICKS_PER_DAY auf 600 Ticks fest', () => {
    expect(TICKS_PER_DAY).toBe(600);
  });

  it('berechnet den Simulations-Tag aus einem Tick', () => {
    expect(dayFromTick(0)).toBe(0);
    expect(dayFromTick(1)).toBe(0);
    expect(dayFromTick(599)).toBe(0);
    expect(dayFromTick(600)).toBe(1);
    expect(dayFromTick(1199)).toBe(1);
    expect(dayFromTick(1200)).toBe(2);
  });

  it('berechnet den Tick im aktuellen Tag (0-basiert)', () => {
    expect(tickInDay(0)).toBe(0);
    expect(tickInDay(300)).toBe(300);
    expect(tickInDay(600)).toBe(0);
    expect(tickInDay(900)).toBe(300);
  });

  it('erkennt den Beginn eines neuen Tages', () => {
    expect(isDayStart(0)).toBe(true);
    expect(isDayStart(600)).toBe(true);
    expect(isDayStart(1200)).toBe(true);
    expect(isDayStart(1)).toBe(false);
    expect(isDayStart(599)).toBe(false);
    expect(isDayStart(601)).toBe(false);
  });

  it('erstellt deterministische Zeit-Schlüssel', () => {
    const key1 = timeKey(100, 'gameplay');
    const key2 = timeKey(100, 'gameplay');
    const key3 = timeKey(100, 'presentation');

    expect(key1).toBe('gameplay:100');
    expect(key2).toBe(key1); // gleiches Ergebnis für gleiche Eingabe
    expect(key3).not.toBe(key1); // unterschiedliche Domänen
  });

  it('TimeDomain-Typ hat die erwarteten Werte', () => {
    const domain: TimeDomain = 'gameplay';
    expect(domain).toBe('gameplay');
  });

  it('ACTOR_ID_PREFIXES ist verfügbar für Contract-Referenzen', () => {
    expect(Object.keys(ACTOR_ID_PREFIXES).length).toBeGreaterThan(0);
  });
});
