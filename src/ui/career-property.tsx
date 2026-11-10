/** Erste Immobilie im Charakterfenster: Katalog, Besitz und Betrieb aus derselben Sicht. */
import { fromVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { PlayerPropertyView, PropertyWorldBinding } from '../core/sim/property';
import type { PropertyId } from '../core/sim/types';
import { vc } from './format';

interface Props {
  readonly property: PlayerPropertyView;
  /** Betriebskonto des Hauses aus demselben Snapshot; die Sektion rechnet nichts nach. */
  readonly house?: VaCoinMicro;
  /** Kauf der ersten Immobilie; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onBuy?: (id: PropertyId) => void;
}

export function CareerProperty({ property, house = ZERO_VC, onBuy }: Props) {
  const owned = property.owned;
  const binding: PropertyWorldBinding | null = property.binding;
  return (
    <section className="career-property" aria-label="Immobilie">
      <div className="career-head">
        <strong>IMMOBILIE</strong>
        <span>{owned === null ? 'noch keine' : 'in deinem Besitz'}</span>
        <span>{owned === null ? 'Kauf aus dem Portemonnaie' : `Tag ${owned.day} · ${vc(owned.priceVC)}`}</span>
      </div>
      {owned !== null ? (
        <>
          <p className="career-next">
            {property.offers.find((offer) => offer.id === owned.id)?.label ?? owned.id} - dein erstes Gewerbe.
            Betrieb und Ausbau laufen ueber das Hauskonto.
          </p>
          <div className="career-grid" aria-label="Immobilienbetrieb">
            <div><span>Betriebskonto</span><b>{vc(house, 2)}</b></div>
            <div><span>Flaeche</span><b>{binding?.area?.id ?? 'ausserhalb'}</b></div>
            <div><span>Zonen</span><b>{binding?.zones.length ?? 0}</b></div>
            <div><span>Geräte</span><b>{binding?.furniture.length ?? 0}</b></div>
            <div><span>Gäste im Betrieb</span><b>{binding?.guests.length ?? 0}</b></div>
          </div>
        </>
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
