/** Die erste Szene: derselbe Runtime-Text wie die Narrative, nur als Einstiegskarte. */
import { useEffect, useRef, useState } from 'react';
import { composeNarrative } from '../core/sim/narrative/composer';
import { useWorldStore } from '../store/use-world-store';
import type { GameView } from '../store/types';

const OPENING_TICKS = 120;

/**
 * Der Composer fuehrt die Eröffnung als TITLE-Quelle. Hier ist der Text bewusst
 * Fließtext; die Karte rahmt ihn nur, statt einen zweiten Eröffnungstext zu halten.
 */
const OPENING_TEXT = (() => {
  const composed = composeNarrative({
    locale: 'de',
    slots: [{ id: 'OPENING', kind: 'TITLE', requiredContexts: ['start'] }],
    contexts: ['start'],
    requiredFlags: ['startpool'],
    availablePersonas: ['rita-kern'],
    eventInstanceId: 0,
  });
  const slot = composed.slots[0];
  return slot && !slot.fallback ? slot.text : '';
})();

export function OpeningCard({ onClose }: { readonly onClose: () => void }) {
  if (!OPENING_TEXT) return null;
  return (
    <aside className="opening-card" aria-label="Eröffnung">
      <span className="eyebrow">ERÖFFNUNG · TAG 1</span>
      <h2>Der erste Abend</h2>
      <p>{OPENING_TEXT}</p>
      <button type="button" className="btn small warm" onClick={onClose}>LOS</button>
    </aside>
  );
}

/** Nur der frische Start zeigt die Szene; ein Tick-Ruecksprung oeffnet sie erneut. */
function isFreshStart(view: GameView): boolean {
  return view.tick < OPENING_TICKS && view.guests.length === 0 && view.narrative.history.length === 0;
}

export function OpeningGate() {
  const view = useWorldStore();
  const [open, setOpen] = useState(() => isFreshStart(view));
  const lastTick = useRef(view.tick);

  useEffect(() => {
    if (view.tick < lastTick.current) setOpen(true);
    lastTick.current = view.tick;
  }, [view.tick]);

  if (!open) return null;
  return <OpeningCard onClose={() => setOpen(false)} />;
}
