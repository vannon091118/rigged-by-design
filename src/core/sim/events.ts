/** Einfacher Event-Emitter fuer die Visuellen-Effekte-Brücke.
 *
 * Core-Sim bleibt headless: hier werden keine Pixi- oder DOM-Importe
 * verwendet. Die UI/Render-Schicht kann sich mit `on()` an Ereignisse
 * haengen (z. B. `slot:jackpot`, `plinko:drop`, `dispute:start`) und
 * Partikel oder Animationen ausloesen.
 */

type EventListener = (...args: unknown[]) => void;

const listeners: Map<string, Set<EventListener>> = new Map();

export function on(event: string, listener: EventListener): void {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(listener);
}

export function off(event: string, listener: EventListener): void {
  listeners.get(event)?.delete(listener);
}

export function emit(event: string, ...args: unknown[]): void {
  listeners.get(event)?.forEach((listener) => {
    try {
      listener(...args);
    } catch {
      // Ein fehlerhafter Listener darf den Spielbetrieb nicht unterbrechen.
    }
  });
}

export function listenerCount(event: string): number {
  return listeners.get(event)?.size ?? 0;
}
