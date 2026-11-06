/** Untere Leiste: vier Ecken statt elf Tabs. Alles andere lebt in der Werkstatt. */
import type { Popup } from './app-model';
import type { GameView } from '../store/types';
import { vc } from './format';

interface DockProps {
  readonly view: GameView;
  readonly onBuild: () => void;
  readonly onOpen: (popup: Popup) => void;
  readonly onClean: () => void;
}

type TabId = 'build' | 'guests' | 'map' | 'self';

const TABS: readonly { readonly id: TabId; readonly label: string; readonly hint: string }[] = [
  { id: 'build', label: 'BAUEN', hint: 'Angebot, Personal, Preise und Lager' },
  { id: 'guests', label: 'GÄSTE', hint: 'Wer da ist, was er zahlt und was er will' },
  { id: 'map', label: 'KARTE', hint: 'Fremde Casinos und Reisen' },
  { id: 'self', label: 'DU', hint: 'Charakter und Werkstatt' },
];

export function Dock({ view, onBuild, onOpen, onClean }: DockProps) {
  const dirty = view.dirtyTiles.size;
  const waiting = view.guests.filter((guest) => (view.guestMoney[guest.id]?.pending ?? 0) > 0).length;
  const cleaningCost = view.prices.cleaningCost * dirty;

  const open = (id: TabId): void => {
    if (id === 'build') { onBuild(); return; }
    if (id === 'guests') { onOpen({ kind: 'guests', guestId: null }); return; }
    if (id === 'map') { onOpen({ kind: 'foreignMap' }); return; }
    onOpen({ kind: 'workshop' });
  };

  return (
    <nav className="dock" aria-label="Hauptbereiche">
      {dirty > 0 && (
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
        {TABS.map((tab) => (
          <button key={tab.id} type="button" className="dock-tab" onClick={() => open(tab.id)} title={tab.hint}>
            <span>{tab.label}</span>
            {tab.id === 'guests' && waiting > 0 && <b className="badge">{waiting}</b>}
          </button>
        ))}
      </div>
    </nav>
  );
}
