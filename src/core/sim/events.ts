/** Einfacher Event-Emitter fuer die Visuellen-Effekte-Brücke.
 *
 * Core-Sim bleibt headless: hier werden keine Pixi- oder DOM-Importe
 * verwendet. Die UI/Render-Schicht kann sich mit `on()` an Ereignisse
 * haengen (z. B. `slot:jackpot`, `plinko:drop`, `dispute:start`) und
 * Partikel oder Animationen ausloesen.
 */

type EventListener = (...args: unknown[]) => void;

const listeners: Map<string, Set<EventListener>> = new Map();

export function on(event: string, listener: EventListener): () => void {
  const bucket = listeners.get(event) ?? new Set<EventListener>();
  listeners.set(event, bucket);
  bucket.add(listener);
  return () => {
    bucket.delete(listener);
  };
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
