/** Untere Leiste: vier Ecken je Perspektive. Alles andere lebt in der Werkstatt. */
import type { GameView } from '../store/types';
import type { Perspective, Popup } from './app-model';
import { vc } from './format';

interface DockProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onPlay: () => void;
  readonly onBuild: () => void;
  readonly onOpen: (popup: Popup) => void;
  readonly onClean: () => void;
}

type TabId = 'play' | 'history' | 'rules' | 'build' | 'guests' | 'map' | 'self';

const GUEST_TABS: readonly { readonly id: TabId; readonly label: string; readonly hint: string }[] = [
  { id: 'play', label: 'SPIELEN', hint: 'Zurück auf den Floor: Gerät antippen und direkt spielen' },
  { id: 'history', label: 'VERLAUF', hint: 'Was auf dem Floor und mit deinem Geld passiert ist' },
  { id: 'rules', label: 'REGELN', hint: 'Spiele, Einsätze, Auszahlung und Steuerung' },
  { id: 'self', label: 'DU', hint: 'Deine Spielfigur' },
];

const OPERATOR_TABS: readonly { readonly id: TabId; readonly label: string; readonly hint: string }[] = [
  { id: 'build', label: 'BETRIEB', hint: 'Angebot, Personal, Preise, Lager und Wartung' },
  { id: 'guests', label: 'GÄSTE', hint: 'Wer da ist, was er zahlt und was er will' },
  { id: 'map', label: 'KARTE', hint: 'Fremde Casinos und Reisen' },
  { id: 'self', label: 'DU', hint: 'Charakter und Werkstatt' },
];

export function Dock({ view, perspective, onPlay, onBuild, onOpen, onClean }: DockProps) {
  const dirty = view.dirtyTiles.size;
  const waiting = view.guests.filter((guest) => (view.guestMoney[guest.id]?.pending ?? 0) > 0).length;
  const cleaningCost = view.prices.cleaningCost * dirty;
  const tabs = perspective === 'guest' ? GUEST_TABS : OPERATOR_TABS;

  const open = (id: TabId): void => {
    if (id === 'play') { onPlay(); return; }
    if (id === 'build') { onBuild(); return; }
    if (id === 'guests') { onOpen({ kind: 'guests', guestId: null }); return; }
    if (id === 'map') { onOpen({ kind: 'foreignMap' }); return; }
    if (id === 'history') { onOpen({ kind: 'workshop', tool: 'journal' }); return; }
    if (id === 'rules') { onOpen({ kind: 'workshop', tool: 'help' }); return; }
    onOpen({ kind: 'workshop', tool: perspective === 'guest' ? 'look' : undefined });
  };

  return (
    <nav className={`dock ${perspective}`} aria-label={perspective === 'guest' ? 'Gastbereiche' : 'Betriebsbereiche'}>
      {perspective === 'operator' && dirty > 0 && (
        <button
          type="button"
          className={`dock-utility${view.house < cleaningCost ? ' is-poor' : ''}`}
          onClick={onClean}
          disabled={view.house < cleaningCost}
          title={`Alles putzen für ${vc(cleaningCost, 2)}`}
        >
          <span>PUTZEN</span>
          <b>{dirty}</b>
          <small>{vc(cleaningCost, 2)}</small>
        </button>
      )}
      <div className="dock-tabs">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className="dock-tab" onClick={() => open(tab.id)} title={tab.hint}>
            <span>{tab.label}</span>
            {tab.id === 'guests' && waiting > 0 && <b className="badge">{waiting}</b>}
          </button>
        ))}
      </div>
    </nav>
  );
}
