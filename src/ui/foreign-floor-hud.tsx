/**
 * Foreign Floor HUD: Anzeige auf fremden Floors.
 * Zeigt Job-Status, Bar-Fortschritt und Portemonnaie.
 */

import type { GameView } from '../store/types';
import { vc } from './format';

interface ForeignFloorHudProps {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onLeaveFloor: () => void;
  readonly onOpenMap: () => void;
}

export function ForeignFloorHud({ view, onClose, onLeaveFloor, onOpenMap }: ForeignFloorHudProps) {
  const job = view.playerJob;
  const barProgress = Math.min(100, (view.wallet / 10_000) / 50 * 100); // 50 VC Ziel

  return (
    <header className="foreign-floor-hud">
      <div className="hud-brand">
        <span className="hud-mark">F</span>
        <div>
          <strong>FREMDES CASINO</strong>
          <small>Tag {view.day} · Außenposten</small>
        </div>
      </div>

      <div className="hud-money">
        <span>Portemonnaie</span>
        <strong>{vc(view.wallet, 2)}</strong>
        <span className="bar-progress-label">Bar-Ziel: 50 VC</span>
        <div className="bar-progress">
          <div className="bar-progress-fill" style={{ width: `${barProgress}%` }} />
        </div>
      </div>

      <div className="hud-job-status">
        {job ? (
          <>
            <span>Job: {job.jobId}</span>
            <span>Arbeitstag: {job.workDays}</span>
            <span>Letzte Auszahlung: Tag {job.lastPaidDay}</span>
            {job.currentTask && (
              <div className="task-progress">
                <span>Aufgabe: {job.currentTask.taskType}</span>
                <div className="task-progress-bar">
                  <div className="task-progress-fill" style={{ width: `${(job.currentTask.ticksElapsed / job.currentTask.ticksTotal) * 100}%` }} />
                </div>
              </div>
            )}
          </>
        ) : (
          <span>Kein Job aktiv</span>
        )}
      </div>

      <div className="hud-actions">
        <button type="button" className="btn ghost" onClick={onOpenMap}>
          KARTE
        </button>
        <button type="button" className="btn ghost" onClick={onLeaveFloor}>
          ZURÜCK
        </button>
        <button type="button" className="btn ghost help-btn" onClick={onClose}>
          ?
        </button>
      </div>
    </header>
  );
}
