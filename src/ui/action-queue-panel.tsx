/** Queue-Anzeige: der aktive Auftrag und seine naechsten Schritte, direkt am Floor. */
import type { GameView } from '../store/types';

interface Props {
  readonly view: GameView;
  readonly onCancel: (taskId: string) => void;
}

export function ActionQueuePanel({ view, onCancel }: Props) {
  if (view.queue.length === 0) return null;
  return (
    <aside className="queue-panel" aria-label="Aufträge">
      <header>
        <span>AUFTRAG</span>
        <b>{view.queue.length}</b>
      </header>
      <ol>
        {view.queue.slice(0, 4).map((task) => (
          <li key={task.id} className={task.status.toLowerCase()}>
            <div className="queue-line">
              <strong>{task.label}</strong>
              <button
                type="button"
                className="queue-cancel"
                aria-label={`${task.label} abbrechen`}
                onClick={() => onCancel(task.id)}
              >
                ×
              </button>
            </div>
            <small>{task.detail}</small>
            {task.progress > 0 && task.progress < 1 && (
              <div className="queue-track"><i style={{ width: `${Math.round(task.progress * 100)}%` }} /></div>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}
