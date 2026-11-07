/**
 * @test-target: src/core/sim/narrative/dialogue/select.ts
 * @error-code: ERR-2001
 *
 * Dialoge sind Daten plus ein reiner Ablauf: gleicher Klick, gleiche Folgeseite.
 * Ein kaputtes Skript wird abgelehnt, statt halb zu spielen.
 */
import { describe, expect, it } from 'vitest';
import { isDialogueScript, dialogueLink, dialogueStart, dialogueStep, findDialogueNode } from '../dialogue/select';
import { DIALOGUE_SCRIPTS } from '../dialogue/scripts';
import type { DialogueScript } from '../dialogue/types';

const script = DIALOGUE_SCRIPTS[0]!;

describe('Dialogfuehrung (Dialog)', () => {
  it('startet auf der deklarierten Seite und findet jeden Knoten genau einmal', () => {
    expect(dialogueStart(script)?.id).toBe('hallo');
    expect(findDialogueNode(script, 'fragen')?.speaker).toBe('RITA');
    expect(dialogueStart({ ...script, start: 'fehlt' })).toBeNull();
  });

  it('folgt NEXT bis zum Ende und bleibt dort stehen', () => {
    const zweite = dialogueStep(script, 'hallo', 'weiter');
    const dritte = dialogueStep(script, 'fragen', 'weiter');

    expect(zweite).toEqual({ kind: 'NODE', nodeId: 'fragen' });
    expect(dritte).toEqual({ kind: 'NODE', nodeId: 'abschluss' });
    expect(dialogueStep(script, 'abschluss', 'weiter')).toBeNull();
  });

  it('uebersetzt Direktlinks in Menueziele und Schliessen', () => {
    expect(dialogueStep(script, 'hallo', 'games')).toEqual({ kind: 'MENU', menu: 'GAMES' });
    expect(dialogueStep(script, 'abschluss', 'journal')).toEqual({ kind: 'MENU', menu: 'JOURNAL' });
    expect(dialogueStep(script, 'abschluss', 'ende')).toEqual({ kind: 'CLOSE' });
    expect(dialogueLink(script, 'hallo', 'staff')?.target).toBe('STAFF');
  });

  it('weist unbekannte Links und gebrochene Skripte ab', () => {
    expect(dialogueStep(script, 'hallo', 'gibtsnicht')).toBeNull();
    expect(dialogueStep(script, 'gibtsnicht', 'weiter')).toBeNull();

    const gebrochen: DialogueScript = {
      ...script,
      nodes: script.nodes.map((node) => (node.id === 'hallo' ? { ...node, next: 'nirgends' } : node)),
    };
    expect(isDialogueScript(script)).toBe(true);
    expect(isDialogueScript(gebrochen)).toBe(false);
  });

  it('haelt die Grenzen fuer Seiten und Links ein', () => {
    const zuLang: DialogueScript = {
      ...script,
      nodes: [...script.nodes, ...script.nodes, ...script.nodes, ...script.nodes, ...script.nodes],
    };

    expect(script.nodes.length).toBeLessThanOrEqual(24);
    expect(script.nodes.every((node) => node.links.length <= 4)).toBe(true);
    expect(isDialogueScript(zuLang)).toBe(false);
  });
});
