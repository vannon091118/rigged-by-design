/**
 * @test-target: src/ui/anchor-layout.ts
 * @error-code: ERR-3001
 *
 * Reine Klemm-Geometrie: Der Viewport ist eine Zahl, der Kamerawechsel ein
 * zweiter Ankerpunkt. Geprueft wird die Flaeche, nicht eine CSS-Klasse.
 */
import { describe, expect, it } from 'vitest';
import { placeAnchoredPanel, type AnchoredPlacement } from '../anchor-layout';

const inside = (
  placement: AnchoredPlacement,
  viewport: { readonly width: number; readonly height: number },
): void => {
  expect(placement.left).toBeGreaterThanOrEqual(0);
  expect(placement.top).toBeGreaterThanOrEqual(0);
  expect(placement.left + placement.width).toBeLessThanOrEqual(viewport.width + 0.001);
  expect(placement.top + placement.maxHeight).toBeLessThanOrEqual(viewport.height + 0.001);
};

const CARD = { width: 340, height: 118 } as const;

describe.each([
  [360, 640],
  [320, 640],
])('Aktionskarte bei %i x %i', (width, height) => {
  const viewport = { width, height };
  const edge = 8;

  it('klemmt am linken Rand in den Viewport', () => {
    const placement = placeAnchoredPanel({ x: 4, y: 60 }, CARD, viewport);
    inside(placement, viewport);
    expect(placement.left).toBe(edge);
    expect(placement.side).toBe('below');
  });

  it('klemmt am rechten Rand in den Viewport', () => {
    const placement = placeAnchoredPanel({ x: width - 4, y: 60 }, CARD, viewport);
    inside(placement, viewport);
    expect(placement.left + placement.width).toBe(width - edge);
  });

  it('klappt bei einem Kamerawechsel von unten nach oben, ohne den Rand zu beruehren', () => {
    const below = placeAnchoredPanel({ x: width / 2, y: 40 }, CARD, viewport);
    const above = placeAnchoredPanel({ x: width / 2, y: height - 30 }, CARD, viewport);
    inside(below, viewport);
    inside(above, viewport);
    expect(below.side).toBe('below');
    expect(above.side).toBe('above');
    expect(above.top).toBe(height - 30 - 10 - CARD.height);
  });

  it('haelt auch einen Anker ausserhalb des Viewports im Bild', () => {
    const placement = placeAnchoredPanel({ x: -40, y: -20 }, CARD, viewport);
    inside(placement, viewport);
    expect(placement.left).toBe(edge);
    expect(placement.top).toBeGreaterThanOrEqual(edge);
  });

  it('respektiert eine schmalere Karte am 320-px-Rand', () => {
    const placement = placeAnchoredPanel({ x: 160, y: 300 }, CARD, viewport);
    expect(placement.width).toBe(Math.min(CARD.width, width - edge * 2));
    expect(placement.left).toBe(edge);
  });
});

describe('Objektpanel', () => {
  it('legt ein 520 px hohes Panel unter den Anker statt darueber hinaus', () => {
    const viewport = { width: 1440, height: 900 };
    const placement = placeAnchoredPanel(
      { x: 720, y: 420 },
      { width: 420, height: 520 },
      viewport,
      { gap: 12 },
    );
    inside(placement, viewport);
    expect(placement.side).toBe('below');
    expect(placement.top).toBe(432);
    expect(placement.maxHeight).toBe(900 - 8 - 432);
  });

  it('verkleinert an der Unterkante auf die freie Flaeche und scrollt intern', () => {
    const viewport = { width: 1200, height: 640 };
    const placement = placeAnchoredPanel(
      { x: 600, y: 600 },
      { width: 420, height: 520 },
      viewport,
    );
    inside(placement, viewport);
    expect(placement.side).toBe('above');
    expect(placement.top + placement.maxHeight).toBe(600 - 10);
  });

  it('zentriert ein Panel, wenn beide Seiten unter der Mindesthoehe bleiben', () => {
    const viewport = { width: 400, height: 100 };
    const placement = placeAnchoredPanel(
      { x: 200, y: 50 },
      { width: 380, height: 90 },
      viewport,
    );
    inside(placement, viewport);
    expect(placement.side).toBe('center');
    expect(placement.top).toBe(8);
    expect(placement.maxHeight).toBe(84);
  });
});
