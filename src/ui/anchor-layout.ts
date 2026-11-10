/**
 * Klemm-Geometrie fuer Weltanker. Reine Funktion: Projektion und Viewport sind
 * Zahlen, damit Rand- und Kamerawechsel ohne Browser pruefbar bleiben.
 */

interface AnchorPoint {
  readonly x: number;
  readonly y: number;
}

interface AnchorSize {
  readonly width: number;
  readonly height: number;
}

export interface AnchoredPlacement {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  readonly maxHeight: number;
  readonly side: 'above' | 'below' | 'center';
}

interface PlacementOptions {
  /** Abstand zum Viewport-Rand in Pixeln. */
  readonly margin?: number;
  /** Abstand zwischen Anker und Panel. */
  readonly gap?: number;
  /** Unterhalb dieser Resthoehe wird das Panel lieber zentriert statt gequetscht. */
  readonly minHeight?: number;
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), Math.max(min, max));

/**
 * Legt ein Panel moeglichst nah an den Anker, aber vollstaendig in den Viewport.
 *
 * Bevorzugt wird die Seite mit Platz fuer die volle Hoehe: erst oben, dann
 * unten. Passt das Panel auf keiner Seite, nimmt es die groessere Restflaeche
 * und scrollt intern. Bleibt selbst dort zu wenig, wird es zum zentrierten
 * Viewport-Panel. Links und rechts wird immer geklemmt, nie abgeschnitten.
 */
export function placeAnchoredPanel(
  anchor: AnchorPoint,
  panel: AnchorSize,
  viewport: AnchorSize,
  options: PlacementOptions = {},
): AnchoredPlacement {
  const margin = Math.max(0, options.margin ?? 8);
  const gap = Math.max(0, options.gap ?? 10);
  const minHeight = Math.max(0, options.minHeight ?? 140);
  const availableWidth = Math.max(0, viewport.width - margin * 2);
  const width = Math.min(Math.max(0, panel.width), availableWidth);
  const left = clamp(anchor.x - width / 2, margin, viewport.width - margin - width);
  const wanted = Math.max(0, panel.height);
  // Ein Anker kann knapp ausserhalb des Viewports liegen (Objekt am Rand).
  // Fuer die Hoehenseite zaehlt der naechste sichtbare Punkt, nicht der rohe
  // Klickwert; sonst entstuende ein negatives `top`.
  const anchorY = clamp(anchor.y, margin, viewport.height - margin);
  const spaceAbove = Math.max(0, anchorY - gap - margin);
  const spaceBelow = Math.max(0, viewport.height - margin - (anchorY + gap));

  if (wanted <= spaceAbove) {
    return {
      left,
      top: anchorY - gap - wanted,
      width,
      height: wanted,
      maxHeight: wanted,
      side: 'above',
    };
  }
  if (wanted <= spaceBelow) {
    return {
      left,
      top: anchorY + gap,
      width,
      height: wanted,
      maxHeight: wanted,
      side: 'below',
    };
  }

  const side = spaceAbove >= spaceBelow ? 'above' : 'below';
  const space = side === 'above' ? spaceAbove : spaceBelow;
  if (space >= minHeight) {
    return {
      left,
      top: side === 'above' ? margin : anchorY + gap,
      width,
      height: space,
      maxHeight: space,
      side,
    };
  }

  // Weder oben noch unten bleibt genug: die Karte wird zum Viewport-Panel.
  const height = Math.min(wanted, Math.max(0, viewport.height - margin * 2));
  return {
    left,
    top: clamp((viewport.height - height) / 2, margin, viewport.height - margin - height),
    width,
    height,
    maxHeight: height,
    side: 'center',
  };
}
