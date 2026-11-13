/** Stadt-Fenster: Orte, Handlungen, Energie, Progression und das Wachstum. */
import type { CityView } from '../core/sim/city';
import type { CityGrowthBlock, CityGrowthView } from '../core/sim/city-growth-view';
import { worldStore } from '../store/use-world-store';
import { vc } from './format';

interface CityPopupProps {
  readonly city: CityView;
  readonly growth: CityGrowthView;
  readonly onClose: () => void;
}

/** Der Stillstandsgrund in Klartext; die UI leitet keinen eigenen Zustand ab. */
const GROWTH_BLOCK_LABEL: Record<CityGrowthBlock, string> = {
  READY: 'Ein Bau ist möglich.',
  NO_JOBLESS: 'Keine Joblosen: die Stadt hat genug Arbeit.',
  NO_PLOTS: 'Alle Grundstücke sind bebaut.',
};

/**
 * Die Anzeige rechnet nichts nach: Energie, Raenge und Blockadegruende kommen
 * aus `cityView`. Ein Klick ruft genau eine Handlung; das Ergebnis steht
 * danach als Text und Rang im selben Fenster.
 */
export function CityPopup({ city, growth, onClose }: CityPopupProps) {
  const done = city.completed.length > 0;
  return (
    <div className="popup city-popup" role="dialog" aria-label="Stadt">
      <header className="popup-head">
        <h2>{city.locationName}</h2>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </header>

      <p className="city-note">{city.note}</p>

      {/* Dieselbe cityGrowthView wie im Snapshot: kein nachgerechneter Zustand. */}
      <div className="city-energy" aria-label="Stadtwachstum">
        <b>Stadtwachstum · {growth.built} Neubauten</b>
        <span>
          Bewohner {growth.residents} · Jobs {growth.jobs} · Joblose {growth.jobless}
          {' '}· freie Grundstücke {growth.freePlots}
        </span>
        <span>Bauträger-Kapital {vc(growth.capital)} · {GROWTH_BLOCK_LABEL[growth.blockedReason]}</span>
        {growth.lastBuild
          ? (
            <span>
              Letzter Bau (Tag {growth.lastBuild.day}): <b>{growth.lastBuild.name}</b>
              {' '}auf {growth.lastBuild.plotLabel}, {vc(growth.lastBuild.cost)} — steht im Protokoll.
            </span>
          )
          : <span>Noch kein Neubau; das Protokoll nennt jeden Bau mit Ursache und Folge.</span>}
      </div>

      <div aria-label="Bewohner" style={{ display: 'grid', gap: 6 }}>
        {city.residents.map((resident) => (
          <div key={resident.npcId} style={{ padding: '7px 9px', border: '1px solid rgba(255,255,255,.12)', borderRadius: 8, background: 'rgba(0,0,0,.16)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
              <b>{resident.name}</b>
              {/* Während der Reise bleibt `location` der alte Ort; der Status
                  nennt deshalb das Ziel, statt den NPC dort stehen zu lassen. */}
              <span style={{ opacity: .8, fontSize: 12, textAlign: 'right' }}>
                {resident.travelTo ? `unterwegs nach ${resident.travelTo}` : resident.locationLabel} · {resident.intentLabel}
              </span>
            </div>
            <small style={{ display: 'block', marginTop: 3, opacity: .72, fontSize: 11 }}>
              Hunger {resident.hunger} · Durst {resident.thirst} · Müdigkeit {resident.fatigue}
              {' '}· Sozial {resident.social} · Laune {resident.mood}
            </small>
            {resident.traits.length > 0 && <small style={{ display: 'block', marginTop: 3, opacity: .72, fontSize: 11 }}>{resident.traits.join(' · ')}</small>}
            {/* Nur wer hier ist, ist ansprechbar: Der Ort kommt aus dem
                Bewohnerzustand, nicht aus dem Roster-Profil (#507). */}
            <button
              type="button"
              className="btn small"
              style={{ marginTop: 6 }}
              aria-label={`${resident.name} ansprechen`}
              disabled={resident.location !== city.location}
              title={resident.location === city.location
                ? undefined
                : `${resident.name} ist gerade in ${resident.locationLabel}.`}
              onClick={() => worldStore.city({ kind: 'meet', npcId: resident.npcId })}
            >
              {resident.location === city.location ? 'Ansprechen' : 'nicht hier'}
            </button>
          </div>
        ))}
      </div>

      <div className="city-energy" aria-label="Energie">
        <b>Energie {city.energy}/{city.energyMax}</b>
        <span>Jede Handlung kostet Energie; ein neuer Tag fuellt sie auf.</span>
      </div>

      <div className="city-energy" aria-label="Spielerbedürfnisse">
        <b>Hunger {city.playerNeeds.hunger} · Durst {city.playerNeeds.thirst}</b>
        <span>{city.playerNeeds.effect}</span>
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
