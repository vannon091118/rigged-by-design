/** Baut die Aktionskarte fuer ein geklicktes Ziel. Eine Quelle fuer Maus, Tastatur und Touch. */
import type { InteractionTarget } from '../core/sim/interaction';
import type { GameView } from '../store/types';

export type MenuAction = {
  id: string;
  label: string;
  enabled: boolean;
  /** Argument fuer die Welt-Command (Gast, Streit, Objekt). */
  targetId?: number;
  /** Ziel, dessen Reichweite vor der Ausfuehrung erfuellt sein muss. */
  target?: InteractionTarget;
  /** Warum die Aktion gerade nicht geht; wird an der Karte angezeigt. */
  reason?: string;
  /** Bodenpunkt fuer eine Laufaktion. */
  point?: { readonly x: number; readonly y: number };
  /** Die Aktion wird als Auftrag eingereiht und naehert sich selbst. */
  queued?: boolean;
};

type ActionView = Pick<GameView, 'player'>;

const target = (kind: InteractionTarget['kind'], id: number): InteractionTarget => ({ kind, id });

function buildStainActions(world: ActionView, stain: { id: number; x: number; y: number }): MenuAction[] {
  const carryingMop = world.player.carrying.startsWith('MOP:');
  return [
    {
      id: 'CLEAN_STAIN',
      label: carryingMop ? 'Fleck reinigen' : 'Fleck reinigen (Wischer holen)',
      enabled: true,
      queued: true,
      targetId: stain.id,
      target: target('stain', stain.id),
    },
    {
      id: 'CLEAN_ROOM',
      label: 'Raum reinigen',
      enabled: true,
      queued: true,
      point: { x: stain.x, y: stain.y },
    },
  ];
}

/** Ein leerer Boden ist ein Laufziel; die Queue plant den Weg. */
export function buildFloorActions(point: { readonly x: number; readonly y: number }): MenuAction[] {
  return [{ id: 'MOVE_HERE', label: 'Hierhin laufen', enabled: true, queued: true, point }];
}

function buildMopActions(world: ActionView, mop: { id: number }): MenuAction[] {
  return [{
    id: 'PICKUP_MOP',
    label: 'Wischer aufheben',
    enabled: world.player.carrying === '',
    queued: true,
    targetId: mop.id,
    target: target('mop', mop.id),
    reason: world.player.carrying === '' ? undefined : 'Deine Hände sind voll.',
  }];
}

function buildGuestActions(
  world: ActionView,
  guest: { id: number; disputeId: number | null; thirst: number },
): MenuAction[] {
  const carryingDrink = world.player.carrying === 'DRINK';
  const hasDispute = guest.disputeId !== null;
  return [
    { id: 'TALK', label: 'Reden', enabled: true, targetId: guest.id, target: target('guest', guest.id) },
    {
      id: 'CALM', label: 'Schlichten', enabled: hasDispute,
      targetId: guest.disputeId ?? guest.id, target: target('guest', guest.id),
      reason: hasDispute ? undefined : 'Kein Streit im Gange.',
    },
    {
      id: 'FIGHT', label: 'Konfrontation', enabled: hasDispute,
      targetId: guest.disputeId ?? guest.id, target: target('guest', guest.id),
      reason: hasDispute ? undefined : 'Kein Streit im Gange.',
    },
    {
      id: 'SERVE_DRINK', label: 'Drink servieren', enabled: carryingDrink && guest.thirst > 0,
      targetId: guest.id, target: target('guest', guest.id),
      reason: carryingDrink ? 'Der Gast ist nicht durstig.' : 'Du hast keinen Drink dabei.',
    },
    { id: 'OPEN_GUEST', label: 'Profil', enabled: true, targetId: guest.id, target: target('guest', guest.id) },
  ];
}

export function buildFurnitureActions(
  world: ActionView,
  item: {
    id: number; kind: string; stock: number; dirt: number; label: string;
    gameId?: string;
  },
): MenuAction[] {
  const carryingMop = world.player.carrying.startsWith('MOP:');
  const actions: MenuAction[] = [];
  const focus = target('furniture', item.id);

  if (item.gameId) {
    actions.push({ id: 'OPEN_MACHINE', label: 'Gerät öffnen', enabled: true, targetId: item.id, target: focus });
  }
  if (item.kind === 'BAR') {
    const handsFree = world.player.carrying === '';
    actions.push({
      id: 'TAKE_DRINK', label: 'Drink zapfen', enabled: item.stock > 0 && handsFree,
      targetId: item.id, target: focus,
      reason: handsFree ? (item.stock > 0 ? undefined : 'Die Bar ist leer.') : 'Deine Hände sind voll.',
    });
  } else if (item.kind === 'TOILET') {
    actions.push({
      id: carryingMop ? 'DROP_MOP' : 'GET_MOP',
      label: carryingMop ? 'Wischer zurückbringen' : 'Wischer holen',
      enabled: true, queued: true, targetId: item.id, target: focus,
    });
  } else if (item.kind === 'STORAGE') {
    actions.push({ id: 'GET_DRINKS', label: 'Getränke holen', enabled: true, targetId: item.id, target: focus });
    actions.push({ id: 'GET_PARTS', label: 'Ersatzteile holen', enabled: true, targetId: item.id, target: focus });
  } else if (item.kind === 'EXCHANGE' || item.kind === 'DESK') {
    actions.push({ id: 'SERVE_DESK', label: 'Kasse bedienen', enabled: true, targetId: item.id, target: focus });
  } else if (item.kind === 'DECOR' && /spiegel|mirror/i.test(item.label)) {
    actions.push({ id: 'SPIEGEL', label: 'Spiegel', enabled: true, targetId: item.id, target: focus });
  }

  return actions;
}

function buildCrateActions(world: ActionView, crate: { id: number }): MenuAction[] {
  const handsFree = world.player.carrying === '';
  return [{
    id: 'PICKUP_CRATE',
    label: 'Kiste aufheben',
    enabled: handsFree,
    targetId: crate.id,
    target: target('crate', crate.id),
    reason: handsFree ? undefined : 'Deine Hände sind voll.',
  }];
}

/** Dieselbe Karte fuer jeden Eingabepfad: Floor-Klick, Tastatur oder Touch. */
export function buildActions(view: GameView, focus: InteractionTarget): MenuAction[] {
  if (focus.kind === 'guest') {
    const guest = view.guests.find((entry) => entry.id === focus.id);
    return guest ? buildGuestActions(view, guest) : [];
  }
  if (focus.kind === 'furniture') {
    const item = view.furniture.find((entry) => entry.id === focus.id);
    return item ? buildFurnitureActions(view, item) : [];
  }
  if (focus.kind === 'crate') {
    const crate = view.crates.find((entry) => entry.id === focus.id && entry.carriedBy === null);
    return crate ? buildCrateActions(view, crate) : [];
  }
  if (focus.kind === 'mop') {
    const mop = view.mops.find((entry) => entry.id === focus.id && entry.carriedBy === null);
    return mop ? buildMopActions(view, mop) : [];
  }
  const stain = view.stains.find((entry) => entry.id === focus.id);
  return stain ? buildStainActions(view, stain) : [];
}
