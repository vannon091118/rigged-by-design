/**
 * @test-target: scripts/lib/pr-body.mjs
 * @error-code: ERR-4006
 *
 * Der PR-Body wird im Plan geprueft. Die exakten Ueberschriften und echte
 * `- `-Zeilen sind Pflicht; eine leere Sektion ist rot.
 */
import { describe, expect, it } from 'vitest';
import { checkPrBody, PR_BODY_SECTIONS } from '../../../../scripts/lib/pr-body.mjs';

const valid = `${PR_BODY_SECTIONS[0]}\n- echte Aenderung\n\n${PR_BODY_SECTIONS[1]}\n- echte Begruendung\n\n${PR_BODY_SECTIONS[2]}\n- echte Fortsetzung\n`;

describe('pr-body', () => {
  it('akzeptiert die drei Pflichtsektionen mit Inhalt', () => {
    expect(checkPrBody(valid)).toEqual({ ok: true, missing: [], empty: [] });
  });

  it('meldet fehlende Sektionen', () => {
    const result = checkPrBody(`${PR_BODY_SECTIONS[0]}\n- nur eine\n`);
    expect(result.ok).toBe(false);
    expect(result.missing).toHaveLength(2);
  });

  it('meldet leere und falsch geordnete Sektionen', () => {
    const result = checkPrBody(`${PR_BODY_SECTIONS[1]}\n- b\n\n${PR_BODY_SECTIONS[0]}\n- a\n`);
    expect(result.ok).toBe(false);
    expect(result.empty.join(' ')).toContain('falsche Reihenfolge');
  });

  it('akzeptiert keine ASCII-Variante der Pflichtueberschrift', () => {
    const ascii = valid.replace('Kausalität', 'Kausalitaet');
    expect(checkPrBody(ascii).missing).toContain(PR_BODY_SECTIONS[1]);
  });
});
