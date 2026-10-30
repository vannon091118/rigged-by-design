/** Bau-Sektionen: Personal, Hauswahl, Farben, Kisten, Streit. Reine Darstellung. */
import { expansionCost, isExpansion } from '../core/sim/expansions';
import { remodelRequirements } from '../core/sim/remodel';
import type { StaffRole, TemplateId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { vc } from './format';
import { ROLE_LABEL, TASK_LABEL } from './staff-labels';

function Staff(props: { label: string; note: string; wage: number; on: boolean; onHire: () => void; onFire: () => void }) {
  return (
    <div className={`staff${props.on ? ' on' : ''}`}>
      <div><strong>{props.label}</strong><small>{props.note} · {vc(props.wage, 0)}/Tag</small></div>
      <button type="button" className={`btn small${props.on ? ' ghost' : ''}`} onClick={props.on ? props.onFire : props.onHire}>
        {props.on ? 'ENTLASSEN' : 'EINSTELLEN'}
      </button>
    </div>
  );
}

const TEMPLATES: readonly { id: TemplateId; name: string; note: string }[] = [
  { id: 'SMALL', name: 'Kleine Bude', note: '1 Saal, 1 Automat, alles überschaubar.' },
  { id: 'MEDIUM', name: 'Mittleres Haus', note: 'Mehr Tische, Bar, Klo, Platz für Personal.' },
  { id: 'LARGE', name: 'Großes Casino', note: 'Alle Spiele, Deko, Personal, volle Fläche.' },
];

export function TemplateGrid(props: { view: GameView; onTemplate: (id: TemplateId) => void }) {
  const { view } = props;
  return (
    <div className="template-grid">
      {TEMPLATES.map((template) => {
        const current = view.template === template.id;
        // Ausbau kostet nur die Differenz; ein kleineres Haus ist kein Ausbau.
        const expandable = isExpansion(view.template, template.id);
        const cost = expansionCost(view.template, template.id);
        const req = expandable ? remodelRequirements(template.id) : null;
        const locked = req !== null
          && (view.day < req.day || view.reputation < req.reputation || view.guestsServed < req.served);
        return (
          <button
            key={template.id}
            type="button"
            className={`template-card${current ? ' active' : ''}`}
            onClick={() => props.onTemplate(template.id)}
            disabled={current || !expandable || view.house < cost || locked}
          >
            <strong>{template.name}</strong>
            <span>{template.note}</span>
            {req && <small>braucht Tag {req.day}, Ruf {req.reputation}, {req.served} Gäste</small>}
            <b>{current ? 'aktuell' : expandable ? `Ausbau ${vc(cost, 0)}` : 'kein Ausbau'}</b>
          </button>
        );
      })}
    </div>
  );
}

export function ColorRow(props: { colors: readonly string[]; active: string; onPick: (color: string) => void }) {
  return (
    <div className="carpet-row">
      {props.colors.map((color) => (
        <button key={color} type="button" className={`carpet${props.active === color ? ' active' : ''}`}
          style={{ background: color }} onClick={() => props.onPick(color)} aria-label={color} />
      ))}
    </div>
  );
}

export function CrateList(props: {
  view: GameView; carriedId: number | null; onPickup: (id: number) => void; onUnload: () => void;
}) {
  const { view } = props;
  const label = (id: number): string => {
    const crate = view.crates.find((entry) => entry.id === id);
    if (!crate) return 'Kiste';
    if (crate.payload.kind === 'FURNITURE') return `Möbel (${crate.payload.buildId})`;
    if (crate.payload.kind === 'DRINKS') return `${crate.payload.count} Getränke`;
    return `${crate.payload.count} Ersatzteile`;
  };
  const carrier = (crate: GameView['crates'][number]): string => {
    if (crate.carriedBy === 'player') return 'getragen – abladen oder aufstellen';
    if (typeof crate.carriedBy === 'number') {
      const agent = view.agents.find((entry) => entry.id === crate.carriedBy);
      return agent ? `unterwegs: ${ROLE_LABEL[agent.role]}` : 'unterwegs';
    }
    return 'liegt am Eingang';
  };
  return (
    <div className="ops-row">
      {view.crates.length === 0 && <small className="muted">Keine Kisten am Eingang.</small>}
      {view.crates.map((crate) => (
        <div key={crate.id} className="staff">
          <div><strong>{label(crate.id)}</strong>
            <small>{carrier(crate)}</small></div>
          {crate.carriedBy === null && (
            <button type="button" className="btn small" onClick={() => props.onPickup(crate.id)}>ABHOLEN</button>
          )}
        </div>
      ))}
      {props.carriedId !== null && (
        <button type="button" className="btn primary" onClick={props.onUnload}>
          ABLADEN (Bar oder Lager, je nach Kiste)
        </button>
      )}
      {props.carriedId !== null && view.crates.some((c) => c.id === props.carriedId && c.payload.kind === 'FURNITURE') && (
        <small className="muted">Möbelkiste: auf eine freie Floor-Fläche klicken.</small>
      )}
    </div>
  );
}

export function DisputeList(props: { view: GameView; onCalm: (id: number) => void }) {
  if (props.view.disputes.length === 0) return null;
  return (
    <>
      <h3>Streit ({props.view.disputes.length})</h3>
      <div className="ops-row">
        {props.view.disputes.map((dispute) => (
          <button key={dispute.id} type="button" className="btn repair" onClick={() => props.onCalm(dispute.id)}>
            SCHLICHTEN (Stufe {dispute.level})
          </button>
        ))}
      </div>
    </>
  );
}

export function StaffStatus(props: { view: GameView }) {
  if (props.view.agents.length === 0) return null;
  return (
    <div className="staff-status-list">
      {props.view.agents.map((agent) => (
        <div key={agent.id} className="staff-status">
          <strong>{ROLE_LABEL[agent.role]}</strong>
          <span>{TASK_LABEL[agent.task] ?? agent.task}</span>
          {agent.blockedReason && <small className="warn-text">{agent.blockedReason}</small>}
        </div>
      ))}
    </div>
  );
}

export function StaffGrid(props: { view: GameView; onHire: (role: StaffRole) => void; onFire: (role: StaffRole) => void }) {
  const { view } = props;
  return (
    <div className="staff-grid">
      <Staff label="Guard" note="Schlichtet Streit. Tageslohn." wage={view.prices.guardWage} on={view.staff.guard} onHire={() => props.onHire('guard')} onFire={() => props.onFire('guard')} />
      <Staff label="Reinigung" note="Putzt auf dem Floor. Tageslohn." wage={view.prices.staffWage} on={view.staff.cleaner} onHire={() => props.onHire('cleaner')} onFire={() => props.onFire('cleaner')} />
      <Staff label="Barkeeper" note="Schnellerer Service. Tageslohn." wage={view.prices.staffWage} on={view.staff.bartender} onHire={() => props.onHire('bartender')} onFire={() => props.onFire('bartender')} />
      <Staff label="Kassierer" note="Bedient Kasse sofort. Tageslohn." wage={view.prices.cashierWage} on={view.staff.cashier} onHire={() => props.onHire('cashier')} onFire={() => props.onFire('cashier')} />
      <Staff label="Lagerträger" note="Trägt Kisten ein. Tageslohn." wage={view.prices.porterWage} on={view.staff.porter} onHire={() => props.onHire('porter')} onFire={() => props.onFire('porter')} />
    </div>
  );
}
