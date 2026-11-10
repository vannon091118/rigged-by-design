/** App-Effekte: Ton, Musik, Fokus und Haptik als eigene Zustaendigkeit. */
import { useEffect, useRef } from 'react';
import { tapHaptic } from '../render/haptics';
import { armMusic, setMusicState } from '../render/music';
import { playSfx } from '../render/sound-fx';
import { setNarrativePaused } from '../store/narrative-clock';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';

/** Ein Hinweis verschwindet nach 6,5 s; die Frist gehoert zur UI, nicht zum Spiel. */
export function useNoticeDismiss(notice: string | null): void {
  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => worldStore.dismiss(), 6500);
    return () => window.clearTimeout(id);
  }, [notice]);
}

/** Kasse und Pruegelei sind Welt-Ereignisse: der Ton folgt dem Protokoll, nicht dem Klick. */
export function useJournalSfx(journal: GameView['journal']): void {
  const seen = useRef(-1);
  useEffect(() => {
    const latest = journal[journal.length - 1];
    if (!latest) return;
    if (seen.current < 0) { seen.current = latest.id; return; }
    const fresh = journal.filter((entry) => entry.id > seen.current);
    seen.current = latest.id;
    if (fresh.some((entry) => entry.kind === 'MONEY' && / (chips|fiat wechseln)$/.test(entry.subject))) playSfx('coin');
  }, [journal]);
}

export function useDisputeSfx(count: number): void {
  const disputes = useRef(count);
  useEffect(() => {
    if (count > disputes.current) playSfx('brawl');
    disputes.current = count;
  }, [count]);
}

/** Musik folgt dem Fenster, nicht dem Klick: Floor, Fremdhaus, eigenes Geraet. */
export function useSceneMusic(popup: Popup, furniture: GameView['furniture']): void {
  useEffect(() => {
    if (popup?.kind === 'games') { setMusicState('GAMES'); return; }
    if (popup?.kind === 'foreignMap' || popup?.kind === 'foreignFloor') { setMusicState('NIGHT'); return; }
    if (popup?.kind === 'workshop') { setMusicState('MENU'); return; }
    if (popup?.kind === 'guests' || popup?.kind === 'narrative' || popup?.kind === 'dialogue') {
      setMusicState('BACKGROUND');
      return;
    }
    if (popup?.kind === 'machine') {
      const item = furniture.find((entry) => entry.id === popup.itemId);
      setMusicState(item?.gameId === 'SLOT' ? 'SLOT' : 'GAMES');
      return;
    }
    setMusicState('FLOOR');
  }, [popup, furniture]);
}

/** Szenen sterben nicht im Menue: ein Popup verdeckt den Floor und haelt die Frist an. */
export function useNarrativePause(active: boolean): void {
  useEffect(() => { setNarrativePaused(active); }, [active]);
}

/** Der Browser laesst Ton erst nach einer Geste zu; bis dahin bleibt es still. */
export function useArmMusic(): void {
  useEffect(() => armMusic(), []);
}

/** Kurze Haptik bei jedem Tipp; reduced motion schaltet sie in haptics.ts ab. */
export function usePointerHaptics(): void {
  useEffect(() => {
    const onPointerDown = (): void => tapHaptic();
    window.addEventListener('pointerdown', onPointerDown, { capture: true, passive: true });
    return () => window.removeEventListener('pointerdown', onPointerDown, true);
  }, []);
}

/** Versteckter Werkstatt-Einstieg: Strg+Shift+D, unabhaengig vom Popup-Zustand. */
export function useWorkshopShortcut(open: () => void): void {
  const handler = useRef(open);
  handler.current = open;
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (!event.ctrlKey || !event.shiftKey || event.repeat || event.key.toLowerCase() !== 'd') return;
      event.preventDefault();
      handler.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}
