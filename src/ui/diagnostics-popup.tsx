/** Diagnose: Ledger, Personal, Lager und Protokoll auf einen Blick. */
import { useState } from 'react';
import type { LedgerDiagnosis } from '../core/economy/ledger';
import { journalCounts } from '../core/sim/journal';
import type { GameView } from '../store/types';
import { vc } from './format';
import { PopupShell } from './popup-shell';
import { ROLE_LABEL, TASK_LABEL } from './staff-labels';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onAudit: () => LedgerDiagnosis;
}

export function DiagnosticsPopup({ view, onClose, onAudit }: Props) {
  const [report, setReport] = useState<LedgerDiagnosis | null>(null);
  const counts = journalCounts(view.journal);
  const bars = view.furniture.filter((item) => item.kind === 'BAR');
  const capacity = 6 + 6 * view.barLevel;
  const broken = view.furniture.filter((item) => item.damaged || item.condition < 85 || item.clogged);
  return (
    <PopupShell eyebrow="SYSTEMCHECK" title="Diagnose" onClose={onClose} wide>
      <div className="diag-grid">
        <section className={`diag-card${view.ledgerOk ? ' ok' : ' bad'}`} aria-label="Ledger">
          <header><h3>Ledger</h3><span className={`pill${view.ledgerOk ? ' ok' : ' bad'}`}>{view.ledgerOk ? 'OK' : 'FEHLER'}</span></header>
          <p className="diag-note">{view.ledgerOk ? 'Jede Buchung ist gedeckt und replaybar.' : 'Der Ledger widerspricht sich. Verkäufe und Auszahlungen sind blockiert.'}</p>
          <dl>
            <div><dt>Buchungen</dt><dd>{view.ledgerEntries}</dd></div>
            <div><dt>Letzte Seq</dt><dd>{view.ledgerLastSeq}</dd></div>
            <div><dt>Im Umlauf</dt><dd>{vc(view.ledgerCirculating, 2)}</dd></div>
            <div><dt>Offen</dt><dd>{vc(view.pending, 2)}</dd></div>
          </dl>
          <button type="button" className="btn primary" onClick={() => setReport(onAudit())}>VOLLPRÜFUNG STARTEN</button>
          {report && (
            <div className={`diag-report${report.ok ? ' ok' : ' bad'}`} role="status">
              <strong>{report.ok ? 'Vollprüfung bestanden' : 'Vollprüfung fehlgeschlagen'}</strong>
              <small>{report.entries} Buchungen · Checkpoint {report.checkpointSeq} · {report.liabilities.length} Verbindlichkeitskonten</small>
              {report.failure && <p>Bruch bei Seq {report.failure.seq}: {report.failure.reason}</p>}
              {!report.ok && <p>Folge: Auszahlungen und Käufe werden abgewiesen, bis der Stand neu geladen ist.</p>}
            </div>
          )}
        </section>

        <section className="diag-card" aria-label="Personal">
          <header><h3>Personal</h3><span className="pill">{view.agents.length} aktiv</span></header>
          {view.agents.length === 0 ? <p className="diag-note">Niemand eingestellt. Kisten, Dreck und Streit bleiben liegen.</p> : (
            <ul className="diag-list">
              {view.agents.map((agent) => (
                <li key={agent.id}>
                  <strong>{ROLE_LABEL[agent.role] ?? agent.role}</strong>
                  <span>{TASK_LABEL[agent.task] ?? agent.task}</span>
                  {agent.blockedReason && <small className="warn-text">{agent.blockedReason}</small>}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="diag-card" aria-label="Lager">
          <header><h3>Lager &amp; Bar</h3><span className="pill">{view.parts} Teile</span></header>
          <ul className="diag-list">
            {bars.length === 0 && <li><strong>Keine Bar</strong><span>Gäste können nicht trinken.</span></li>}
            {bars.map((bar) => (
              <li key={bar.id}>
                <strong>Bar {bar.stock}/{capacity}</strong>
                <span>{bar.stock === 0 ? 'leer – Gäste verlieren Laune' : bar.stock < capacity / 3 ? 'fast leer' : 'bestückt'}</span>
              </li>
            ))}
            <li><strong>Ersatzteile {view.parts}</strong><span>{view.parts <= 0 ? 'Reparaturen blockiert' : `${broken.length} Geräte brauchen Pflege`}</span></li>
            <li><strong>{view.crates.length} Kisten</strong><span>{view.crates.filter((crate) => crate.carriedBy === null).length} warten am Eingang</span></li>
          </ul>
        </section>

        <section className="diag-card" aria-label="Protokoll">
          <header><h3>Protokoll</h3><span className="pill">{view.journal.length} Einträge</span></header>
          <ul className="diag-list">
            {Object.entries(counts).map(([key, value]) => (
              <li key={key}><strong>{key}</strong><span>{value} Ereignisse</span></li>
            ))}
          </ul>
          <p className="diag-note">Der Puffer behält die letzten 240 Ereignisse; der Ledger bleibt die vollständige Geldwahrheit.</p>
        </section>
      </div>
    </PopupShell>
  );
}
