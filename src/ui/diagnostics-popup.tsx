/** Diagnose: Buchhaltung, Personal, Lager und Protokoll auf einen Blick. */
import { useState } from 'react';
import type { LedgerDiagnosis } from '../core/economy/ledger';
import { journalCounts } from '../core/sim/journal';
import type { GameView } from '../store/types';
import { vc } from './format';
import { HELP } from './glossary';
import { PopupShell } from './popup-shell';
import { ROLE_LABEL, TASK_LABEL } from './staff-labels';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onAudit: () => LedgerDiagnosis;
}

const KIND_LABEL: Record<string, string> = {
  MONEY: 'Geld', GUEST: 'Gäste', STAFF: 'Personal', STOCK: 'Lager', RIVAL: 'Rivalen', SYSTEM: 'System',
};

export function DiagnosticsPopup({ view, onClose, onAudit }: Props) {
  const [report, setReport] = useState<LedgerDiagnosis | null>(null);
  const counts = journalCounts(view.journal);
  const bars = view.furniture.filter((item) => item.kind === 'BAR');
  const capacity = 6 + 6 * view.barLevel;
  const broken = view.furniture.filter((item) => item.damaged || item.condition < 85 || item.clogged);
  const occupied = view.furniture.reduce((sum, item) => sum + (item.gameId ? item.occupants.length : 0), 0);
  return (
    <PopupShell eyebrow="SYSTEMCHECK · EHRLICHE ZAHLEN" title="Prüfung" onClose={onClose} wide>
      <div className="diag-grid">
        <section className={`diag-card${view.ledgerOk ? ' ok' : ' bad'}`} aria-label="Ledger">
          <header><h3>Buchhaltung</h3><span className={`pill${view.ledgerOk ? ' ok' : ' bad'}`}>{view.ledgerOk ? 'OK' : 'FEHLER'}</span></header>
          <p className="diag-note">
            {view.ledgerOk
              ? 'Jede Buchung ist gedeckt und nachvollziehbar. Geld entsteht nur durch Arbeit, nie aus dem Nichts.'
              : 'Die Buchhaltung widerspricht sich. Verkäufe und Auszahlungen sind blockiert.'}
          </p>
          <dl>
            <div title="Jede Zeile ist eine Bewegung zwischen zwei Konten."><dt>Buchungszeilen</dt><dd>{view.ledgerEntries}</dd></div>
            <div title="Fortlaufende Nummer der letzten Buchung."><dt>Letzte Nr.</dt><dd>{view.ledgerLastSeq}</dd></div>
            <div title="Geld, das gerade in Konten und Brieftaschen steckt."><dt>Geld im Umlauf</dt><dd>{vc(view.ledgerCirculating, 2)}</dd></div>
            <div title={HELP.offen}><dt>Offene Gewinne</dt><dd>{vc(view.pending, 2)}</dd></div>
          </dl>
          <button type="button" className="btn primary" onClick={() => setReport(onAudit())} title="Prüft alle Buchungen der Reihe nach.">VOLLPRÜFUNG STARTEN</button>
          {report && (
            <div className={`diag-report${report.ok ? ' ok' : ' bad'}`} role="status">
              <strong>{report.ok ? 'Vollprüfung bestanden' : 'Vollprüfung fehlgeschlagen'}</strong>
              <small>{report.entries} Buchungszeilen · Prüfpunkt {report.checkpointSeq} · {report.liabilities.length} Schuldenkonten</small>
              {report.failure && <p>Bruch bei Nr. {report.failure.seq}: {report.failure.reason}</p>}
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
          <header><h3>Bar &amp; Lager</h3><span className="pill">{view.parts} Ersatzteile</span></header>
          <ul className="diag-list">
            {bars.length === 0 && <li><strong>Keine Bar</strong><span>Gäste können nicht trinken.</span></li>}
            {bars.map((bar) => (
              <li key={bar.id}>
                <strong>Bar {bar.stock}/{capacity}</strong>
                <span>{bar.stock === 0 ? 'leer – Gäste verlieren Laune' : bar.stock < capacity / 3 ? 'fast leer' : 'bestückt'}</span>
              </li>
            ))}
            <li><strong>Ersatzteile {view.parts}</strong><span>{view.parts <= 0 ? 'Reparaturen blockiert' : `${broken.length} Geräte brauchen Pflege · 1 Teil pro Reparatur`}</span></li>
            <li><strong>{view.crates.length} Kisten</strong><span>{view.crates.filter((crate) => crate.carriedBy === null).length} warten am Eingang</span></li>
          </ul>
        </section>

        <section className="diag-card" aria-label="Nachfrage">
          <header><h3>Nachfrage</h3><span className="pill">~{Math.round(view.demand.perDay)}/Tag</span></header>
          <dl>
            {view.demand.sources.map((source) => (
              <div key={source.id}>
                <dt>{source.label}</dt>
                <dd>{source.perDay >= 0 ? '+' : ''}{source.perDay.toFixed(1)}</dd>
              </div>
            ))}
            <div><dt>Nächster Gast</dt><dd>in {view.demand.nextArrivalIn} Ticks</dd></div>
            <div><dt>Spielplätze</dt><dd>{occupied}/{view.seats} besetzt</dd></div>
          </dl>
          {view.demand.event && (
            <p className="diag-note">
              {view.demand.event.label} läuft noch {view.demand.event.ticksLeft} Ticks und bringt zusätzliche Gäste.
            </p>
          )}
          <p className="diag-note">
            Keine Obergrenze: Sitzplätze, Kasse und Wege entscheiden nur, wie gut der Betrieb den Andrang bedient.
          </p>
        </section>

        <section className="diag-card" aria-label="Protokoll">
          <header><h3>Protokoll</h3><span className="pill">{view.journal.length} Einträge</span></header>
          <ul className="diag-list">
            {Object.entries(counts).map(([key, value]) => (
              <li key={key}><strong>{KIND_LABEL[key] ?? key}</strong><span>{value} Ereignisse</span></li>
            ))}
          </ul>
          <p className="diag-note">
            Der Live-Puffer behält die letzten 240 Ereignisse, das Archiv alle ({view.archive.length} gespeichert).
            Die Buchhaltung bleibt die vollständige Geldwahrheit.
          </p>
        </section>
      </div>
    </PopupShell>
  );
}
