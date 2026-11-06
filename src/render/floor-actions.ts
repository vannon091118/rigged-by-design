/** Baut die Radial-Menu-Aktionen für ein geklicktes Objekt. */
import type { WorldState } from '../core/sim/types';

export type MenuAction = { id: string; label: string; enabled: boolean; targetId?: number };

export function buildStainActions(world: WorldState, stain: { id: number; x: number; y: number }): MenuAction[] {
  const carryingMop = world.player.carrying.startsWith('MOP:');
  return [
    { id: 'CLEAN_STAIN', label: 'Reinigen', enabled: carryingMop, targetId: stain.id },
    { id: 'CANCEL', label: 'Abbrechen', enabled: true },
  ];
}

export function buildGuestActions(world: WorldState, guest: { id: number; disputeId: number | null; thirst: number }): MenuAction[] {
  const carryingDrink = world.player.carrying === 'DRINK';
  const hasDispute = guest.disputeId !== null;
  return [
    { id: 'TALK', label: 'Reden', enabled: true, targetId: guest.id },
    { id: 'CALM', label: 'Schlichten', enabled: hasDispute, targetId: guest.disputeId ?? guest.id },
    { id: 'FIGHT', label: 'Konfrontation', enabled: hasDispute, targetId: guest.disputeId ?? guest.id },
    { id: 'SERVE', label: 'Drink servieren', enabled: carryingDrink && guest.thirst > 0, targetId: guest.id },
    { id: 'CANCEL', label: 'Abbrechen', enabled: true },
  ];
}

export function buildFurnitureActions(world: WorldState, item: { kind: string; stock: number; dirt: number; label: string }): MenuAction[] {
  const carryingMop = world.player.carrying.startsWith('MOP:');
  const carryingDrink = world.player.carrying === 'DRINK';
  const actions: MenuAction[] = [];

  if (item.kind === 'BAR') {
    if (!carryingDrink) {
      actions.push({ id: 'TAKE_DRINK', label: 'Drink zapfen', enabled: item.stock > 0 });
    } else {
      actions.push({ id: 'SERVE_DRINK', label: 'Drink servieren', enabled: true });
    }
    if (item.dirt > 0) {
      actions.push({ id: 'CLEAN_BAR', label: 'Reinigen', enabled: carryingMop });
    }
  } else if (item.kind === 'TOILET') {
    if (!carryingMop) {
      actions.push({ id: 'GET_MOP', label: 'Wischer holen', enabled: true });
    } else {
      actions.push({ id: 'DROP_MOP', label: 'Wischer ablegen', enabled: true });
    }
  } else if (item.kind === 'STORAGE') {
    actions.push({ id: 'GET_DRINKS', label: 'Getränke holen', enabled: true });
    actions.push({ id: 'GET_PARTS', label: 'Ersatzteile holen', enabled: true });
  } else if (item.kind === 'EXCHANGE' || item.kind === 'DESK') {
    actions.push({ id: 'CALM_DISPUTE', label: 'Schlichten', enabled: true });
    actions.push({ id: 'FIGHT', label: 'Konfrontation', enabled: true });
  } else if (item.kind === 'DECOR' && /spiegel|mirror/i.test(item.label)) {
    actions.push({ id: 'SPIEGEL', label: 'Spiegel', enabled: true });
  }

  if (actions.length === 0) {
    actions.push({ id: 'CANCEL', label: 'Abbrechen', enabled: true });
  } else {
    actions.push({ id: 'CANCEL', label: 'Abbrechen', enabled: true });
  }
  return actions;
}
