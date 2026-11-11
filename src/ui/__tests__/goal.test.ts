/** @test-target: src/ui/goal.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { startGoal } from '../goal';

describe('Startziel im HUD', () => {
  it('zeigt zuerst den Barkauf mit Fortschritt aus dem Portemonnaie', () => {
    const goal = startGoal({ barPurchased: false, wallet: fromVC(12.5), house: fromVC(900) });
    expect(goal.id).toBe('BAR');
    expect(goal.percent).toBe(25);
    expect(goal.text).toContain('50 VC');
  });

  it('zeigt nach dem Barkauf die Miete aus dem Hauskonto', () => {
    const goal = startGoal({ barPurchased: true, wallet: fromVC(0), house: fromVC(125) });
    expect(goal.id).toBe('RENT');
    expect(goal.percent).toBe(25);
    expect(goal.text).toContain('500 VC');
  });

  it('begrenzt den Fortschritt auf 0 bis 100 Prozent', () => {
    expect(startGoal({ barPurchased: true, wallet: fromVC(0), house: fromVC(5000) }).percent).toBe(100);
    expect(startGoal({ barPurchased: false, wallet: fromVC(0), house: fromVC(0) }).percent).toBe(0);
  });
});
