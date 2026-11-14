/**
 * Bildrate aus echten Frame-Zeitpunkten. Die Messung kennt keinen Sollwert und
 * keine Tickrate; sie zaehlt nur die Zeitstempel, die `requestAnimationFrame`
 * tatsaechlich liefert. Ein langer Abstand (Tab-Wechsel, Pause) verwirft das
 * laufende Fenster, statt einen kuenstlichen Einbruch zu melden.
 */
const DEFAULT_WINDOW_MS = 500;
/** Ab dieser Luecke gilt die Zeitreihe als unterbrochen, nicht als langsames Frame. */
const DEFAULT_PAUSE_GAP_MS = 250;

export type FrameMeter = (now: number) => number | null;

export function createFrameMeter(
  windowMs: number = DEFAULT_WINDOW_MS,
  pauseGapMs: number = DEFAULT_PAUSE_GAP_MS,
): FrameMeter {
  let started: number | null = null;
  let last: number | null = null;
  let frames = 0;

  return (now: number): number | null => {
    const gap = last === null ? 0 : now - last;
    last = now;
    if (started === null || gap > pauseGapMs) {
      started = now;
      frames = 0;
      return null;
    }
    frames += 1;
    const elapsed = now - started;
    if (elapsed < windowMs) return null;
    const fps = Math.round((frames * 1000) / elapsed);
    started = now;
    frames = 0;
    return fps;
  };
}
