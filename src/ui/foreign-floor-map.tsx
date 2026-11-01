/**
 * Foreign Floor Map: Übersichtskarte aller fremden Casinos.
 * Klick auf eine Kachel betritt das jeweilige Casino.
 */

import { useState } from 'react';
import type { RivalId } from '../core/sim/types';
import { RIVALS, rivalStates } from '../core/sim/rivals';
import { vc } from './format';
import { PopupShell } from './popup-shell';

interface ForeignFloorMapProps {
  readonly view: {
    readonly currentForeignFloorId: number | null;
    readonly foreignFloors: readonly {
      readonly id: number;
      readonly rivalId: RivalId;
      readonly size: number;
      readonly jobStations: readonly {
        readonly id: string;
        readonly jobId: string;
        readonly x: number;
        readonly y: number;
        readonly w: number;
        readonly h: number;
        readonly label: string;
        readonly description: string;
      }[];
    }[];
    readonly wallet: number;
  };
  readonly onVisit: (rivalId: RivalId) => void;
  readonly onClose: () => void;
}

const RIVAL_INFO: Record<RivalId, { label: string; color: string }> = {
  HAFENKLAUSE: { label: 'Hafenklause', color: '#ff6b6b' },
  GOLDENE_HAND: { label: 'Goldene Hand', color: '#4ecdc4' },
  NEBELPALAST: { label: 'Nebelpalast', color: '#45b7d1' },
};

export function ForeignFloorMap({ view, onVisit, onClose }: ForeignFloorMapProps) {
  const states = rivalStates(0);
  const [selectedRival, setSelectedRival] = useState<RivalId | null>(null);

  return (
    <PopupShell eyebrow="ÜBERSICHTSKARTE" title="Fremde Casinos" onClose={onClose} wide={false}>
      <div className="foreign-floor-map">
        <p className="map-hint">
          Wähle ein fremdes Casino zum Betreten. Dort kannst du Jobs annehmen,
          arbeiten und an den Maschinen spielen. Dein Portemonnaie: {vc(view.wallet, 2)}
        </p>

        <div className="rival-grid">
          {RIVALS.map((rival) => {
            const state = states.find((s) => s.id === rival.id)!;
            const isActive = view.currentForeignFloorId !== null
              && view.foreignFloors.some((f) => f.rivalId === rival.id && f.id === view.currentForeignFloorId);
            const hasJobStations = rival.jobStations.length > 0;
            const jobs = rival.jobStations.map((js) => js.jobId).join(', ');

            return (
              <button
                key={rival.id}
                type="button"
                className={`rival-card${isActive ? ' active' : ''}${!hasJobStations ? ' no-jobs' : ''}`}
                onClick={() => {
                  setSelectedRival(rival.id);
                  onVisit(rival.id);
                }}
                disabled={isActive}
              >
                <div className="rival-header" style={{ borderColor: RIVAL_INFO[rival.id].color }}>
                  <span className="rival-name">{RIVAL_INFO[rival.id].label}</span>
                  <span className="rival-security">Sicherheit {state.security}/5</span>
                </div>
                <div className="rival-details">
                  <span>Ruf: {state.reputation}%</span>
                  <span>Einsatz ab: {vc(rival.minBet, 2)}</span>
                  {hasJobStations && (
                    <span className="jobs-available">Jobs: {jobs}</span>
                  )}
                  {!hasJobStations && (
                    <span className="no-jobs-text">Keine Jobs verfügbar</span>
                  )}
                </div>
                <div className="rival-description">{rival.style}</div>
                {isActive ? (
                  <span className="rival-status active">Aktuell</span>
                ) : hasJobStations ? (
                  <span className="rival-status available">Betreten</span>
                ) : (
                  <span className="rival-status locked">Keine Arbeit</span>
                )}
              </button>
            );
          })}
        </div>

        {selectedRival && (
          <div className="selected-rival-info">
            <strong>Gewählt: {RIVAL_INFO[selectedRival].label}</strong>
            <span>Klicke auf „Betreten“ um das Casino zu besuchen.</span>
          </div>
        )}
      </div>
    </PopupShell>
  );
}
