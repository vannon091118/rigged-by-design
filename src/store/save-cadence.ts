/**
 * @module save-cadence — wann der passive Takt speichert
 *
 * Der Takt ist nicht der einzige Schreiber: Commands speichern sofort. Für den
 * passiven Lauf gilt eine eigene Grenze, weil ein Voll-Write den Main-Thread
 * blockiert (JSON.stringify plus synchrones localStorage.setItem, bei vollem
 * Archiv bis ~900 KB). Vorher schrieb jeder sechste Tick (bei TICK_MS = 520 ms
 * also alle 3,1 s, rund 19 Voll-Writes pro Minute).
 */
import { TICK_MS } from '../core/sim/tick-timing';

/** Ticks zwischen zwei passiven Speicherungen: 30 × 520 ms ≈ 15,6 s. */
export const SAVE_EVERY_TICKS = 30;

/** Abgeleitetes Intervall in Sekunden; eine Quelle bleibt `SAVE_EVERY_TICKS`. */
export const SAVE_INTERVAL_S = (SAVE_EVERY_TICKS * TICK_MS) / 1000;

/** True, wenn der Zähler die passive Speichergrenze erreicht. */
export function shouldPersistTick(tick: number): boolean {
  return tick % SAVE_EVERY_TICKS === 0;
}

/** Der Ausschnitt des Dokument-Objekts, den die Sicherung beim Verlassen braucht. */
export interface HideTarget {
  readonly visibilityState: string;
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
}

/**
 * Sichert den ausstehenden Stand, wenn der Tab in den Hintergrund wandert oder
 * die Seite entladen wird. Der gedrosselte Takt allein würde in diesem Fall bis
 * zu ~15 s Fortschritt verlieren.
 */
export function bindSaveOnHide(save: () => void, host: HideTarget): () => void {
  const onVisibility = (): void => { if (host.visibilityState === 'hidden') save(); };
  const onPageHide = (): void => save();
  host.addEventListener('visibilitychange', onVisibility);
  host.addEventListener('pagehide', onPageHide);
  return () => {
    host.removeEventListener('visibilitychange', onVisibility);
    host.removeEventListener('pagehide', onPageHide);
  };
}
