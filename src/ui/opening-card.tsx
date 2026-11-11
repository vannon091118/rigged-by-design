/** Die erste Szene: derselbe Runtime-Text wie die Narrative, nur als Einstiegskarte. */
import { composeNarrative } from '../core/sim/narrative/composer';
import { useWorldStore, worldStore } from '../store/use-world-store';

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

/**
 * Nur der Startzustand OPENING zeigt die Szene. Die Sichtbarkeit kommt aus dem
 * einen Onboarding-Schritt, nicht aus Tick, Gaestezahl und Historienlaenge -
 * zwei unabhaengige Regeln waren der Grund fuer zwei gleichzeitige Modals.
 */
export function OpeningGate() {
  const view = useWorldStore();
  if (view.onboarding.step !== 'OPENING') return null;
  return <OpeningCard onClose={() => worldStore.scene.finishOpening()} />;
}
