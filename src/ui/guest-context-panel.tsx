/** Objektpanel Gast: Eigenschaften und Handlungen am NPC, ohne die Welt zu verlassen. */
import { dirtyNear, EMOTION_META, emotionOf } from '../core/sim/emotion';
import { TICK_S } from '../core/sim/tick-timing';
import type { GameView } from '../store/types';
import type { ScreenAnchor } from '../render/floor-hit';
import { STATE_LABEL, vc } from './format';
import { PopupShell } from './popup-shell';
import type { AnchorProjector } from './use-world-anchor';

interface Props {
  readonly view: GameView;
  readonly guestId: number;
  readonly anchor?: ScreenAnchor | null;
  readonly project?: AnchorProjector;
  readonly onClose: () => void;
  readonly onOpenOverview: (id: number) => void;
  readonly onPay: (id: number) => void;
  readonly onServe: (id: number) => void;
  readonly onCalm: (disputeId: number) => void;
  readonly onTalk: (guestId: number) => void;
  readonly onFight: (disputeId: number) => void;
  readonly onProfile: (visitorId: number) => void;
}

const PERSONA_LABEL: Record<string, string> = {
  LUMPEN: 'Lumpen', STREET: 'Straßentyp', BUSINESS: 'Business', HIGH_ROLLER: 'High Roller', STAMMGAST: 'Stammgast',
};

/** Eine Zeile, drei Werte: das Panel zeigt nur, was die naechste Handlung traegt. */
function Meter({ label, value }: { readonly label: string; readonly value: number }) {
  return (
    <div className="stat-bar" title={label}>
      <span>{label}</span>
      <div className="track"><i className="fill mood" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}

export function GuestContextPanel({
  view, guestId, anchor = null, project, onClose, onOpenOverview,
  onPay, onServe, onCalm, onTalk, onFight, onProfile,
}: Props) {
  const guest = view.guests.find((entry) => entry.id === guestId);
  if (!guest) return null;

  const spotted = dirtyNear(view.dirtyTiles, view.size, guest.position.x, guest.position.y);
  const meta = EMOTION_META[emotionOf(guest, spotted)];
  const money = view.guestMoney[guest.id] ?? { wallet: 0, pending: 0, fiat: 0 };
  const talkWait = view.talkReady[guest.id] ?? 0;
  const disputeId = guest.disputeId;
  const duel = disputeId === null ? undefined : view.duels[disputeId];
  const guardHolding = disputeId !== null && view.disputeGuard[disputeId] === true;

  return (
    <PopupShell
      eyebrow="AM OBJEKT · GAST"
      title={guest.name}
      onClose={onClose}
      surface="object"
      anchor={anchor}
      project={project}
      className="guest-context-panel"
    >
      <div className="guest-focus">
        <div className={`guest-sticker ${meta.tone}`} title={meta.label}>{meta.glyph}</div>
        <div className="guest-identity">
          <strong>{guest.name}</strong>
          <span className={`persona persona-${guest.persona}`}>{PERSONA_LABEL[guest.persona] ?? guest.persona}</span>
          <small>{STATE_LABEL[guest.state] ?? guest.state} · {meta.label}</small>
        </div>
        <div className="guest-budget-big" title="Chips, offene Gewinne und noch nicht gewechseltes Bargeld.">
          <span>BUDGET</span>
          <strong>{vc(money.wallet + money.pending + money.fiat, 2)}</strong>
          <small>{money.pending > 0 ? `${vc(money.pending, 2)} auszahlbar` : money.fiat > 0 ? `${vc(money.fiat, 2)} Bargeld` : 'nur Chips'}</small>
        </div>
      </div>

      <div className="guest-bars">
        <Meter label="LAUNE" value={guest.mood} />
        <Meter label="GEDULD" value={guest.patience} />
        <Meter label="SUCHT" value={guest.addiction} />
      </div>

      <div className="guest-actions">
        <button type="button" className="btn primary small" onClick={() => onTalk(guest.id)} disabled={talkWait > 0}
          title={talkWait > 0 ? `Noch ${Math.ceil(talkWait * TICK_S)} s gesperrt.` : 'Erfolg hebt Laune und Geduld; ein Fehlschlag kann Streit auslösen.'}>
          {talkWait > 0 ? `REDEN · ${Math.ceil(talkWait * TICK_S)} s` : `REDEN · ${view.talkChances[guest.id] ?? 0} %`}
        </button>
        {view.player.carrying === 'DRINK' && (
          <button type="button" className="btn small" onClick={() => onServe(guest.id)}>DRINK GEBEN</button>
        )}
        {money.pending > 0 && (
          <button type="button" className="btn small" onClick={() => onPay(guest.id)}>AUSZAHLEN</button>
        )}
        {guest.visitorId !== undefined && (
          <button type="button" className="btn small" onClick={() => onProfile(guest.visitorId!)}>PROFIL</button>
        )}
        {disputeId !== null && (
          <button type="button" className="btn small" onClick={() => onCalm(disputeId)} disabled={guardHolding}
            title={guardHolding ? 'Ein Security bearbeitet den Streit bereits.' : 'Beendet den Streit friedlich.'}>
            SCHLICHTEN
          </button>
        )}
        {duel && disputeId !== null && (
          <button type="button" className="btn small alert" onClick={() => onFight(disputeId)}
            disabled={!duel.inRange || guardHolding}
            title={!duel.inRange ? 'Du stehst zu weit weg.' : `Duell gegen ${duel.opponent.name} · ${duel.winChance} %`}>
            DUELL · {duel.opponent.name.split(' ')[0]!.toUpperCase()}
          </button>
        )}
        <button type="button" className="btn ghost small" onClick={() => onOpenOverview(guest.id)}>
          ALLE OPTIONEN
        </button>
      </div>
    </PopupShell>
  );
}
