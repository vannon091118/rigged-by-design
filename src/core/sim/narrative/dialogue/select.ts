/**
 * Dialog: Reiner Ablauf der Dialogfuehrung. Kein Zufall, keine Zeit, kein Mutieren
 * des Skripts; ein unbekannter Knoten oder Link endet fail-closed in `null`.
 */
import { DIALOGUE_LIMITS, type DialogueLink, type DialogueNode, type DialogueScript } from './types';

type DialogueMenu = 'GAMES' | 'STAFF' | 'JOURNAL';

type DialogueStep =
  | { readonly kind: 'NODE'; readonly nodeId: string }
  | { readonly kind: 'MENU'; readonly menu: DialogueMenu }
  | { readonly kind: 'CLOSE' };

const MENUS: readonly DialogueMenu[] = ['GAMES', 'STAFF', 'JOURNAL'];

export function findDialogueNode(script: DialogueScript, nodeId: string): DialogueNode | null {
  return script.nodes.find((node) => node.id === nodeId) ?? null;
}

/** Startknoten oder `null`: ein Skript ohne gueltigen Start wird nicht gespielt. */
export function dialogueStart(script: DialogueScript): DialogueNode | null {
  return findDialogueNode(script, script.start);
}

export function dialogueLink(script: DialogueScript, nodeId: string, linkId: string): DialogueLink | null {
  const node = findDialogueNode(script, nodeId);
  return node?.links.find((link) => link.id === linkId) ?? null;
}

/**
 * Ein Klick auf einen Direktlink. `NEXT` ohne Folgeseite ist kein Fehler,
 * sondern das Ende: die UI bleibt dann einfach stehen.
 */
export function dialogueStep(script: DialogueScript, nodeId: string, linkId: string): DialogueStep | null {
  const node = findDialogueNode(script, nodeId);
  const link = dialogueLink(script, nodeId, linkId);
  if (!node || !link) return null;
  if (link.target === 'CLOSE') return { kind: 'CLOSE' };
  if (link.target === 'NEXT') return node.next === null ? null : { kind: 'NODE', nodeId: node.next };
  const menu = MENUS.find((entry) => entry === link.target);
  return menu ? { kind: 'MENU', menu } : null;
}

/** Autorenpruefung: eindeutige IDs, aufloesbare Folgeseiten und eingehaltene Grenzen. */
export function isDialogueScript(script: DialogueScript): boolean {
  if (script.nodes.length === 0 || script.nodes.length > DIALOGUE_LIMITS.nodes) return false;
  const ids = new Set(script.nodes.map((node) => node.id));
  if (ids.size !== script.nodes.length || !ids.has(script.start)) return false;
  return script.nodes.every((node) =>
    node.links.length <= DIALOGUE_LIMITS.links &&
    new Set(node.links.map((link) => link.id)).size === node.links.length &&
    (node.next === null || ids.has(node.next)),
  );
}
