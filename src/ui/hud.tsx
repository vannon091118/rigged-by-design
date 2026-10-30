/** HUD: ein Blick auf Hauskonto, Gäste und die drei Dinge, die jetzt zählen. */
import type { GameView } from '../store/types';
import { vc } from './format';

interface HudProps {
  readonly view: GameView;
  readonly onBuild: () => void;
  readonly onGuests: () => void;
  readonly onVisit: () => void;
  readonly onClean: () => void;
  readonly onOverview: () => void;
  readonly onJournal: () => void;
  readonly onDiagnostics: () => void;
  readonly onLook: () => void;
  readonly onSkill: (attribute: 'speed' | 'charisma' | 'brawl') => void;
}

const PENALTY_LABEL = (kind: string): string =>
  kind === 'UNSAFE_REPUTATION' ? 'Unsicherer Ruf' : kind === 'MOOD_SHOCK' ? 'Stimmungsschock' : 'Ausgeraubt';

const MOOD_LABEL = (mood: number): string => (mood >= 65 ? 'gut' : mood >= 40 ? 'gemischt' : 'gereizt');

export function Hud({
  view, onBuild, onGuests, onVisit, onClean, onOverview, onJournal, onDiagnostics, onLook, onSkill,
}: HudProps) {
  const rpg = view.player.rpg;
  const dirty = view.dirtyTiles.size;
  const startTip = view.house === 0 && view.guests.length === 0;
  const mood = view.guests.length ? view.mood : 0;
  const bar = view.furniture.find((item) => item.kind === 'BAR');
  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="hud-mark">R</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>DEIN CASINO · TAG {view.day}</small>
        </div>
      </div>

      <div className="hud-money">
        <span>HAUSKONTO</span>
        <strong>{vc(view.house, view.house < 1000 * 10_000 ? 2 : 0)}</strong>
        <small>
          Portemonnaie {vc(view.wallet, 2)} · Kasse {vc(view.desk, 2)}
        </small>
      </div>

      <div className="hud-vitals">
        <div className={`vital${view.pending > 0 ? ' hot' : ''}`}>
          <span>OFFEN</span>
          <strong>{vc(view.pending, 2)}</strong>
          <small>{view.pending > 0 ? 'Gastgewinne warten' : 'nichts offen'}</small>
        </div>
        <div className="vital">
          <span>GÄSTE</span>
          <strong>{view.guests.length}<em>/{view.capacity}</em></strong>
          <small>{view.guests.length ? `Laune ${MOOD_LABEL(mood)}` : 'noch leer'}</small>
        </div>
        <div className={`vital${dirty > 0 ? ' warn' : ''}`} title="Ruf: Zustand, Sauberkeit und Angebot bestimmen den Zulauf.">
          <span>RUF</span>
          <strong>{view.reputation}<em>%</em></strong>
          <small>{dirty > 0 ? `${dirty} Flecken` : 'sauber'}</small>
        </div>
        <div className={`vital${bar && bar.stock === 0 ? ' warn' : ''}`} title="Bar-Bestand: leere Bar kostet Laune.">
          <span>BAR</span>
          <strong>{bar ? bar.stock : 0}<em>/{6 + 6 * view.barLevel}</em></strong>
          <small>{bar ? (bar.stock === 0 ? 'leer – Laune sinkt' : `${view.parts} Teile im Lager`) : 'keine Bar'}</small>
        </div>
        {(view.crates.length > 0 || view.disputes.length > 0) && (
          <div className={`vital${view.disputes.length > 0 ? ' hot' : ''}`}>
            <span>FLOOR</span>
            <strong>{view.crates.length}<em>K</em> · {view.disputes.length}<em>S</em></strong>
            <small>{view.parts} Teile · Tag {view.day}</small>
          </div>
        )}
      </div>

      <div className="hud-actions">
        <button type="button" className="btn primary" onClick={onBuild}>BAUEN</button>
        <button type="button" className={`btn${view.pending > 0 ? ' alert' : ''}`} onClick={onGuests}>
          GÄSTE{view.pending > 0 ? <b className="badge">{view.guests.filter((g) => (view.guestMoney[g.id]?.pending ?? 0) > 0).length}</b> : null}
        </button>
        <button type="button" className="btn" onClick={onVisit}>FREMDES HAUS</button>
        <button type="button" className={`btn${dirty > 0 ? ' warm' : ''}`} onClick={onClean} disabled={dirty === 0 || view.house < view.prices.cleaningCost * dirty} title={dirty > 0 ? `Reinigung: ${vc(view.prices.cleaningCost * dirty, 2)}` : 'Alles sauber'}>
          PUTZEN{dirty > 0 ? <b className="badge">{dirty}</b> : null}
        </button>
        <button type="button" className="btn ghost" onClick={onOverview} title="Alle 30×30-Bereiche auf einen Blick">ÜBERSICHT</button>
        <button type="button" className="btn ghost" onClick={onJournal} title="Was ist passiert, warum, und was folgt daraus?">PROTOKOLL</button>
        <button type="button" className="btn ghost" onClick={onDiagnostics} title="Ledger, Personal und Lager prüfen">DIAGNOSE</button>
        <button type="button" className="btn ghost" onClick={onLook} title="Charakter-Editor öffnen">CHARAKTER</button>
      </div>

      <div className="hud-rpg">
        <span>LV {rpg.level}</span>
        <small>XP {rpg.xp}/{rpg.level * 100}</small>
        {rpg.unspentPoints > 0 && (
          <>
            <button type="button" className="btn warm" onClick={() => onSkill('speed')}>SPEED {rpg.speedLevel}</button>
            <button type="button" className="btn warm" onClick={() => onSkill('charisma')}>CHARISMA {rpg.charismaLevel}</button>
            <button type="button" className="btn warm" onClick={() => onSkill('brawl')}>KAMPF {rpg.brawlLevel}</button>
          </>
        )}
      </div>

      {!view.ledgerOk && (
        <div className="hud-penalty" role="alert">
          Ledger-Prüfung fehlgeschlagen · Buchungen blockiert · Diagnose öffnen
        </div>
      )}

      {view.activePenalties.map((penalty) => (
        <div key={penalty.kind} className="hud-penalty" role="status">
          {PENALTY_LABEL(penalty.kind)} · noch {penalty.daysLeft} Tag(e)
        </div>
      ))}

      {startTip && (
        <div className="hud-tip">
          <span>0 VC. Dein Automat steht gratis.</span>
          <span>Gäste kommen zum Eingang, wechseln an der Kasse und spielen.</span>
        </div>
      )}
    </header>
  );
}
