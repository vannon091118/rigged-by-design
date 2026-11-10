/** Weltanker: haelt eine React-Karte am Objekt, auch wenn die Kamera faehrt. */
import {
  useEffect,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type RefObject,
} from 'react';
import type { ScreenAnchor } from '../render/floor-hit';
import { placeAnchoredPanel } from './anchor-layout';

export type AnchorProjector = (x: number, y: number) => ScreenAnchor | null;

interface ViewportSize {
  readonly width: number;
  readonly height: number;
}

function readViewport(): ViewportSize {
  if (typeof window === 'undefined') return { width: 0, height: 0 };
  return { width: window.innerWidth, height: window.innerHeight };
}

function useViewportSize(): ViewportSize {
  const [size, setSize] = useState<ViewportSize>(readViewport);
  useEffect(() => {
    const update = (): void => setSize(readViewport());
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  return size;
}

// jsdom ohne pretendToBeVisual hat kein requestAnimationFrame; der Fallback
// haelt den Projektions-Takt auch dort am Laufen.
function requestFrame(callback: FrameRequestCallback): number {
  if (typeof requestAnimationFrame === 'function') return requestAnimationFrame(callback);
  return window.setTimeout(() => callback(0), 16);
}

function cancelFrame(frame: number): void {
  if (typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
  else window.clearTimeout(frame);
}

/**
 * `ScreenAnchor` traegt neben den Klick-Pixeln auch den Weltpunkt. Solange ein
 * Projektor da ist, wird dieser Punkt pro Frame neu in den Viewport gerechnet;
 * ohne Weltpunkt bleibt der Anker statisch. Das ist keine zweite Kamera: der
 * Floor bleibt die einzige Quelle der Projektion.
 */
function useProjectedPoint(
  anchor: ScreenAnchor | null,
  project?: AnchorProjector,
): { readonly x: number; readonly y: number } | null {
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
    // Unendlich als Startwert: der erste projizierte Frame gilt immer, auch
    // wenn er exakt auf den Klick-Pixeln liegt (sonst bliebe die Karte leer).
    let lastX = Number.POSITIVE_INFINITY;
    let lastY = Number.POSITIVE_INFINITY;
    const tick = (): void => {
      const next = project(worldX, worldY);
      if (next && (Math.abs(next.x - lastX) > 0.5 || Math.abs(next.y - lastY) > 0.5)) {
        lastX = next.x;
        lastY = next.y;
        setPoint({ x: next.x, y: next.y });
      }
      frame = requestFrame(tick);
    };
    tick();
    return () => cancelFrame(frame);
  }, [anchor, worldX, worldY, project]);

  return point;
}

interface AnchoredStyleOptions {
  /** Designbreite; wird nie breiter als der Viewport minus Rand. */
  readonly width: number;
  /** Hoehe vor der ersten Messung, damit der erste Frame nicht springt. */
  readonly fallbackHeight: number;
  readonly gap?: number;
  readonly margin?: number;
}

/**
 * Gemessene Platzierung: liefert links/oben/Breite/max-Hoehe als CSS-Variablen.
 * Die Hoehe kommt vom Element selbst, die Klemmung aus `placeAnchoredPanel`.
 */
export function useAnchoredStyle<T extends HTMLElement>(
  anchor: ScreenAnchor | null,
  project: AnchorProjector | undefined,
  element: RefObject<T | null>,
  options: AnchoredStyleOptions,
): CSSProperties | undefined {
  const point = useProjectedPoint(anchor, project);
  const viewport = useViewportSize();
  const [measured, setMeasured] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const node = element.current;
    if (!node) return;
    const measure = (): void => {
      const rect = node.getBoundingClientRect();
      setMeasured((previous) => {
        const next = { width: rect.width, height: rect.height };
        return previous.width === next.width && previous.height === next.height
          ? previous
          : next;
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [element]);

  if (!point || viewport.width <= 0 || viewport.height <= 0) return undefined;

  const placement = placeAnchoredPanel(
    point,
    {
      width: options.width,
      height: measured.height > 0 ? measured.height : options.fallbackHeight,
    },
    viewport,
    { gap: options.gap, margin: options.margin },
  );

  return {
    '--anchor-x': `${Math.round(point.x)}px`,
    '--anchor-y': `${Math.round(point.y)}px`,
    '--anchor-left': `${Math.round(placement.left)}px`,
    '--anchor-top': `${Math.round(placement.top)}px`,
    '--anchor-width': `${Math.round(placement.width)}px`,
    '--anchor-max-height': `${Math.round(placement.maxHeight)}px`,
  } as CSSProperties;
}
