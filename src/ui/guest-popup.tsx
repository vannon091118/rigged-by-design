/** Ein Klick auf einen Gast: Sticker, Budget und drei Werte mit klarer Folge statt Tabellen. */
import { useEffect, useState } from 'react';
import { dirtyNear, EMOTION_META, emotionOf } from '../core/sim/emotion';
import type { GameView } from '../store/types';
import { STATE_LABEL, vc } from './format';
import { HELP } from './glossary';
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
  const disputeId = guest?.disputeId ?? null;
  const duel = disputeId === null ? undefined : view.duels[disputeId];
  // Ein Security vor Ort uebernimmt den Streit – dann greift der Spieler nicht mit.
  const guardHolding = disputeId !== null && view.disputeGuard[disputeId] === true;
  const talkWait = guest ? view.talkReady[guest.id] ?? 0 : 0;
  return (
    <PopupShell eyebrow="LIVE AM FLOOR" title="Gäste" onClose={onClose} wide>
      <div className="cashier-strip">
        <div title={HELP.kasse}><span>WECHSELKASSE</span><strong>{vc(view.desk, 2)}</strong></div>
        <div title={HELP.offen}><span>OFFENE GEWINNE</span><strong>{vc(view.pending, 2)}</strong></div>
        <p>Geld wartet an der Wechselkasse. Ein Klick auf eine Figur zeigt Budget, Laune, Geduld und Sucht.</p>
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
            <div className="guest-budget-big" title="Chips in der Hand, offene Gewinne und noch nicht gewechseltes Bargeld.">
              <span>BUDGET</span>
              <strong>{vc(money.wallet + money.pending + money.fiat, 2)}</strong>
              <small>
                {money.pending > 0 ? `${vc(money.pending, 2)} Gewinn – auszahlbar`
                  : money.fiat > 0 ? `${vc(money.fiat, 2)} Bargeld – noch nicht gewechselt`
                    : 'nur Chips'}
              </small>
            </div>
          </div>
          <div className="guest-bars">
            <Bar label="LAUNE" value={guest.mood} tone="mood" hint={HELP.laune} />
            <Bar label="GEDULD" value={guest.patience} tone="patience" hint={HELP.geduld} />
            <Bar label="SUCHT" value={guest.addiction} tone="addiction" hint={HELP.sucht} />
          </div>
          <p className="hint">Laune unter 40: gereizt · Geduld 0: Gast geht · Sucht hoch: bleibt länger, verliert mehr.</p>
          {guest.intent && (
            <p className="guest-intent"><b>Warum:</b> {guest.intent}</p>
          )}
          <div className="guest-actions">
            {view.player.carrying === 'DRINK' && (
              <button type="button" className="btn small" onClick={() => onServe(guest.id)} title="Gibt den getragenen Drink aus. Hebt Laune und Geduld.">DRINK GEBEN</button>
            )}
            {money.pending > 0 && (
              <button type="button" className="btn primary small" onClick={() => onPay(guest.id)} title="Bucht den Gewinn in Chips um – erst danach spielt der Gast weiter.">AUSZAHLEN</button>
            )}
            <button type="button" className="btn small" onClick={() => onTalk(guest.id)} disabled={talkWait > 0}
              title={talkWait > 0
                ? `Noch ${Math.ceil(talkWait * 0.52)} s gesperrt. Erfolg: +25 Laune, +20 Geduld; Fehlschlag kann Streit auslösen.`
                : 'Erfolg: +25 Laune, +20 Geduld. Fehlschlag: beides sinkt und kann Streit auslösen. Danach rund 30 Sekunden Pause.'}>
              {talkWait > 0 ? `BESCHWATZEN · ${Math.ceil(talkWait * 0.52)} s` : `BESCHWATZEN · ${view.talkChances[guest.id] ?? 0} % Erfolg`}
            </button>
            {guest.disputeId !== null && (
              <button type="button" className="btn small" onClick={() => onCalm(guest.disputeId!)}
                disabled={guardHolding}
                title={guardHolding
                  ? 'Ein Security steht am Streit und bearbeitet ihn bereits – gleichzeitig darf niemand eingreifen.'
                  : 'Beendet den Streit friedlich. Du musst dafür selbst am Streit stehen.'}>
                SCHLICHTEN
              </button>
            )}
            {duel && disputeId !== null && (
              <button type="button" className="btn small alert" onClick={() => onFight(disputeId)}
                disabled={!duel.inRange || guardHolding}
                title={guardHolding
                  ? 'Der Security bearbeitet diesen Streit gerade. Sobald er fertig ist, kannst du eingreifen.'
                  : !duel.inRange
                    ? 'Du stehst zu weit weg vom Streit. Geh erst hin, dann kannst du fordern.'
                    : `Duell gegen ${duel.opponent.name} (${duel.opponent.archetype}). Du kämpfst mit ${duel.player.hp} von ${duel.player.maxHp} Lebenspunkten. Bei einer Niederlage drohen Verletzung, ein Überfall auf Kasse oder Brieftasche, ein Launenschock und bei eskaliertem Streit Rufschaden.`}>
                {guardHolding ? 'SECURITY VOR ORT ·' : duel.inRange ? 'DUELL GEGEN' : 'ZU WEIT WEG ·'} {duel.opponent.name.split(' ')[0]!.toUpperCase()} · {duel.winChance} %
              </button>
            )}
            {duel && (
              <span className="hint">
                Gegner: {duel.opponent.archetype} · Kraft {duel.opponent.strength}/10 · Zähigkeit {duel.opponent.toughness}/10 · LP {duel.opponentHp}
                {' '}· Du {duel.player.hp}/{duel.player.maxHp} LP{duel.player.injured ? ' · verletzt' : ''}
                {guardHolding ? ' · Security bearbeitet den Streit' : ''}
              </span>
            )}
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

function Bar({ label, value, tone, hint }: { label: string; value: number; tone: string; hint: string }) {
  return (
    <div className="stat-bar" title={hint}>
      <span>{label}</span>
      <div className="track"><i className={`fill ${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}
