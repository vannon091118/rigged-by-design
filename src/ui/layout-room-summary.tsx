/** Raumkopf des Layout-Editors: Zahlen aus dem vorhandenen Raumplan. */
import type { LayoutState } from '../core/sim/layout-types';
import { roomPlanSummary, roomPlans } from '../core/sim/room-plan';

export function LayoutRoomSummary({ layout }: { readonly layout: LayoutState }) {
  const summary = roomPlanSummary(roomPlans(layout));
  return (
    <>
      <p className="panel-note">
        {summary.rooms} Räume · {summary.reachable} erreichbar · {summary.guestCapacity} Plätze geplant
      </p>
      {summary.withoutAccess.length > 0 && (
        <p className="layout-editor-issue">Ohne Zugang: {summary.withoutAccess.join(', ')}.</p>
      )}
    </>
  );
}
