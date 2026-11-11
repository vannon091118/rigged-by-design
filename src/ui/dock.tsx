/** Untere Leiste: wenige globale Einstiege, alles andere kommt aus der Welt. */
import { useCallback, useRef } from 'react';
import type { GameView } from '../store/types';
import type { Perspective, Popup } from './app-model';
import { vc } from './format';
import { CitySceneBar, OnboardingPanel } from './onboarding-panel';

interface DockProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onPlay: () => void;
  readonly onBuild: () => void;
  readonly onOpen: (popup: Popup) => void;
  readonly onClean: () => void;
}

const BRAND_TAP_TARGET = 5;
const BRAND_TAP_WINDOW_MS = 1200;

/**
 * Der versteckte Einstieg gehoert zum Dock: fuenf Tipps auf die Marke, ohne
 * sichtbaren Knopf. Der Zeitstempel kommt aus dem Klick, nicht aus einer Uhr.
 */
export function useBrandTaps(onOpen: () => void): (timeStamp: number) => void {
  const taps = useRef(0);
  const last = useRef(-Infinity);
  const open = useRef(onOpen);
  open.current = onOpen;
  return useCallback((timeStamp: number) => {
    if (timeStamp - last.current > BRAND_TAP_WINDOW_MS) taps.current = 0;
    last.current = timeStamp;
    taps.current += 1;
    if (taps.current < BRAND_TAP_TARGET) return;
    taps.current = 0;
    last.current = -Infinity;
    open.current();
  }, []);
}

type TabId = 'play' | 'history' | 'rules' | 'build' | 'map' | 'self';

const GUEST_TABS: readonly { readonly id: TabId; readonly label: string; readonly hint: string }[] = [
  { id: 'play', label: 'SPIELEN', hint: 'Zurück auf den Floor: Gerät antippen und direkt spielen' },
  { id: 'history', label: 'VERLAUF', hint: 'Was auf dem Floor und mit deinem Geld passiert ist' },
  { id: 'rules', label: 'REGELN', hint: 'Spiele, Einsätze, Auszahlung und Steuerung' },
  { id: 'self', label: 'DU', hint: 'Deine Spielfigur' },
];

const OPERATOR_TABS: readonly { readonly id: TabId; readonly label: string; readonly hint: string }[] = [
  { id: 'build', label: 'BETRIEB', hint: 'Angebot, Personal, Preise, Lager und Wartung' },
  { id: 'map', label: 'KARTE', hint: 'Fremde Casinos und Reisen' },
  { id: 'self', label: 'DU', hint: 'Charakter und Werkstatt' },
];

export function Dock({ view, perspective, onPlay, onBuild, onOpen, onClean }: DockProps) {
  const dirty = view.dirtyTiles.size;
  const cleaningCost = view.prices.cleaningCost * dirty;
  const tabs = perspective === 'guest' ? GUEST_TABS : OPERATOR_TABS;

  const open = (id: TabId): void => {
    if (id === 'play') { onPlay(); return; }
    if (id === 'build') { onBuild(); return; }
    if (id === 'map') { onOpen({ kind: 'foreignMap' }); return; }
    if (id === 'history') { onOpen({ kind: 'workshop', tool: 'journal' }); return; }
    if (id === 'rules') { onOpen({ kind: 'workshop', tool: 'help' }); return; }
    onOpen(perspective === 'guest' ? { kind: 'look' } : { kind: 'workshop' });
  };

  return (
    <>
      <CitySceneBar view={view} onOpen={onOpen} />
      <OnboardingPanel view={view} onOpen={onOpen} />
    <nav className={`dock ${perspective}`} aria-label={perspective === 'guest' ? 'Gastbereiche' : 'Betriebsbereiche'}>
      {perspective === 'operator' && dirty > 0 && (
        <button
          type="button"
          className={`dock-utility${view.house < cleaningCost ? ' is-poor' : ''}`}
          onClick={onClean}
          disabled={view.house < cleaningCost}
          title={`Raum reinigen; der Auftrag läuft über die Queue (${vc(cleaningCost, 2)}).`}
        >
          <span>REINIGEN</span>
          <b>{dirty}</b>
          <small>Auftrag</small>
        </button>
      )}
      <div className="dock-tabs" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className="dock-tab" onClick={() => open(tab.id)} title={tab.hint}>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
    </nav>
    </>
  );
}
