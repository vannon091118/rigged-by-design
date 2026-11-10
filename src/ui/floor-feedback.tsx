/** Floor-Rueckmeldung: Hinweise, Story-/Dialog-/Stadt-Einstiege und Toast. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';
import { ActionQueuePanel } from './action-queue-panel';

interface Props {
  readonly view: GameView;
  readonly onOpen: (popup: Popup) => void;
}

/** Alles, was ueber dem Floor liegt, aber keinen zweiten Zustand fuehrt. */
export function FloorFeedback({ view, onOpen }: Props) {
  return (
    <>
      <ActionQueuePanel view={view} onCancel={(taskId) => worldStore.queue.cancel(taskId)} />
      <div className="live-region" role="status" aria-live="polite">
        {view.notice || view.lastEvent}
      </div>

      {view.lastEvent && !view.notice && <div className="event-line" aria-hidden="true">{view.lastEvent}</div>}

      {view.narrative.events.length > 0 && (
        <button type="button" className="narrative-chip"
          onClick={() => onOpen({ kind: 'narrative' })}
          title="Aktive Szenen und Figuren öffnen">
          STORY · {view.narrative.events.length}
        </button>
      )}

      <button type="button" className="narrative-chip dialogue-chip" title="Comic-Dialog oeffnen"
        onClick={() => onOpen({ kind: 'dialogue' })}>DIALOG</button>

      <button type="button" className="narrative-chip city-chip" title="Stadt: Kiez und Markt"
        onClick={() => onOpen({ kind: 'city' })}>STADT</button>

      {view.notice && (
        <button type="button" className="toast" onClick={() => worldStore.dismiss()}>{view.notice}</button>
      )}
    </>
  );
}
