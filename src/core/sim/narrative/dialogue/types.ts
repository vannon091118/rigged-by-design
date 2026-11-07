/**
 * Dialog: Datenvertrag der Dialogfuehrung.
 *
 * Ein Dialog ist reine Darstellung: Knoten, Sprecher und Direktlinks. Keine
 * Wirkung, kein Wurf, kein Zufall – wer etwas veraendern will, geht ueber die
 * Commands der Szene. Die Links zeigen nur auf vorhandene Menues.
 */

/** Grenzen halten Skripte lesbar; ein laengerer Dialog wird geteilt, nicht gestreckt. */
export const DIALOGUE_LIMITS = { nodes: 24, links: 4 } as const;

/** Ziele, die die UI wirklich oeffnen kann; alles andere ist ein Autorenfehler. */
type DialogueLinkTarget = 'NEXT' | 'CLOSE' | 'GAMES' | 'STAFF' | 'JOURNAL';

export interface DialogueLink {
  readonly id: string;
  readonly label: string;
  readonly target: DialogueLinkTarget;
}

export interface DialogueNode {
  readonly id: string;
  readonly speaker: string;
  readonly line: string;
  readonly next: string | null;
  readonly links: readonly DialogueLink[];
}

export interface DialogueScript {
  readonly id: string;
  readonly title: string;
  readonly start: string;
  readonly nodes: readonly DialogueNode[];
}
