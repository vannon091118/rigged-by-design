/** Erste Immobilie im Charakterfenster: Katalog, Preis und Besitz aus derselben Sicht. */
import { fromVC } from '../core/economy/vacoin';
import type { PlayerPropertyView } from '../core/sim/property';
import type { PropertyId } from '../core/sim/types';
import { vc } from './format';

interface Props {
  readonly property: PlayerPropertyView;
  /** Kauf der ersten Immobilie; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onBuy?: (id: PropertyId) => void;
}

export function CareerProperty({ property, onBuy }: Props) {
  const owned = property.owned;
  return (
    <section className="career-property" aria-label="Immobilie">
      <div className="career-head">
        <strong>IMMOBILIE</strong>
        <span>{owned === null ? 'noch keine' : 'in deinem Besitz'}</span>
        <span>{owned === null ? 'Kauf aus dem Portemonnaie' : `Tag ${owned.day} · ${vc(owned.priceVC)}`}</span>
      </div>
      {owned !== null ? (
        <p className="career-next">
          {property.offers.find((offer) => offer.id === owned.id)?.label ?? owned.id} - dein erstes Gewerbe.
          Betrieb und Ausbau folgen.
        </p>
      ) : (
        <ul className="career-property-offers" aria-label="Immobilienangebote">
          {property.offers.map((offer) => (
            <li key={offer.id}>
              <div>
                <b>{offer.label}</b>
                <small>{offer.description}</small>
              </div>
              <button
                type="button"
                className={`btn small${offer.affordable ? ' primary' : ' ghost'}`}
                disabled={!offer.affordable || onBuy === undefined}
                title={offer.affordable ? undefined : 'Nicht genug Bargeld im Portemonnaie'}
                onClick={() => onBuy?.(offer.id)}
              >
                {vc(fromVC(offer.priceVC))}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
