/** Weltanker: haelt eine React-Karte am Objekt, auch wenn die Kamera faehrt. */
import { useEffect, useState, type CSSProperties } from 'react';
import type { ScreenAnchor } from '../render/floor-hit';

export type AnchorProjector = (x: number, y: number) => ScreenAnchor | null;

/**
 * `ScreenAnchor` traegt neben den Klick-Pixeln auch den Weltpunkt. Solange ein
 * Projektor da ist, wird dieser Punkt pro Frame neu in den Viewport gerechnet;
 * ohne Weltpunkt bleibt der Anker statisch. Das ist keine zweite Kamera: der
 * Floor bleibt die einzige Quelle der Projektion.
 */
export function useWorldAnchorStyle(
  anchor: ScreenAnchor | null,
  project?: AnchorProjector,
): CSSProperties | undefined {
  const [point, setPoint] = useState<{ x: number; y: number } | null>(
    anchor ? { x: anchor.x, y: anchor.y } : null,
  );
  const worldX = anchor?.worldX;
  const worldY = anchor?.worldY;

  useEffect(() => {
    if (!anchor) {
      setPoint(null);
      return;
    }
    if (worldX === undefined || worldY === undefined || !project) {
      setPoint({ x: anchor.x, y: anchor.y });
      return;
    }
    let frame = 0;
    let lastX = Number.NaN;
    let lastY = Number.NaN;
    const tick = (): void => {
      const next = project(worldX, worldY);
      if (next && (Math.abs(next.x - lastX) > 0.5 || Math.abs(next.y - lastY) > 0.5)) {
        lastX = next.x;
        lastY = next.y;
        setPoint({ x: next.x, y: next.y });
      }
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [anchor, worldX, worldY, project]);

  if (!point) return undefined;
  return {
    '--anchor-x': `${Math.round(point.x)}px`,
    '--anchor-y': `${Math.round(point.y)}px`,
  } as CSSProperties;
}
