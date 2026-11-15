/** App-Verdrahtung: Navigation, Floor-Aktionen und Kisten ohne eigenen Zustand. */
import type { BuildId } from '../core/sim/offers';
import type { MenuAction, MenuActionId } from '../render/floor-actions';
import type { ScreenAnchor } from '../render/floor-hit';
import { handleFloorInteract, unhandledMenuActionError } from '../render/floor-interact';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Perspective, Popup } from './app-model';

interface AppSetters {
  readonly setPopup: (popup: Popup) => void;
  readonly setPopupAnchor: (anchor: ScreenAnchor | null) => void;
  readonly setBuildOpen: (open: boolean) => void;
  readonly setPerspective: (next: Perspective) => void;
}

/** Ein Popup loest den Bau-Schalter und den alten Anker: sonst bleibt ein Geist stehen. */
export function openPopupWith(setters: AppSetters, next: Popup): void {
  setters.setBuildOpen(false);
  setters.setPopupAnchor(null);
  setters.setPopup(next);
}

/** Perspektivwechsel raeumt jede offene Ebene ab, bevor der Leser wechselt. */
export function switchPerspective(setters: AppSetters, current: Perspective, next: Perspective): void {
  if (next === current) return;
  setters.setPopup(null);
  setters.setPopupAnchor(null);
  setters.setBuildOpen(false);
  setters.setPerspective(next);
}

/** Was eine Route zum Ausfuehren braucht; kein zweiter Zustand, nur die UI-Haken. */
interface ActionContext {
  readonly open: (popup: Popup) => void;
  readonly anchorAt: (anchor: ScreenAnchor | null) => void;
  readonly at: ScreenAnchor | null;
}

type ActionRoute = (action: MenuAction, ctx: ActionContext) => void;

/** Der Welt-Command-Pfad bleibt in `floor-interact`; die Registry nennt ihn nur. */
const worldCommand: ActionRoute = (action) => handleFloorInteract(action);

/**
 * Genau eine Route pro MenuAction-ID aus `MENU_ACTION_IDS` (#771). Popup-Ziele
 * und Welt-Commands stehen in derselben Tabelle, damit das Oeffnen eines
 * Kontextmenues nicht mehr zwischen zwei Dateien verteilt ist. Ein neuer
 * Contract-Eintrag ohne Route bricht den Typecheck.
 */
const MENU_ACTION_ROUTES: Readonly<Record<MenuActionId, ActionRoute>> = {
  ENTER_DOOR: enterDoor,
  OPEN_MACHINE: (action, ctx) => {
    if (action.targetId === undefined) return;
    ctx.open({ kind: 'machine', itemId: action.targetId });
    ctx.anchorAt(ctx.at);
  },
  OPEN_GUEST: (action, ctx) => {
    if (action.targetId !== undefined) ctx.open({ kind: 'guests', guestId: action.targetId });
  },
  CITY_MEET: cityMeet,
  SPIEGEL: (_action, ctx) => ctx.open({ kind: 'look' }),
  MOVE_HERE: worldCommand, CLEAN_STAIN: worldCommand, CLEAN_ROOM: worldCommand,
  PICKUP_MOP: worldCommand, TALK: worldCommand, CALM: worldCommand, FIGHT: worldCommand,
  SERVE_DRINK: worldCommand, TAKE_DRINK: worldCommand, GET_MOP: worldCommand,
  DROP_MOP: worldCommand, GET_DRINKS: worldCommand, GET_PARTS: worldCommand,
  SERVE_DESK: worldCommand, DRINK_AT_HOME: worldCommand, EAT_AT_HOME: worldCommand,
  PICKUP_CRATE: worldCommand, FOREIGN_SIT: worldCommand, FOREIGN_LOOK: worldCommand,
  FOREIGN_TALK: worldCommand,
};

function enterDoor(action: MenuAction, ctx: ActionContext): void {
  if (action.doorId && worldStore.scene.enterStreetDoor(action.doorId) === 'CITY') ctx.open({ kind: 'city' });
}

function cityMeet(action: MenuAction, ctx: ActionContext): void {
  // Die sichtbare Stadtfigur oeffnet dieselbe Begegnung wie die Liste;
  // kein Casino-Gast-Command und keine zweite soziale Wahrheit.
  if (!action.npcId) return;
  worldStore.city({ kind: 'meet', npcId: action.npcId });
  ctx.open({ kind: 'city' });
}

const MENU_ACTION_ROUTE_IDS: ReadonlySet<string> = new Set(Object.keys(MENU_ACTION_ROUTES));

export function hasMenuActionRoute(id: string): id is MenuActionId {
  return MENU_ACTION_ROUTE_IDS.has(id);
}

/** Fail-closed: eine ID ohne Route wirft, statt still zu verpuffen. */
export function executeMenuAction(action: MenuAction, ctx: ActionContext): void {
  if (!hasMenuActionRoute(action.id)) throw unhandledMenuActionError(action.id);
  MENU_ACTION_ROUTES[action.id](action, ctx);
}

/** Ein Pfad fuer alle Eingaenge: Ziel waehlen, laufen, in Reichweite handeln. */
export function makeActionExecutor(
  open: (popup: Popup) => void,
  anchorAt: (anchor: ScreenAnchor | null) => void,
): (action: MenuAction, at: ScreenAnchor | null) => void {
  return (action, at) => executeMenuAction(action, { open, anchorAt, at });
}

export function isCarryingCrate(carrying: string): boolean {
  return carrying.startsWith('KRATE:');
}

/** Der Geist zeigt nur Moebel; andere Kisten haben kein Platzierbild. */
export function crateGhostId(carrying: string, crates: GameView['crates']): BuildId | null {
  const match = /^KRATE:(\d+)$/.exec(carrying);
  const crate = match ? crates.find((entry) => entry.id === Number(match[1])) : undefined;
  return crate && crate.payload.kind === 'FURNITURE' ? crate.payload.buildId : null;
}

/** Editor aus der URL nehmen, damit ein Reload ihn nicht wieder oeffnet. */
export function closeEditorUrl(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('editor');
  window.history.replaceState(null, '', url);
}
