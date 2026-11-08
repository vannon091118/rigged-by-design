/**
 * @vitest-environment jsdom
 * @test-target: src/ui/self-exclusion-panel.tsx | @error-code: ERR-3001
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Ledger } from '../../core/economy/ledger';
import { fromVC } from '../../core/economy/vacoin';
import { EXTERNAL, EXTERNAL_WORK, PLAYER_CASH } from '../../core/sim/money';
import { createWorld } from '../../core/sim/templates';
import { buildView } from '../../store/snapshot';
import { SelfExclusionPanel } from '../self-exclusion-panel';

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function viewWithBonus(bonusVC = 7) {
  const world = createWorld('SMALL');
  const ledger = new Ledger();
  ledger.transfer(EXTERNAL, EXTERNAL_WORK, fromVC(bonusVC), 'reserve', 0);
  ledger.transfer(EXTERNAL_WORK, PLAYER_CASH, fromVC(bonusVC), 'pakt', 0);
  return buildView(world, ledger, '');
}

describe('Self-Exclusion-Panel', () => {
  it('bietet das Bonus-Guthaben als echten CASH_OUT-Command an', () => {
    const onExclusion = vi.fn();
    render(<SelfExclusionPanel view={viewWithBonus()} onExclusion={onExclusion} />);

    fireEvent.click(screen.getByRole('button', { name: /BONUS AUSZAHLEN/i }));

    expect(onExclusion).toHaveBeenCalledWith('CASH_OUT');
  });

  it('zeigt ohne Bonus-Guthaben keinen Auszahlungs-Button', () => {
    render(
      <SelfExclusionPanel
        view={buildView(createWorld('SMALL'), new Ledger(), '')}
        onExclusion={vi.fn()}
      />,
    );

    expect(screen.queryByRole('button', { name: /BONUS AUSZAHLEN/i })).toBeNull();
  });
});
