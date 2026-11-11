/** Veranstaltungs-Historie: Phasen und Ergebnis der vorhandenen Event-Instanz. */
import type { VenueView } from '../core/sim/venue-event';

/** Nur die juengsten Abschluesse; die Sektion bleibt eine Liste, kein Kalender. */
const VISIBLE = 3;

export function VenueHistory({ venue }: { readonly venue: VenueView }) {
  if (venue.history.length === 0) return null;
  return (
    <section className="venue-history" aria-label="Veranstaltungen">
      <div className="career-head">
        <strong>VERANSTALTUNGEN</strong>
        <span>{venue.history.length} im Archiv</span>
      </div>
      <ul className="career-history" aria-label="Veranstaltungshistorie">
        {venue.history.slice(0, VISIBLE).map((entry) => (
          <li key={entry.id}>
            <span>{entry.label}</span>
            <b>{entry.phaseLabel}</b>
            <small>{entry.result ?? 'Ohne Ergebnis beendet.'}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
