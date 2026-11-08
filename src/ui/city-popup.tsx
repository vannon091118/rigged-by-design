/** Stadt-Fenster: Orte, Handlungen, Energie und die zwei Progression-Zweige. */
import type { CityView } from '../core/sim/city';
import { worldStore } from '../store/use-world-store';

interface CityPopupProps {
  readonly city: CityView;
  readonly onClose: () => void;
}

/**
 * Die Anzeige rechnet nichts nach: Energie, Raenge und Blockadegruende kommen
 * aus `cityView`. Ein Klick ruft genau eine Handlung; das Ergebnis steht
 * danach als Text und Rang im selben Fenster.
 */
export function CityPopup({ city, onClose }: CityPopupProps) {
  const done = city.completed.length > 0;
  return (
    <div className="popup city-popup" role="dialog" aria-label="Stadt">
      <header className="popup-head">
        <h2>{city.locationName}</h2>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </header>

      <p className="city-note">{city.note}</p>

      <div className="city-energy" aria-label="Energie">
        <b>Energie {city.energy}/{city.energyMax}</b>
        <span>Jede Handlung kostet Energie; ein neuer Tag fuellt sie auf.</span>
      </div>

      <div className="city-branches">
        {city.branches.map((branch) => (
          <div key={branch.id} className={`city-branch${branch.done ? ' is-done' : ''}`}>
            <div className="city-branch-head">
              <b>{branch.name}</b>
              <span>{branch.unlocked ? branch.tier : 'gesperrt'}</span>
            </div>
            <div className="city-bar" role="progressbar" aria-valuemin={0} aria-valuemax={branch.need} aria-valuenow={branch.points}>
              <i style={{ width: `${Math.min(100, Math.round((branch.points / Math.max(1, branch.need)) * 100))}%` }} />
            </div>
            <small>
              {branch.done
                ? 'Zweig abgeschlossen.'
                : branch.unlocked
                  ? `${branch.points}/${branch.need}${branch.next ? ` bis ${branch.next}` : ''}`
                  : `Wird ab Kiez-Rang Stammgast frei (${branch.points}/${branch.need}).`}
            </small>
          </div>
        ))}
      </div>

      <div className="city-locations">
        {city.locations.map((location) => (
          <button
            key={location.id}
            type="button"
            className={`btn city-location${location.here ? ' is-here' : ''}`}
            disabled={location.here || location.locked}
            title={location.locked ? 'Markt erst ab Kiez-Rang Stammgast.' : location.name}
            onClick={() => worldStore.city({ kind: 'travel', location: location.id })}
          >
            {location.name}{location.here ? ' · hier' : ''}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="btn city-rest"
        disabled={city.energy >= city.energyMax}
        title="Energie ueber den naechsten Tag auffuellen"
        onClick={() => worldStore.city({ kind: 'rest' })}
      >
        Tag beenden{city.energy >= city.energyMax ? ' · Energie voll' : ''}
      </button>

      <div className="city-actions">
        {city.actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="btn city-action"
            disabled={!action.enabled}
            title={action.enabled ? action.hint : action.blocked}
            onClick={() => worldStore.city({ kind: 'act', actionId: action.id })}
          >
            <span>{action.label}</span>
            <small>{action.enabled ? `${action.energy} Energie · +${action.progress} ${action.branch}` : action.blocked}</small>
          </button>
        ))}
      </div>

      <div className="city-result" role="status" aria-live="polite">
        <p>{city.lastText}</p>
        <b>{city.lastResult}</b>
        {done && <em>Die Stadt kennt dich jetzt: {city.completed.join(' und ')} abgeschlossen.</em>}
      </div>
    </div>
  );
}
