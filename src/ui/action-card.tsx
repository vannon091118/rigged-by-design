/** Aktionskarte: eine grosse Empfehlung, zwei Alternativen, ein Schliessen. */
import type { MenuAction } from '../render/floor-actions';

interface ActionCardProps {
  readonly actions: readonly MenuAction[];
  readonly onPick: (action: MenuAction) => void;
  readonly onClose: () => void;
}

export function ActionCard({ actions, onPick, onClose }: ActionCardProps) {
  const usable = actions.filter((action) => action.id !== 'CANCEL');
  const main = usable[0];
  if (!main) return null;
  const enabled = usable.filter((action) => action.id !== main.id && action.enabled).slice(0, 2);
  const alternatives = enabled.length > 0 ? enabled : usable.slice(1, 3);

  return (
    <div className="action-card" role="group" aria-label="Aktionen">
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
