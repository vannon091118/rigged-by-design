/** Haptik ohne neue Abhaengigkeit: WebView-Vibration, respektiert reduced motion. */
const reducedMotion = (): boolean => typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function vibrate(pattern: number | readonly number[]): void {
  if (reducedMotion()) return;
  if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return;
  navigator.vibrate(pattern as number | number[]);
}

/** Kurzer Impuls bei einem Klick oder Tipp. */
export const tapHaptic = (): void => vibrate(8);

/** Drei Stufen fuer den Jackpot; nur zusammen mit dem sichtbaren Burst. */
export const jackpotHaptic = (): void => vibrate([12, 40, 18]);
