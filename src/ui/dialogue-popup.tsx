/**
 * Dialog: Comic-Dialog als reine Darstellung.
 *
 * Die Blase zeigt den Lauftext des aktuellen Knotens, die Chips darunter sind
 * Direktlinks in vorhandene Menues. Die UI rechnet nichts: der Ablauf kommt aus
 * `dialogue/select.ts`, Wirkungen entstehen nur ueber Commands.
 */
import { useState } from 'react';
import { dialogueStart, dialogueStep, findDialogueNode } from '../core/sim/narrative/dialogue/select';
import { DIALOGUE_SCRIPTS } from '../core/sim/narrative/dialogue/scripts';
import type { DialogueScript } from '../core/sim/narrative/dialogue/types';
import { PopupShell } from './popup-shell';

interface Props {
  readonly script?: DialogueScript;
  readonly onClose: () => void;
  readonly onOpenGames: () => void;
  readonly onOpenStaff: () => void;
  readonly onOpenJournal: () => void;
}

export function DialoguePopup({
  script = DIALOGUE_SCRIPTS[0]!,
  onClose,
  onOpenGames,
  onOpenStaff,
  onOpenJournal,
}: Props) {
  const [nodeId, setNodeId] = useState(script.start);
  const node = findDialogueNode(script, nodeId) ?? dialogueStart(script);

  if (!node) {
    return (
      <PopupShell eyebrow="DIALOG" title={script.title} onClose={onClose}>
        <p className="empty">Dieser Dialog hat keine gueltige Startseite.</p>
      </PopupShell>
    );
  }

  const follow = (linkId: string): void => {
    const step = dialogueStep(script, node.id, linkId);
    if (!step) return;
    if (step.kind === 'NODE') { setNodeId(step.nodeId); return; }
    if (step.kind === 'CLOSE') { onClose(); return; }
    if (step.menu === 'GAMES') onOpenGames();
    else if (step.menu === 'STAFF') onOpenStaff();
    else onOpenJournal();
  };

  return (
    <PopupShell eyebrow="DIALOG" title={script.title} onClose={onClose} className="dialogue-popup">
      <div className="comic-panel">
        <div className="dialogue-avatar" aria-hidden="true">{node.speaker.slice(0, 2)}</div>
        <div className="dialogue-bubble" role="status" aria-live="polite">
          <span className="dialogue-speaker">{node.speaker}</span>
          <p key={node.id} className="dialogue-run">{node.line}</p>
        </div>
      </div>
      <div className="dialogue-links" role="group" aria-label="Direktlinks">
        {node.links.map((link) => (
          <button key={link.id} type="button" className="btn small" onClick={() => follow(link.id)}>
            {link.label}
          </button>
        ))}
      </div>
      <p className="hint">Direktlinks oeffnen vorhandene Menues; der Dialog selbst entscheidet nichts.</p>
    </PopupShell>
  );
}
