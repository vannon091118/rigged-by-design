/** Aktionskarte: eine grosse Empfehlung, zwei Alternativen, ein Schliessen. */
import type { CSSProperties } from 'react';
import type { MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';

interface ActionCardProps {
  readonly actions: readonly MenuAction[];
  readonly onPick: (action: MenuAction) => void;
  readonly onClose: () => void;
  /** Weltposition des getroffenen Objekts; die Karte haengt dann daran. */
  readonly anchor?: ScreenAnchor | null;
  /** "Laeuft hin" oder der Grund, warum das Ziel nicht erreichbar ist. */
  readonly status?: string;
  /** Ziel nicht erreichbar: Aktionen bleiben sichtbar, sind aber gesperrt. */
  readonly blocked?: boolean;
}

export function ActionCard({ actions, onPick, onClose, anchor = null, status = '', blocked = false }: ActionCardProps) {
  const main = actions[0];
  if (!main) return null;
  const alternatives = actions.filter((action) => action.id !== main.id).slice(0, 2);

  return (
    <div
      className={`action-card${anchor ? ' is-anchored' : ''}`}
      role="group"
      aria-label="Aktionen"
      style={anchor ? ({ '--anchor-x': `${Math.round(anchor.x)}px`, '--anchor-y': `${Math.round(anchor.y)}px` } as CSSProperties) : undefined}
    >
      <button
        type="button"
        className="action-main"
        disabled={blocked || !main.enabled}
        title={main.reason}
        onClick={() => onPick(main)}
      >
        {main.label}
        {!main.enabled && main.reason && <span className="action-reason">{main.reason}</span>}
      </button>
      <div className="action-alt">
        {alternatives.map((action) => (
          <button
            key={action.id}
            type="button"
            disabled={blocked || !action.enabled}
            title={action.reason}
            onClick={() => onPick(action)}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button type="button" className="action-close" aria-label="Schliessen" onClick={onClose}>
        ×
      </button>
      {status && <p className="action-status" role="status">{status}</p>}
    </div>
  );
}
