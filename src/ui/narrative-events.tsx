/** NAR-14: Aktive Szenen als Karten; Auswahl und Ablehnung laufen ueber Store-Commands. */
import type { ChoiceBlockReason } from '../core/sim/narrative/events/template-types';
import type { NarrativeEventView, NarrativeView } from '../core/sim/narrative/view-types';
import { TICK_S } from '../core/sim/tick-timing';
import { vc } from './format';

const REASON_LABEL: Record<ChoiceBlockReason, string> = {
  EVENT_NOT_LIVE: 'nicht mehr aktiv',
  EVENT_EXPIRED: 'Frist abgelaufen',
  TEMPLATE_MISMATCH: 'Version passt nicht',
  CHOICE_NOT_OFFERED: 'nicht mehr angeboten',
  REQUIREMENT_NOT_MET: 'Voraussetzung fehlt',
  INSUFFICIENT_FUNDS: 'Hauskonto zu niedrig',
};

const STEP_LABEL: Record<string, string> = {
  START: 'Beginn',
  OFFER: 'Angebot',
  TALK: 'Gespräch',
  DECIDE: 'Entscheidung',
  RESOLVE: 'Abschluss',
};

interface Props {
  readonly narrative: NarrativeView;
  readonly onChoose: (eventId: number, choiceId: string) => void;
  readonly onDismiss: (eventId: number) => void;
  readonly onProfile: (visitorId: number) => void;
}

function remaining(ticks: number): string {
  const seconds = Math.max(0, Math.ceil(ticks * TICK_S));
  return seconds >= 60 ? `${Math.ceil(seconds / 60)} min` : `${seconds} s`;
}

function Scene({ event, onChoose, onDismiss, onProfile }: { event: NarrativeEventView } & Omit<Props, 'narrative'>) {
  return (
    <article className="narrative-card" aria-label={event.title}>
      <header className="narrative-card-head">
        <div>
          <span className="eyebrow">{STEP_LABEL[event.step] ?? event.step}</span>
          <h3>{event.title}</h3>
        </div>
        <span className="narrative-clock" title="Verbleibende Zeit bis die Szene verfaellt">
          {remaining(event.expiresInTicks)}
        </span>
      </header>
      <p className="narrative-body">{event.body}</p>
      {event.fallbackText && (
        <p className="hint bad">Für diese Szene fehlt passender Text; es wird die neutrale Sicherheitscopy gezeigt.</p>
      )}
      {event.participants.length > 0 && (
        <div className="narrative-participants">
          {event.participants.map((participant) => (
            <button
              key={participant.ref}
              type="button"
              className="narrative-participant"
              disabled={participant.visitorId === null}
              title={participant.visitorId === null ? 'Profil nur für Besucher' : 'Profil öffnen'}
              onClick={() => participant.visitorId !== null && onProfile(participant.visitorId)}
            >
              {participant.label}
            </button>
          ))}
        </div>
      )}
      <div className="narrative-choices">
        {event.choices.map((choice) => (
          <div key={choice.choiceId} className="narrative-choice-row">
            <button
              type="button"
              className="btn small"
              disabled={!choice.available}
              onClick={() => onChoose(event.id, choice.choiceId)}
              title={choice.available ? 'Choice ausführen' : choice.reasons.map((reason) => REASON_LABEL[reason]).join(' · ')}
            >
              {choice.label}
              {choice.cost > 0 ? ` · ${vc(choice.cost, 2)}` : ''}
            </button>
            {!choice.available && (
              <small className="narrative-reason">{choice.reasons.map((reason) => REASON_LABEL[reason]).join(' · ')}</small>
            )}
          </div>
        ))}
        {event.choices.length === 0 && <small className="hint">Keine Choice mehr offen – nur noch schließen.</small>}
      </div>
      <button type="button" className="btn tiny ghost narrative-dismiss" onClick={() => onDismiss(event.id)}
        title="Szene ablehnen; dieselbe Geschichte kann nach ihrem Cooldown wiederkommen.">
        SPÄTER
      </button>
    </article>
  );
}

export function NarrativeEvents({ narrative, onChoose, onDismiss, onProfile }: Props) {
  if (narrative.events.length === 0) {
    return <p className="empty">Gerade läuft keine Geschichte. Sobald jemand zurückkommt oder streitet, steht sie hier.</p>;
  }
  return (
    <div className="narrative-list">
      {narrative.events.map((event) => (
        <Scene key={event.id} event={event} onChoose={onChoose} onDismiss={onDismiss} onProfile={onProfile} />
      ))}
    </div>
  );
}
