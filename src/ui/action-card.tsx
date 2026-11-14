/** Aktionskarte: eine grosse Empfehlung, zwei direkte Alternativen, ein Schliessen. */
import { useRef, useState } from 'react';
import type { MenuAction } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import { useAnchoredStyle, type AnchorProjector } from './use-world-anchor';

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
  /** Projektion des Weltankers; ohne sie bleibt die Karte am Klick stehen. */
  readonly project?: AnchorProjector;
}

export function ActionCard({ actions, onPick, onClose, anchor = null, status = '', blocked = false, project }: ActionCardProps) {
  const card = useRef<HTMLDivElement>(null);
  const style = useAnchoredStyle(anchor, project, card, { width: 340, fallbackHeight: 118 });
  const main = actions[0];
  // Ein neues Ziel beginnt kompakt; dieselbe Auswahl behaelt ihren Zustand.
  const actionKey = actions
    .map((action) => `${action.id}:${action.targetId ?? action.target?.id ?? ''}:${action.point?.x ?? ''}:${action.point?.y ?? ''}`)
    .join('|');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  if (!main) return null;
  const alternatives = actions.filter((action) => action.id !== main.id);
  const visibleAlternatives = alternatives.slice(0, 2);
  const hiddenAlternatives = alternatives.slice(2);
  const expanded = expandedKey === actionKey;

  const alternative = (action: MenuAction) => (
    <button
      key={action.id}
      type="button"
      disabled={blocked || !action.enabled}
      title={action.reason}
      onClick={() => onPick(action)}
    >
      {action.label}
    </button>
  );

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
        disabled={blocked || !main.enabled}
        title={main.reason}
        onClick={() => onPick(main)}
      >
        {main.label}
        {!main.enabled && main.reason && <span className="action-reason">{main.reason}</span>}
      </button>
      <div className="action-alt">
        {visibleAlternatives.map(alternative)}
        {expanded && hiddenAlternatives.map(alternative)}
        {hiddenAlternatives.length > 0 && (
          <button
            type="button"
            className="action-more"
            aria-expanded={expanded}
            onClick={() => setExpandedKey(expanded ? null : actionKey)}
          >
            {expanded ? 'Weniger Aktionen' : `Weitere Aktionen (${hiddenAlternatives.length})`}
          </button>
        )}
      </div>
      <button type="button" className="action-close" aria-label="Schliessen" onClick={onClose}>
        ×
      </button>
      {status && <p className="action-status" role="status">{status}</p>}
    </div>
  );
}
