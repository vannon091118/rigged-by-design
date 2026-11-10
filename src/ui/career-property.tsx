/** Erste Immobilie im Charakterfenster: Katalog, Besitz, Betrieb und Renovierung aus derselben Sicht. */
import { fromVC, ZERO_VC, type VaCoinMicro } from '../core/economy/vacoin';
import type { PlayerPropertyView, PropertyWorldBinding } from '../core/sim/property';
import type { RenovationView } from '../core/sim/renovation';
import type { MachineHallView } from '../core/sim/machine-hall';
import type { PropertyId } from '../core/sim/types';
import { vc } from './format';

interface Props {
  readonly property: PlayerPropertyView;
  /** Betriebskonto des Hauses aus demselben Snapshot; die Sektion rechnet nichts nach. */
  readonly house?: VaCoinMicro;
  /** Renovierungsstand aus derselben Ableitung wie der Rest des Betriebs. */
  readonly renovation?: RenovationView;
  /** Kauf der ersten Immobilie; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onBuy?: (id: PropertyId) => void;
  /** Naechste Renovierungsstufe; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onRenovate?: () => void;
  /** Automaten der eigenen Flaeche aus derselben Ableitung wie der Floor. */
  readonly machineHall?: MachineHallView;
  /** Wartung eines Automaten; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onMaintain?: (itemId: number) => void;
}

export function CareerProperty({ property, house = ZERO_VC, renovation, onBuy, onRenovate, machineHall, onMaintain }: Props) {
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
          {renovation !== undefined && renovation.owned && (
            <div className="career-grid" aria-label="Renovierung">
              <div><span>Zustand</span><b>{renovation.label}</b></div>
              <div><span>Material</span><b>{renovation.parts} Ersatzteile im Lager</b></div>
              <div>
                <span>Nächste Stufe</span>
                {renovation.step === null ? (
                  <b>keine</b>
                ) : (
                  <button
                    type="button"
                    className={`btn small${renovation.ready ? ' primary' : ' ghost'}`}
                    disabled={!renovation.ready || onRenovate === undefined}
                    title={renovation.note}
                    onClick={() => onRenovate?.()}
                  >
                    Renovieren ({vc(fromVC(renovation.costVC))})
                  </button>
                )}
              </div>
              <div><span>Hinweis</span><b>{renovation.note}</b></div>
            </div>
          )}
          {machineHall !== undefined && machineHall.owned && (
            <>
              <div className="career-grid" aria-label="Spielhalle">
                <div><span>Automaten</span><b>{machineHall.total}</b></div>
                <div><span>Laufend</span><b>{machineHall.running}</b></div>
                <div><span>Wartung fällig</span><b>{machineHall.worn}</b></div>
                <div><span>Defekt</span><b>{machineHall.broken}</b></div>
                <div><span>Gäste am Automaten</span><b>{machineHall.occupied}/{machineHall.seats}</b></div>
                <div><span>Wartung</span><b>{vc(machineHall.cost, 2)} je Automat</b></div>
                <div><span>Hinweis</span><b>{machineHall.note}</b></div>
              </div>
              {machineHall.due.length > 0 && (
                <ul className="career-property-offers" aria-label="Wartung fällig">
                  {machineHall.due.map((machine) => (
                    <li key={machine.id}>
                      <div>
                        <b>{machine.label}</b>
                        <small>{machine.game} · Zustand {machine.condition} %</small>
                      </div>
                      <button
                        type="button"
                        className={`btn small${machine.ready ? ' primary' : ' ghost'}`}
                        disabled={!machine.ready || onMaintain === undefined}
                        title={machine.note}
                        onClick={() => onMaintain?.(machine.id)}
                      >
                        Warten ({vc(machine.cost, 2)})
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
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
