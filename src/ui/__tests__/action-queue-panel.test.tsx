/**
 * @vitest-environment jsdom
 * @test-target: src/ui/action-queue-panel.tsx
 * @error-code: ERR-3001
 *
 * Die Queue ist die sichtbare Auftragskette: auch der fuenfte Auftrag muss
 * erreichbar und abbrechbar bleiben. Die Liste scrollt, statt Eintraege
 * stillschweigend abzuschneiden.
 */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView } from '../../store/types';
import type { ActionTaskView } from '../../core/sim/action-queue';
import { ActionQueuePanel } from '../action-queue-panel';

afterEach(() => cleanup());

function task(index: number): ActionTaskView {
  return {
    id: `task-${index}`,
    kind: 'MOVE',
    status: index === 1 ? 'ACTIVE' : 'QUEUED',
    step: 'TO_TARGET',
    label: `Auftrag ${index}`,
    detail: 'Zum Ziel laufen …',
    progress: 0,
  };
}

describe('ActionQueuePanel', () => {
  it('rendert alle Auftraege und meldet jeden Abbruch mit seiner ID', () => {
    const tasks = Array.from({ length: 5 }, (_, index) => task(index + 1));
    const view = { queue: tasks } as unknown as GameView;
    const cancel = vi.fn();

    render(<ActionQueuePanel view={view} onCancel={cancel} />);

    expect(screen.getAllByRole('listitem')).toHaveLength(5);
    const cancelButtons = screen.getAllByRole('button', { name: /abbrechen$/ });
    expect(cancelButtons).toHaveLength(5);

    fireEvent.click(cancelButtons[4]!);
    expect(cancel).toHaveBeenCalledWith('task-5');
  });
});
