/** Ein Rahmen für alle Popups: Backdrop, Titel, Fokusfalle, Escape, Schließen. */
import { useEffect, useRef, type ReactNode } from 'react';
import type { ScreenAnchor } from '../render/floor-hit';
import { UI_ICON } from './icons';
import { useAnchoredStyle, type AnchorProjector } from './use-world-anchor';

type UiSurface = 'object' | 'activity' | 'overview';

interface PopupShellProps {
  readonly eyebrow: string;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly wide?: boolean;
  readonly full?: boolean;
  readonly className?: string;
  /** Spieltyp fuer die Farbidentitaet; nur CSS-Variablen, kein Layout. */
  readonly game?: string;
  /**
   * Weltposition des Objekts, das das Panel geoeffnet hat. Mit Anker haengt das
   * Panel am Objekt; `full` gewinnt immer, weil Vollbild der ausdrueckliche
   * Wunsch des Spielers ist.
   */
  readonly anchor?: ScreenAnchor | null;
  /** Drei Fensterarten; die vierte ist die Aktionskarte direkt am Objekt. */
  readonly surface?: UiSurface;
  /** Rechnet den Weltanker bei Kamera- und Zoomfahrten neu in den Viewport. */
  readonly project?: AnchorProjector;
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function PopupShell({ eyebrow, title, onClose, children, wide = false, full = false, className = '', game, anchor = null, surface, project }: PopupShellProps) {
  const panel = useRef<HTMLElement>(null);
  const resolvedSurface = surface ?? (full ? 'activity' : wide ? 'overview' : 'object');
  const anchored = anchor !== null && !full && resolvedSurface === 'object';
  const anchorStyle = useAnchoredStyle(anchored ? anchor : null, project, panel, {
    width: 420,
    fallbackHeight: 360,
    gap: 12,
  });
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  // Nur beim Öffnen/Schließen: ein Tick-Update darf den Fokus nicht zurücksetzen.
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const node = panel.current;
    const first = node?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node)?.focus();
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); return; }
      if (event.key !== 'Tab' || !node) return;
      const items = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) { event.preventDefault(); return; }
      const firstItem = items[0]!;
      const lastItem = items[items.length - 1]!;
      if (event.shiftKey && (document.activeElement === firstItem || document.activeElement === node)) {
        event.preventDefault(); lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault(); firstItem.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      previous?.focus();
    };
  }, []);

  return (
    <div
      className={`popup-backdrop${full ? ' is-full' : ''}${anchored ? ' is-anchored' : ''}`}
      role="presentation"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        tabIndex={-1}
        className={`popup ${wide ? 'popup-wide' : ''} ${full ? 'popup-full' : ''}${anchored ? ' is-anchored' : ''} ${className}`.trim()}
        style={anchorStyle}
        data-surface={resolvedSurface}
        data-game={game}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header className="popup-head">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h2>{title}</h2>
          </div>
          <button type="button" className="popup-close" aria-label="Schließen" onClick={onClose}>
            <img className="ui-icon" src={UI_ICON.close} alt="" />
          </button>
        </header>
        <div className="popup-body">{children}</div>
      </section>
    </div>
  );
}
