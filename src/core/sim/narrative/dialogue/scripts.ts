/**
 * Dialog: Sicherheitsfassung des ersten Comic-Dialogs.
 *
 * Der Text ist Darstellung, nicht Regel: Er nennt nur, was die UI ohnehin
 * oeffnen kann. Autorencontent darf ihn spaeter ersetzen, ohne die Links zu
 * aendern; Wirkung entsteht weiterhin ausschliesslich ueber Commands.
 */
import type { DialogueScript } from './types';

export const DIALOGUE_SCRIPTS: readonly DialogueScript[] = [
  {
    id: 'rita-am-tresen',
    title: 'Rita am Tresen',
    start: 'hallo',
    nodes: [
      {
        id: 'hallo',
        speaker: 'RITA',
        line: 'Du schon wieder. Der Abend ist noch jung, und ich habe Fragen.',
        next: 'fragen',
        links: [
          { id: 'games', label: 'Spiele', target: 'GAMES' },
          { id: 'staff', label: 'Personal', target: 'STAFF' },
          { id: 'weiter', label: 'Weiter', target: 'NEXT' },
        ],
      },
      {
        id: 'fragen',
        speaker: 'RITA',
        line: 'Wer hier arbeitet, sieht mehr als der Gast am Automaten. Zeig mir, dass du zuhoerst.',
        next: 'abschluss',
        links: [
          { id: 'journal', label: 'Protokoll', target: 'JOURNAL' },
          { id: 'games', label: 'Spiele', target: 'GAMES' },
          { id: 'weiter', label: 'Weiter', target: 'NEXT' },
        ],
      },
      {
        id: 'abschluss',
        speaker: 'RITA',
        line: 'Gut. Der Rest ist deine Entscheidung, nicht meine.',
        next: null,
        links: [
          { id: 'journal', label: 'Protokoll', target: 'JOURNAL' },
          { id: 'ende', label: 'Zurueck auf den Floor', target: 'CLOSE' },
        ],
      },
    ],
  },
];
