/** Karriere-Sektion des Charakterfensters: eine Sicht, eigene Ownership. */
import { hpNotice } from '../core/sim/player-career';
import type { PropertyId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { CareerBackyard } from './career-backyard';
import { CareerFloor } from './career-floor';
import { CareerHistory } from './career-history';
import { CareerProperty } from './career-property';
import { VenueHistory } from './venue-history';
import { vc } from './format';

interface Props {
  readonly view: GameView;
  readonly onChallenge?: () => void;
  readonly onBuyProperty?: (id: PropertyId) => void;
  readonly onRenovate?: () => void;
  readonly onMaintain?: (itemId: number) => void;
}

export function CareerSection({ view, onChallenge, onBuyProperty, onRenovate, onMaintain }: Props) {
  const career = view.career;
  return (
    <section className="career" aria-label="Deine Werte">
      <div className="career-head">
        <strong>LEVEL {career.level}</strong>
        <span>{career.xp} / {career.xp + career.xpToNext} XP</span>
        <span>{career.unspentPoints > 0 ? `${career.unspentPoints} Punkte offen` : 'keine Punkte offen'}</span>
      </div>
      <p className={`career-hp${career.injured ? ' warn' : ''}`}>{hpNotice(career)}</p>
      <ul className="career-attributes">
        {career.attributes.map((attribute) => (
          <li key={attribute.id}>
            <span>{attribute.label}</span>
            <b>{attribute.level}</b>
            <small>{attribute.effect}</small>
          </li>
        ))}
      </ul>
      <div className="career-grid">
        <div><span>Portemonnaie</span><b>{vc(career.wallet, 2)}</b></div>
        <div><span>Bonus</span><b>{vc(career.playerCash, 2)}</b></div>
        <div><span>Bilanz</span><b>{career.record.wins} S · {career.record.losses} N · {career.record.kos} KO</b></div>
        <div>
          <span>Arbeit</span>
          <b>{career.job ? `${career.job.label} · ${career.job.workDays} Schichten` : 'kein Job'}</b>
        </div>
        <div>
          <span>Lohn</span>
          <b>{career.job ? `${career.job.wageVC} VC/Tag · letzte Schicht ${career.job.lastWorkDay > 0 ? `Tag ${career.job.lastWorkDay}` : 'offen'}` : 'keine Schicht'}</b>
        </div>
      </div>
      <CareerFloor work={view.floorWork} />
      <CareerProperty
        property={career.property}
        house={view.house}
        renovation={view.renovation}
        onBuy={onBuyProperty}
        onRenovate={onRenovate}
        machineHall={view.machineHall}
        onMaintain={onMaintain}
      />
      <ul className="career-achievements">
        {career.achievements.map((entry) => (
          <li key={entry.id} className={entry.unlocked ? 'on' : 'off'}>{entry.label}</li>
        ))}
      </ul>
      <CareerHistory history={career.history} />
      <CareerBackyard backyard={career.backyard} onChallenge={onChallenge} />
      <VenueHistory venue={view.venue} />
    </section>
  );
}
