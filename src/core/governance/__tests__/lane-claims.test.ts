/**
 * @test-target: scripts/lib/lane-claims.mjs
 * @error-code: ERR-4019
 *
 * Ein Claim ist der Vertrag einer Lane, kein Token pro Pull Request. Nach dem
 * Merge muss die Lane ihren Branch fuer einen Register-Nachtrag weiterfuehren
 * koennen, ohne einen neuen Claim anzulegen - sonst stuende nach jedem Merge
 * genau ein offener Claim mit bereits gemergtem PR im Register.
 */
import { describe, expect, it } from 'vitest';
import { selectClaim } from '../../../../scripts/lib/lane-claims.mjs';

const open = { id: 'lane/x/offen', branch: 'lane/x/offen', status: 'open' };
const merged = { id: 'lane/x/gemergt', branch: 'lane/x/gemergt', status: 'merged' };

describe('lane-claims claim selection', () => {
  it('waehlt den offenen Claim einer Lane', () => {
    expect(selectClaim([open, merged], 'lane/x/offen')).toBe(open);
  });

  it('fuehrt eine gemergte Lane unter ihrem Claim weiter', () => {
    expect(selectClaim([open, merged], 'lane/x/gemergt')).toBe(merged);
  });

  it('liefert ohne Claim null und damit fail-closed', () => {
    expect(selectClaim([open, merged], 'lane/x/unbekannt')).toBeNull();
  });
});
