/** Spielhistorie im Charakterfenster: die letzten Etappen aus dem Archiv, keine zweite Chronik. */
import type { PlayerHistoryEntry } from '../core/sim/player-history';

interface Props {
  readonly history: readonly PlayerHistoryEntry[];
}

export function CareerHistory({ history }: Props) {
  return (
    <section className="career-log" aria-label="Spielhistorie">
      <div className="career-head">
        <strong>SPIELHISTORIE</strong>
        <span>{history.length === 0 ? 'noch leer' : `letzte ${history.length}`}</span>
      </div>
      {history.length === 0 ? (
        <p className="hint">Noch keine Etappen: Kaempfe und der Buden-Kauf landen hier, sobald sie passieren.</p>
      ) : (
        <ul className="career-history" aria-label="Letzte Etappen">
          {history.map((entry) => (
            <li key={entry.id}>
              <span>{entry.label}</span>
              <b>Tag {entry.day}</b>
              <small>{entry.detail}</small>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
