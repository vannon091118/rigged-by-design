import { fromVC } from '../core/economy/vacoin';
import type { BusinessWorkTask, BusinessWorkView } from '../core/sim/business-active-work';
import type { RenovationView } from '../core/sim/renovation';
import { worldStore } from '../store/use-world-store';
import { vc } from './format';

/**
 * Aktive Betreiberarbeit als eigener Block: die Verwaltungsansicht zeigt, welche
 * Aufgabe gerade geht und warum nicht. Ausgefuehrt wird sie im Floor ueber die
 * kontextuelle Leiste; hier steht dieselbe echte Handlung als zweiter Einstieg.
 */
export function CareerPropertyWork({ work }: { readonly work: BusinessWorkView }) {
  return (
    <>
      <div className="career-grid" aria-label="Eigene Betriebsarbeit">
        <div><span>Letzte Schicht</span><b>{work.lastShift ?? 'noch keine'}</b></div>
        <div><span>Flaeche</span><b>{work.area ?? 'ausserhalb'}{work.onSite ? ' · du bist vor Ort' : ' · nicht vor Ort'}</b></div>
        <div><span>Hinweis</span><b>{work.note}</b></div>
      </div>
      <ul className="career-property-offers" aria-label="Betriebsaufgaben">
        {work.tasks.map((task: BusinessWorkTask) => (
          <li key={task.id}>
            <div>
              <b>{task.label}</b>
              <small>{task.station} · {task.skill} · {task.effect}</small>
            </div>
            <button
              type="button"
              className={`btn small${task.ready ? ' primary' : ' ghost'}`}
              disabled={!task.ready}
              title={task.reason}
              onClick={() => worldStore.workBusiness(task.id)}
            >
              {task.ready ? 'Ausführen' : task.reason}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
/** Renovierung des Betriebs: Zustand, Material und naechste Stufe aus derselben Sicht. */
export function CareerPropertyRenovation({ renovation, onRenovate }: {
  readonly renovation: RenovationView;
  readonly onRenovate?: () => void;
}) {
  return (
    <div className="career-grid" aria-label="Renovierung">
      <div><span>Zustand</span><b>{renovation.label}</b></div>
      <div><span>Material</span><b>{renovation.parts} Ersatzteile im Lager</b></div>
      <div>
        <span>Nächste Stufe</span>
        {renovation.step === null ? (
          <b>keine</b>
        ) : (
          <button
            type="button"
            className={`btn small${renovation.ready ? ' primary' : ' ghost'}`}
            disabled={!renovation.ready || onRenovate === undefined}
            title={renovation.note}
            onClick={() => onRenovate?.()}
          >
            Renovieren ({vc(fromVC(renovation.costVC))})
          </button>
        )}
      </div>
      <div><span>Hinweis</span><b>{renovation.note}</b></div>
    </div>
  );
}
