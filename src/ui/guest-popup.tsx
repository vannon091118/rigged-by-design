/** Ein Klick auf einen Gast: Sticker, Chips-Budget und drei Bauchgefühle statt Tabellen. */
import { useEffect, useState } from 'react';
import { dirtyNear, EMOTION_META, emotionOf } from '../core/sim/emotion';
import type { GameView } from '../store/types';
import { STATE_LABEL, vc } from './format';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly selectedId: number | null;
  readonly onClose: () => void;
  readonly onPay: (id: number) => void;
  readonly onServe: (id: number) => void;
  readonly onCalm: (disputeId: number) => void;
  readonly onTalk: (guestId: number) => void;
  readonly onFight: (disputeId: number) => void;
}

const PERSONA_LABEL: Record<string, string> = {
  LUMPEN: 'Lumpen', STREET: 'Straßentyp', BUSINESS: 'Business', HIGH_ROLLER: 'High Roller', STAMMGAST: 'Stammgast',
};

export function GuestPopup({ view, selectedId, onClose, onPay, onServe, onCalm, onTalk, onFight }: Props) {
  const guests = [...view.guests].sort((a, b) => b.id - a.id);
  const [activeId, setActiveId] = useState(selectedId ?? guests[0]?.id ?? 0);
  useEffect(() => { if (selectedId !== null) setActiveId(selectedId); }, [selectedId]);
  const guest = guests.find((entry) => entry.id === activeId) ?? guests[0];
  const spotted = guest ? dirtyNear(view.dirtyTiles, view.size, guest.position.x, guest.position.y) : false;
  const emotion = guest ? emotionOf(guest, spotted) : 'NONE';
  const meta = EMOTION_META[emotion];
  const stateLabel = guest ? STATE_LABEL[guest.state] ?? guest.state : '';
  const money = guest ? view.guestMoney[guest.id] ?? { wallet: 0, pending: 0, fiat: 0 } : { wallet: 0, pending: 0, fiat: 0 };
  return (
    <PopupShell eyebrow="LIVE AM FLOOR" title="Gäste" onClose={onClose} wide>
      <div className="cashier-strip">
        <div><span>WECHSELKASSE</span><strong>{vc(view.desk, 2)}</strong></div>
        <div><span>OFFENE GEWINNE</span><strong>{vc(view.pending, 2)}</strong></div>
        <p>Geld wartet an der Kasse. Ein Klick auf eine Figur zeigt sofort ihr Budget.</p>
      </div>
      {!guest ? (
        <p className="empty">Noch niemand da. Angebot und Ordnung entscheiden, wie schnell Gäste kommen.</p>
      ) : (
        <>
          <div className="guest-focus">
            <div className={`guest-sticker ${meta.tone}`} title={meta.label}>{meta.glyph}</div>
            <div className="guest-identity">
              <strong>{guest.name}</strong>
              <span className={`persona persona-${guest.persona}`}>{PERSONA_LABEL[guest.persona] ?? guest.persona}</span>
              <small>{stateLabel}{meta.label !== stateLabel ? ` · ${meta.label}` : ''}</small>
            </div>
            <div className="guest-budget-big">
              <span>BUDGET</span>
              <strong>{vc(money.wallet + money.pending + money.fiat, 2)}</strong>
              <small>{money.pending > 0 ? `${vc(money.pending, 2)} Gewinn wartet` : money.fiat > 0 ? `${vc(money.fiat, 2)} Fiat` : 'in Chips'}</small>
            </div>
          </div>
          <div className="guest-bars">
            <Bar label="LAUNE" value={guest.mood} tone="mood" />
            <Bar label="GEDULD" value={guest.patience} tone="patience" />
            <Bar label="SUCHT" value={guest.addiction} tone="addiction" />
          </div>
          {guest.intent && (
            <p className="guest-intent"><b>Warum:</b> {guest.intent}</p>
          )}
          <div className="guest-actions">
            {view.player.carrying === 'DRINK' && <button type="button" className="btn small" onClick={() => onServe(guest.id)}>DRINK GEBEN</button>}
            {money.pending > 0 && <button type="button" className="btn primary small" onClick={() => onPay(guest.id)}>AUSZAHLEN</button>}
            <button type="button" className="btn small" onClick={() => onTalk(guest.id)}>CHARISMA: BESCHWATZEN (Erfolg {view.talkChances[guest.id] ?? 0} %)</button>
            {guest.disputeId !== null && <button type="button" className="btn small" onClick={() => onCalm(guest.disputeId!)}>SCHLICHTEN</button>}
            {guest.disputeId !== null && !view.staff.guard && <button type="button" className="btn small alert" onClick={() => onFight(guest.disputeId!)}>SELBER KÄMPFEN ({view.brawlChance} %)</button>}
          </div>
          <div className="guest-chips">
            {guests.map((entry) => {
              const entryMoney = view.guestMoney[entry.id] ?? { wallet: 0, pending: 0, fiat: 0 };
              const entryMeta = EMOTION_META[emotionOf(entry, dirtyNear(view.dirtyTiles, view.size, entry.position.x, entry.position.y))];
              return (
                <button key={entry.id} type="button" className={`guest-chip${entry.id === guest.id ? ' active' : ''}`} onClick={() => setActiveId(entry.id)}>
                  <b>{entryMeta.glyph}</b>
                  <span>{entry.name.split(' ')[0]}</span>
                  <small>{vc(entryMoney.wallet + entryMoney.pending + entryMoney.fiat, 1)}</small>
                </button>
              );
            })}
          </div>
        </>
      )}
    </PopupShell>
  );
}

function Bar({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="stat-bar" title={label}>
      <span>{label}</span>
      <div className="track"><i className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
    </div>
  );
}
