/** Abgeschlossene Szenen als Rueckblick im Journal; nur Anzeige des Snapshots. */
import type { NarrativeView } from '../core/sim/narrative/view-types';

const STATUS_LABEL: Record<string, string> = {
  RESOLVED: 'entschieden',
  EXPIRED: 'Frist abgelaufen',
  CANCELLED: 'abgebrochen',
};

/** Bekannte Abschluss-Codes lesbar machen; unbekannte bleiben als Code sichtbar. */
const RESOLUTION_LABEL: Record<string, string> = {
  DEADLINE: 'Frist',
  MISSING_PARTICIPANT: 'Teilnehmer fehlt',
  DUPLICATE_SUPERSEDED: 'durch neuere Szene ersetzt',
};

interface Props {
  readonly narrative: NarrativeView;
}

export function JournalStories({ narrative }: Props) {
  const history = narrative.history;
  if (history.length === 0) {
    return <p className="empty">Noch keine abgeschlossene Geschichte. Sobald eine Szene endet, steht ihr Ausgang hier.</p>;
  }
  return (
    <ol className="journal-list">
      {history.map((entry) => (
        <li key={entry.id} className={`journal-row kind-story story-${entry.status.toLowerCase()}`}>
          <div className="journal-meta">
            <span className="journal-kind">{STATUS_LABEL[entry.status] ?? entry.status}</span>
            <span>Takt {entry.tick}</span>
            {entry.participants.length > 0 && <span>{entry.participants.join(' · ')}</span>}
          </div>
          <strong>{entry.title}</strong>
          {entry.resolution !== null && (
            <p>
              <span className="journal-label">Ausgang</span>
              {' '}
              {RESOLUTION_LABEL[entry.resolution] ?? entry.resolution}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
