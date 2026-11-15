/** Aktionskarte auf fremden Floors: eigene Ziele, eigene Aussagen, keine eigenen Commands. */
import type { InteractionTarget } from '../core/sim/interaction';
import type { GameView } from '../store/types';
import type { MenuAction } from './floor-actions';

const target = (kind: InteractionTarget['kind'], id: number): InteractionTarget => ({ kind, id });

/**
 * Sitzplaetze sind belegt oder frei; der Grund steht an der Aktion statt in
 * einer stillen Sperre. Fremde Moebel und Gaeste werden nie ueber die Commands
 * des eigenen Casinos bedient.
 */
function buildForeignFurnitureActions(view: GameView, itemId: number): MenuAction[] {
  const item = view.furniture.find((entry) => entry.id === itemId);
  if (!item) return [];
  if (item.seats > 0) {
    const occupied = view.guests.filter((guest) => guest.targetFurniture === item.id).length;
    const free = item.seats - occupied;
    return [{
      id: 'FOREIGN_SIT', label: 'Platz nehmen', enabled: free > 0,
      targetId: item.id, target: target('furniture', item.id),
      reason: free > 0 ? undefined : `Platz belegt (${occupied}/${item.seats}).`,
    }];
  }
  return [{
    id: 'FOREIGN_LOOK', label: item.label, enabled: false, targetId: item.id,
    reason: 'Im fremden Haus bedienst du keine Möbel.',
  }];
}

function buildForeignGuestActions(view: GameView, guestId: number): MenuAction[] {
  const guest = view.guests.find((entry) => entry.id === guestId);
  if (!guest) return [];
  return [{
    id: 'FOREIGN_TALK', label: 'Ansprechen', enabled: false, targetId: guest.id,
    reason: 'Im fremden Haus bleibt das Gespräch aus.',
  }];
}

export function buildForeignActions(view: GameView, focus: InteractionTarget): MenuAction[] {
  if (focus.kind === 'furniture') return buildForeignFurnitureActions(view, focus.id);
  if (focus.kind === 'guest') return buildForeignGuestActions(view, focus.id);
  return [];
}
