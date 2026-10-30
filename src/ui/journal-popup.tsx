/** Ereignisprotokoll: was passiert ist, warum, und was daraus folgt. */
import { useState } from 'react';
import { journalEntries, type JournalKind } from '../core/sim/journal';
import type { GameView } from '../store/types';
import { vc } from './format';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onGuest: (id: number) => void;
}

const TABS: readonly { id: JournalKind | 'ALL'; label: string }[] = [
  { id: 'ALL', label: 'Alles' },
  { id: 'MONEY', label: 'Geld' },
  { id: 'GUEST', label: 'Gäste' },
  { id: 'STAFF', label: 'Personal' },
  { id: 'STOCK', label: 'Lager' },
  { id: 'RIVAL', label: 'Rivalen' },
  { id: 'SYSTEM', label: 'System' },
];

const KIND_LABEL: Record<JournalKind, string> = {
  MONEY: 'Geld', GUEST: 'Gast', STAFF: 'Personal', STOCK: 'Lager', RIVAL: 'Rivale', SYSTEM: 'System',
};

export function JournalPopup({ view, onClose, onGuest }: Props) {
  const [kind, setKind] = useState<JournalKind | 'ALL'>('ALL');
  const events = [...journalEntries(view.journal, kind, 80)].reverse();
  return (
    <PopupShell eyebrow="NACHVOLLZIEHBAR" title="Ereignisprotokoll" onClose={onClose} wide>
      <p className="hint">
        Jede Zeile nennt Ursache und Folge. „Geld“ sind echte Buchungen, die übrigen Arten sind Entscheidungen und Zustände.
      </p>
      <div className="journal-tabs" role="tablist" aria-label="Protokoll filtern">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={kind === tab.id}
            className={`journal-tab${kind === tab.id ? ' active' : ''}`}
            onClick={() => setKind(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {events.length === 0 ? (
        <p className="empty">Noch keine Ereignisse. Sobald Geld, Gäste oder Personal etwas tun, steht es hier.</p>
      ) : (
        <ol className="journal-list">
          {events.map((event) => {
            const guestId = event.refs?.guestId;
            const guestExists = guestId !== undefined && view.guests.some((guest) => guest.id === guestId);
            return (
              <li key={event.id} className={`journal-row kind-${event.kind.toLowerCase()}`}>
                <div className="journal-meta">
                  <span className="journal-kind">{KIND_LABEL[event.kind]}</span>
                  <span>Tag {event.day} · Takt {event.tick}</span>
                  {event.amount !== undefined && <b>{vc(event.amount, 2)}</b>}
                </div>
                <strong>{event.subject}</strong>
                <p><span className="journal-label">Ursache</span> {event.cause}</p>
                <p><span className="journal-label">Folge</span> {event.effect}</p>
                {guestExists && (
                  <button type="button" className="btn tiny ghost" onClick={() => onGuest(guestId)}>
                    GAST ANSEHEN
                  </button>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </PopupShell>
  );
}
