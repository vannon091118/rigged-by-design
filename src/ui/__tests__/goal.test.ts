/** @test-target: src/ui/goal.ts | @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { fromVC } from '../../core/economy/vacoin';
import { BAR_PURCHASE_COST_VC } from '../../core/sim/player-jobs';
import type { CompanyStatus } from '../../core/sim/progression';
import { createWorld } from '../../core/sim/templates';
import { dailyHousingCost } from '../../core/sim/upkeep-costs';
import { startGoal } from '../goal';

const COMPANY: CompanyStatus = {
  tier: 'BUDE',
  name: 'Hinterhof-Bude',
  note: 'Ein Automat.',
  next: { id: 'KASSE', name: 'Bude mit Kasse' },
  open: [
    { id: 'day', label: 'Tage offen', need: 3, current: 1, met: false },
    { id: 'profit', label: 'Betriebsgewinn (VC)', need: 5, current: 2, met: false },
    { id: 'served', label: 'bediente Gäste', need: 15, current: 5, met: false },
  ],
  unlocked: ['SLOT'],
  locked: [],
};

const PRICES = createWorld('SMALL').prices;

const base = {
  barPurchased: false,
  wallet: fromVC(0),
  house: fromVC(0),
  prices: PRICES,
  company: COMPANY,
};

describe('Startziel im HUD', () => {
  it('zeigt zuerst den Barkauf aus derselben Preiskonstante wie der Kauf', () => {
    const goal = startGoal({ ...base, wallet: fromVC(12.5) });
    expect(goal.id).toBe('BAR');
    expect(goal.percent).toBe(25);
    expect(goal.target).toBe(fromVC(BAR_PURCHASE_COST_VC));
    expect(goal.text).toContain(`${BAR_PURCHASE_COST_VC} VC`);
  });

  it('leitet die erste Miete aus der echten Tagesbuchung ab', () => {
    const goal = startGoal({ ...base, barPurchased: true, house: fromVC(0.8) });
    expect(goal.id).toBe('RENT');
    expect(goal.percent).toBe(50);
    expect(goal.target).toBe(dailyHousingCost(PRICES));
    expect(goal.text).toContain('1.60 VC');
  });

  it('folgt einer geaenderten Miete statt eines festen 500-VC-Ziels', () => {
    const prices = { ...PRICES, cleaningCost: fromVC(2) };
    const goal = startGoal({ ...base, barPurchased: true, house: fromVC(1), prices });
    expect(goal.target).toBe(fromVC(4));
    expect(goal.percent).toBe(25);
    expect(goal.text).toContain('4.00 VC');
  });

  it('wechselt nach gedeckter Miete zur naechsten Firmenstufe', () => {
    const goal = startGoal({ ...base, barPurchased: true, house: fromVC(50) });
    expect(goal.id).toBe('COMPANY');
    expect(goal.label).toBe('FIRMA');
    expect(goal.percent).toBe(34);
    expect(goal.text).toContain('Bude mit Kasse');
    expect(goal.text).toContain('Tage offen 1/3');
  });

  it('zeigt nach der letzten Firmenstufe einen erklaerten Abschluss', () => {
    const goal = startGoal({ ...base, barPurchased: true, house: fromVC(50), company: { ...COMPANY, next: null, open: [] } });
    expect(goal.id).toBe('DONE');
    expect(goal.percent).toBe(100);
    expect(goal.text).toContain('Alle Firmenstufen');
  });

  it('begrenzt den Fortschritt auf 0 bis 100 Prozent', () => {
    expect(startGoal({ ...base, barPurchased: true, house: fromVC(0) }).percent).toBe(0);
    expect(startGoal({ ...base, wallet: fromVC(0) }).percent).toBe(0);
  });
});
