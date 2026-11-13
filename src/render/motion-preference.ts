/**
 * Systemeinstellung „Bewegung reduzieren". Reine Darstellung entscheidet damit,
 * ob Lampen flackern und ob der Hintergrund parallax wandert; der Spielzustand
 * kennt die Einstellung nicht.
 *
 * Lazy gelesen: Node-Tests und SSR haben kein `matchMedia`, dort gilt `false`.
 */
const QUERY = '(prefers-reduced-motion: reduce)';

let reduced: boolean | null = null;

export function prefersReducedMotion(): boolean {
  if (reduced !== null) return reduced;
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    reduced = false;
    return reduced;
  }
  const query = window.matchMedia(QUERY);
  reduced = query.matches;
  // Ein Wechsel der Systemeinstellung wirkt ohne Reload.
  query.addEventListener?.('change', (event) => { reduced = event.matches; });
  return reduced;
}
