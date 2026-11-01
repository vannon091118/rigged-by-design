/** Import und Export: Spielstand als JSON sichern, pruefen und zurueckspielen. */
import { useState } from 'react';
import { escalationFor, type EscalationLevel } from '../core/io/issues';
import type { TransferReport } from '../store/transfer';
import { worldStore } from '../store/use-world-store';

const LEVEL_LABEL: Record<EscalationLevel, string> = {
  AUTO_FIX: 'automatisch repariert',
  LOCAL_GATE: 'ignoriert',
  REMOTE_CI: 'CI',
  AGENT: 'Agent',
  BLOCKED: 'Blocker',
};

export function TransferPanel() {
  const [text, setText] = useState('');
  const [report, setReport] = useState<TransferReport | null>(null);
  return (
    <section className="diag-card" aria-label="Import und Export">
      <header><h3>Import &amp; Export</h3><span className="pill">JSON</span></header>
      <p className="diag-note">
        Sichert den Stand als Datei oder prueft einen fremden Stand, bevor er uebernommen wird.
        Reparierbare Felder werden ergaenzt, Blocker verhindern den Import.
      </p>
      <label className="transfer-label" htmlFor="transfer-json">Export-JSON</label>
      <textarea
        id="transfer-json"
        className="transfer-box"
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={3}
      />
      <div className="transfer-actions">
        <button type="button" className="btn" onClick={() => { setText(worldStore.exportGame()); setReport(null); }}>EXPORTIEREN</button>
        <button type="button" className="btn" onClick={() => setReport(worldStore.planImport(text))}>PRUEFEN</button>
        <button type="button" className="btn primary" onClick={() => setReport(worldStore.importGame(text))}>IMPORTIEREN</button>
      </div>
      {report && (
        <div className="transfer-report" role="status">
          <strong>{report.ok ? 'Stand ist uebernehmbar' : 'Stand blockiert'}</strong>
          <small>{report.fatal} Blocker · {report.repairs} Reparaturen · {report.ignored} ignoriert</small>
          {report.issues.map((item, index) => (
            <span key={`${item.path}-${index}`}>{item.message} ({LEVEL_LABEL[escalationFor(item.level)]})</span>
          ))}
        </div>
      )}
    </section>
  );
}
