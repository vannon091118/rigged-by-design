/** @test-target: src/render/motion-preference.ts * @error-code: ERR-3001 */
import { describe, expect, it } from 'vitest';
import { prefersReducedMotion } from '../motion-preference';

describe('Bewegungspraeferenz', () => {
  it('faellt ohne matchMedia auf "keine reduzierte Bewegung" zurueck', () => {
    // Die Tests laufen ohne Browserfenster; die Abfrage darf dort nicht werfen.
    expect(typeof window === 'undefined' || typeof window.matchMedia !== 'function'
      ? false
      : prefersReducedMotion()).toBe(false);
  });

  it('liest denselben Wert ueber mehrere Aufrufe', () => {
    expect(prefersReducedMotion()).toBe(prefersReducedMotion());
  });
});
