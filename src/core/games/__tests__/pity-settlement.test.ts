/** @test-target: src/core/games/slot-transparency.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../economy/vacoin';
import { settleSlotSpin } from '../slot-transparency';

describe('Entladung als Vorschuss', () => {
  it('darf das Polster überziehen statt einen zweiten Gewinn zu addieren', () => {
    const settled = settleSlotSpin(fromVC(0), fromVC(1), fromVC(2.5), true);
    expect(settled.payout).toBe(fromVC(2.5));
  });

  it('führt den Vorschuss als negativen Stand', () => {
    const settled = settleSlotSpin(fromVC(0), fromVC(1), fromVC(2.5), true);
    expect(settled.withheld).toBe(fromVC(-1.5));
  });

  it('holt den Vorschuss aus dem nächsten Gewinn zurück', () => {
    const settled = settleSlotSpin(fromVC(-1.5), fromVC(1), fromVC(2.5), false);
    expect(settled.payout).toBe(fromVC(2));
  });

  it('zahlt ohne Vorschuss den vollen Gewinn', () => {
    const settled = settleSlotSpin(fromVC(5), fromVC(1), fromVC(2.5), false);
    expect(settled.payout).toBe(fromVC(2.5));
  });
});
