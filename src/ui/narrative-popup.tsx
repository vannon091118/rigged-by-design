/** NAR-14: Popup fuer aktive Szenen und Besucherprofile. */
import { useState } from 'react';
import type { GameView } from '../store/types';
import { NarrativeEvents } from './narrative-events';
import { NarrativeProfile } from './narrative-profile';
import { PopupShell } from './popup-shell';

type Tab = 'EVENTS' | 'PROFILES';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onChoose: (eventId: number, choiceId: string) => void;
  readonly onDismiss: (eventId: number) => void;
  /** Direkter Weg aus einem Gast-Popup: oeffnet sofort dieses Profil. */
  readonly initialVisitorId?: number;
}

export function NarrativePopup({ view, onClose, onChoose, onDismiss, initialVisitorId }: Props) {
  const [tab, setTab] = useState<Tab>(initialVisitorId === undefined ? 'EVENTS' : 'PROFILES');
  const [visitorId, setVisitorId] = useState<number | null>(initialVisitorId ?? null);
  const openProfile = (id: number): void => { setVisitorId(id); setTab('PROFILES'); };
  const { events, profiles } = view.narrative;
  return (
    <PopupShell eyebrow="GESCHICHTEN" title="Szenen und Figuren" onClose={onClose} wide>
      <p className="hint">
        Szenen entstehen aus echten Vorgängen. Du entscheidest nur, was daraus wird – jede Wirkung läuft über die
        Engine, die UI rechnet nichts nach.
      </p>
      <div className="journal-tabs" role="tablist" aria-label="Narrative Bereiche">
        <button type="button" role="tab" aria-selected={tab === 'EVENTS'}
          className={`journal-tab${tab === 'EVENTS' ? ' active' : ''}`} onClick={() => setTab('EVENTS')}>
          SZENEN · {events.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'PROFILES'}
          className={`journal-tab${tab === 'PROFILES' ? ' active' : ''}`} onClick={() => setTab('PROFILES')}>
          FIGUREN · {profiles.length}
        </button>
      </div>
      {tab === 'EVENTS'
        ? <NarrativeEvents narrative={view.narrative} onChoose={onChoose} onDismiss={onDismiss} onProfile={openProfile} />
        : <NarrativeProfile narrative={view.narrative} visitorId={visitorId} onSelect={setVisitorId} />}
    </PopupShell>
  );
}
