/**
 * @vitest-environment jsdom
 * @test-target: src/ui/hud-labels.ts
 * @error-code: ERR-3001
 *
 * HUD-Texte: Schwellen bleiben stabil, damit Ruf und Laune nicht springen.
 */
import { describe, expect, it } from 'vitest';
import { MOOD_LABEL, PENALTY_LABEL, reputationOf, SKILLS } from '../hud-labels';

describe('hud-labels', () => {
  it('nennt den Ruf als Wort und Ton an den Schwellen', () => {
    expect(reputationOf(70)).toEqual({ label: 'angesehen', tone: 'ok' });
    expect(reputationOf(69)).toEqual({ label: 'solide', tone: '' });
    expect(reputationOf(40)).toEqual({ label: 'solide', tone: '' });
    expect(reputationOf(39)).toEqual({ label: 'ramponiert', tone: 'warn' });
  });

  it('uebersetzt Laune und Strafen in Spielerworte', () => {
    expect(MOOD_LABEL(65)).toBe('gut');
    expect(MOOD_LABEL(64)).toBe('gemischt');
    expect(MOOD_LABEL(39)).toBe('gereizt');
    expect(PENALTY_LABEL('UNSAFE_REPUTATION')).toBe('Unsicherer Ruf');
    expect(PENALTY_LABEL('MOOD_SHOCK')).toBe('Stimmungsschock');
    expect(PENALTY_LABEL('ROBBED')).toBe('Ausgeraubt');
  });

  it('fuehrt alle sieben Attribute mit Kuerzel und Tipp', () => {
    expect(SKILLS.map(([attribute]) => attribute)).toEqual([
      'speed', 'charisma', 'brawl', 'perception', 'technique', 'endurance', 'luck',
    ]);
    for (const [, label, hint] of SKILLS) {
      expect(label).toHaveLength(3);
      expect(hint.length).toBeGreaterThan(10);
    }
  });
});
