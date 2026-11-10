/**
 * NPC-Dialog am Objekt: die Auswahl nennt vorhandene Commands, die Wirkung
 * entsteht im Store. Es gibt keinen zweiten Gastzustand in React.
 */
import type { ScreenAnchor } from '../render/floor-hit';
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import { TICK_S } from '../core/sim/tick-timing';
import { PopupShell } from './popup-shell';
import type { AnchorProjector } from './use-world-anchor';

interface Props {
  readonly view: GameView;
  readonly guestId: number;
  readonly anchor?: ScreenAnchor | null;
  readonly project?: AnchorProjector;
  readonly onClose: () => void;
}

export function NpcDialogue({ view, guestId, anchor = null, project, onClose }: Props) {
  const guest = view.guests.find((entry) => entry.id === guestId);
  if (!guest) return null;
  const money = view.guestMoney[guest.id] ?? { wallet: 0, pending: 0, fiat: 0 };
  const talkWait = view.talkReady[guest.id] ?? 0;
  const disputeId = guest.disputeId;
  const carryingDrink = view.player.carrying === 'DRINK';

  return (
    <PopupShell
      eyebrow="AM OBJEKT · GESPRÄCH"
      title={guest.name}
      onClose={onClose}
      surface="object"
      anchor={anchor}
      project={project}
      className="npc-dialogue"
    >
      <div className="npc-dialogue-line" role="status" aria-live="polite">
        <span className={`persona persona-${guest.persona}`}>{guest.persona}</span>
        <p>{talkLead(guest.state, guest.mood, guest.patience)}</p>
      </div>
      <div className="npc-dialogue-choices">
        <button
          type="button"
          className="btn primary small"
          disabled={talkWait > 0}
          onClick={() => worldStore.talk(guest.id)}
        >
          {talkWait > 0 ? `ANSPRECHEN · ${Math.ceil(talkWait * TICK_S)} s` : 'FREUNDLICH ANSPRECHEN'}
        </button>
        {carryingDrink && guest.thirst > 0 && (
          <button type="button" className="btn small" onClick={() => worldStore.serveDrink(guest.id)}>
            DRINK GEBEN
          </button>
        )}
        {money.pending > 0 && (
          <button type="button" className="btn small" onClick={() => worldStore.pay(guest.id)}>
            AUSZAHLEN
          </button>
        )}
        {disputeId !== null && (
          <button
            type="button"
            className="btn small"
            disabled={view.disputeGuard[disputeId] === true}
            onClick={() => worldStore.calm(disputeId)}
          >
            STREIT SCHLICHTEN
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={onClose}>ZURÜCK</button>
      </div>
      <p className="hint">{view.lastEvent}</p>
    </PopupShell>
  );
}

function talkLead(state: string, mood: number, patience: number): string {
  if (patience < 25) return 'Der Gast schaut zur Tür. Viel Zeit bleibt nicht.';
  if (state === 'ANGRY') return 'Die Stimme ist zu laut für ein gutes Gespräch.';
  if (mood > 70) return 'Der Gast lacht und hat offenbar einen guten Abend.';
  if (state === 'PLAY') return 'Zwischen zwei Spielen ist Platz für ein paar Sätze.';
  return 'Der Gast nickt. Ein ruhiger Ton öffnet mehr als ein weiterer Automat.';
}
