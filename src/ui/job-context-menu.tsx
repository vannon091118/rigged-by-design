/**
 * Job-Kontext-Menu: Sims-Style Interaktion an einer Job-Station.
 * Keine statischen Listen – alles interaktiv via Dropdown und Buttons.
 * Öffnet sich direkt an der Station auf dem Foreign Floor.
 */

import { useState } from 'react';
import type { JobStationDef, PlayerJobId, PlayerJobState, RivalId } from '../core/sim/types';
import { JOB_DEFS } from '../core/sim/player-jobs';
import { PopupShell } from './popup-shell';

interface JobContextMenuProps {
  readonly station: JobStationDef;
  readonly playerJob: PlayerJobState | null;
  readonly rivalId: RivalId;
  readonly onClose: () => void;
  readonly onAcceptJob: (jobId: PlayerJobId) => void;
  readonly onQuitJob: () => void;
  readonly onStartTask: () => void;
  readonly onLeaveFloor: () => void;
}

const JOB_LABEL: Record<PlayerJobId, string> = {
  CLEANER: 'Reinigungskraft',
  BARTENDER: 'Barkeeper',
  CARD_DEALER: 'Croupier',
  MECHANIC: 'Automaten-Mechaniker',
};

export function JobContextMenu({
  station, playerJob, rivalId, onClose, onAcceptJob, onQuitJob, onStartTask, onLeaveFloor,
}: JobContextMenuProps) {
  const def = JOB_DEFS[station.jobId];
  const [selectedJob, setSelectedJob] = useState<PlayerJobId | null>(null);

  const hasJob = playerJob !== null;
  const isOwnJob = hasJob && playerJob.jobId === station.jobId && playerJob.rivalId === rivalId;

  // Eine Station bietet genau den Job, fuer den sie gebaut wurde.
  const availableJobs: PlayerJobId[] = [station.jobId];

  return (
    <PopupShell eyebrow="ARBEIT" title={station.label} onClose={onClose} wide={false}>
      <div className="job-context-menu">
        <div className="job-info">
          <strong>{JOB_LABEL[station.jobId]}</strong>
          <span>{def.description}</span>
          <div className="job-details">
            <span>Lohn: {def.dailyWageVC} VC/Tag</span>
            <span>XP/Aufgabe: {def.baseXpPerTask}</span>
            <span>Verletzungsrisiko: {(def.injuryChance * 100).toFixed(0)}%</span>
          </div>
        </div>

        {!hasJob && (
          <div className="job-select-section">
            <label>Verfügbare Jobs an dieser Station:</label>
            <select
              value={selectedJob ?? ''}
              onChange={(e) => setSelectedJob(e.currentTarget.value as PlayerJobId)}
              className="job-select"
            >
              <option value="">Job wählen…</option>
              {availableJobs
                .filter((jid) => JOB_DEFS[jid].rivalId === rivalId)
                .map((jid) => (
                  <option key={jid} value={jid}>
                    {JOB_LABEL[jid]} — {JOB_DEFS[jid].dailyWageVC} VC/Tag
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn primary"
              disabled={!selectedJob}
              onClick={() => selectedJob && onAcceptJob(selectedJob)}
            >
              JOB ANNEHMEN
            </button>
          </div>
        )}

        {hasJob && !isOwnJob && (
          <div className="job-conflict">
            <span className="warn">Du arbeitest bereits bei einem anderen Betreiber.</span>
            <button type="button" className="btn" onClick={onQuitJob}>
              AKTUELLEN JOB KÜNDIGEN
            </button>
          </div>
        )}

        {isOwnJob && (
          <div className="job-active-section">
            <span className="ok">Job aktiv: {JOB_LABEL[playerJob.jobId]}</span>
            <button type="button" className="btn primary" onClick={onStartTask}>
              ARBEIT AUFNEHMEN
            </button>
            <button type="button" className="btn ghost" onClick={onQuitJob}>
              JOB KÜNDIGEN
            </button>
          </div>
        )}

        <div className="job-actions">
          <button type="button" className="btn ghost" onClick={onLeaveFloor}>
            FLOOR VERLASSEN
          </button>
          <button type="button" className="btn ghost" onClick={onClose}>
            SCHLIESSEN
          </button>
        </div>
      </div>
    </PopupShell>
  );
}
