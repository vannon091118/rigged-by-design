/** Aktionskarte: eine grosse Empfehlung, zwei Alternativen, ein Schliessen. */
import { useRef } from 'react';
import type { MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import { useAnchoredStyle, type AnchorProjector } from './use-world-anchor';

interface ActionCardProps {
  readonly actions: readonly MenuAction[];
  readonly onPick: (action: MenuAction) => void;
  readonly onClose: () => void;
  /** Weltposition des getroffenen Objekts; die Karte haengt dann daran. */
  readonly anchor?: ScreenAnchor | null;
  /** Rechnet den Weltpunkt bei Kamera- und Zoomfahrten neu in den Viewport. */
  readonly project?: AnchorProjector;
}

export function ActionCard({ actions, onPick, onClose, anchor = null, project }: ActionCardProps) {
  const usable = actions.filter((action) => action.id !== 'CANCEL');
  const main = usable[0];
  const card = useRef<HTMLDivElement>(null);
  const style = useAnchoredStyle(anchor, project, card, { width: 340, fallbackHeight: 118 });
  if (!main) return null;
  const enabled = usable.filter((action) => action.id !== main.id && action.enabled).slice(0, 2);
  const alternatives = enabled.length > 0 ? enabled : usable.slice(1, 3);

  return (
    <div
      ref={card}
      className={`action-card${anchor ? ' is-anchored' : ''}`}
      role="group"
      aria-label="Aktionen"
      style={anchor ? style : undefined}
    >
      <button
        type="button"
        className="action-main"
        disabled={!main.enabled}
        onClick={() => onPick(main)}
      >
        {main.label}
      </button>
      <div className="action-alt">
        {alternatives.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={!action.enabled}
            onClick={() => onPick(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button type="button" className="action-close" aria-label="Schliessen" onClick={onClose}>
        ×
      </button>
    </div>
  );
}
