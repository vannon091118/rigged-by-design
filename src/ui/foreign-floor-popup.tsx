/** Fenster auf einem fremden Floor: HUD plus Job-Menue an der gewaehlten Station. */
import { useState } from 'react';
import type { RivalId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { ForeignFloorHud } from './foreign-floor-hud';
import { JobContextMenu } from './job-context-menu';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onOpenMap: () => void;
  readonly onOpenGames: (rivalId: RivalId) => void;
}

export function ForeignFloorPopup({ view, onClose, onOpenMap, onOpenGames }: Props) {
  const [stationId, setStationId] = useState<string | null>(null);
  const floor = view.foreignFloors.find((entry) => entry.id === view.currentForeignFloorId);
  const station = floor?.jobStations.find((entry) => entry.id === stationId) ?? null;
  if (!floor) return null;
  return (
    <>
      <ForeignFloorHud
        view={view}
        onClose={onClose}
        onOpenMap={onOpenMap}
        onSelectStation={setStationId}
        onOpenGames={() => onOpenGames(floor.rivalId)}
        onLeaveFloor={() => { worldStore.leaveForeign(); onClose(); }}
      />
      {station && (
        <JobContextMenu
          station={station}
          playerJob={view.playerJob}
          rivalId={floor.rivalId}
          onClose={() => setStationId(null)}
          onAcceptJob={(jobId) => {
            worldStore.acceptJob(floor.rivalId, jobId);
            setStationId(null);
          }}
          onQuitJob={() => {
            worldStore.quitJob();
            setStationId(null);
          }}
          onStartTask={() => {
            worldStore.requestJobTask();
            setStationId(null);
          }}
          onLeaveFloor={() => { worldStore.leaveForeign(); onClose(); }}
        />
      )}
    </>
  );
}
