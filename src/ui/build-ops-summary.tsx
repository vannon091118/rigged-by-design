/** Kompakte Betriebsübersicht: die vier Zahlen, die den Floor erklären. */
import { businessAreas } from '../core/sim/business-areas';
import { drinkMenu } from '../core/sim/drink-menu';
import type { GameView } from '../store/types';
import { vc } from './format';

export function BuildOpsSummary({ view }: { readonly view: GameView }) {
  const machines = view.furniture.filter((item) => item.gameId);
  const occupied = machines.reduce((sum, item) => sum + item.occupants.length, 0);
  const broken = machines.filter((item) => item.damaged || item.condition < 85 || item.clogged).length;
  // Agent 17: die Bereiche des Hauses, gelesen aus derselben Sicht.
  const areas = businessAreas(view);
  // Agent 18: die Getraenkekarte, gelesen aus Grundpreis und Barstufe.
  const drinks = drinkMenu(view);
  const barStock = view.furniture.reduce((sum, item) => sum + (item.kind === 'BAR' ? item.stock : 0), 0);
  return (
    <section className="ops-summary" aria-label="Betriebsübersicht">
      <div className="ops-card">
        <span>HAUSKONTO</span>
        <strong>{vc(view.house, 0)}</strong>
        <small>Kasse {vc(view.desk, 0)} · Offen {vc(view.pending, 0)}</small>
      </div>
      <div className="ops-card">
        <span>AUSLASTUNG</span>
        <strong>{occupied}<em>/{view.seats}</em></strong>
        <small>~{Math.round(view.demand.perDay)} Gäste pro Tag</small>
      </div>
      <div className="ops-card">
        <span>PERSONAL</span>
        <strong>{view.agents.length}</strong>
        <small>{view.agents.length === 0 ? 'Niemand im Dienst' : 'im Dienst'}</small>
      </div>
      <div className={`ops-card${broken > 0 ? ' bad' : ''}`}>
        <span>WARTUNG</span>
        <strong>{broken}</strong>
        <small>{view.parts} Ersatzteile · {broken === 0 ? 'alles heil' : 'brauchen Pflege'}</small>
      </div>
      <p className="ops-areas">
        {areas.map((entry) => `${entry.name} ${entry.open ? `${entry.objects} Objekte, ${entry.guests} Gäste` : 'nicht im Haus'}`).join(' · ')}
      </p>
      <p className="ops-drinks">
        {`Karte: ${drinks.map((drink) => `${drink.name} ${vc(drink.price, 2)}`).join(' · ')} · Bestand ${barStock}`}
      </p>
    </section>
  );
}
