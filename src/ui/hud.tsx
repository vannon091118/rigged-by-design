/** HUD: Hauskonto, Gäste und die drei Dinge, die jetzt zählen – in Klartext. */
import type { GameView } from '../store/types';
import { vc } from './format';
import { HELP } from './glossary';

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
  readonly onHelp: () => void;
}

const PENALTY_LABEL = (kind: string): string =>
  kind === 'UNSAFE_REPUTATION' ? 'Unsicherer Ruf' : kind === 'MOOD_SHOCK' ? 'Stimmungsschock' : 'Ausgeraubt';

const MOOD_LABEL = (mood: number): string => (mood >= 65 ? 'gut' : mood >= 40 ? 'gemischt' : 'gereizt');

export function Hud({
  view, onBuild, onGuests, onVisit, onClean, onOverview, onJournal, onDiagnostics, onLook, onSkill, onHelp,
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

      <div className="hud-money" title={HELP.hauskonto}>
        <span>HAUSKONTO</span>
        <strong>{vc(view.house, view.house < 1000 * 10_000 ? 2 : 0)}</strong>
        <small>
          <span className="term" title={HELP.portemonnaie}>Portemonnaie {vc(view.wallet, 2)}</span>
          <span className="term" title={HELP.kasse}> · Wechselkasse {vc(view.desk, 2)}</span>
        </small>
      </div>

      <div className="hud-vitals">
        <div className={`vital${view.pending > 0 ? ' hot' : ''}`} title={HELP.offen}>
          <span>OFFENE GEWINNE</span>
          <strong>{vc(view.pending, 2)}</strong>
          <small>{view.pending > 0 ? 'im Gäste-Fenster auszahlen' : 'nichts offen'}</small>
        </div>
        <div className="vital guests" title="Wie viele Gäste gerade im Haus sind. Der Zulauf folgt Ruf, Zufriedenheit, Stammgästen, Anziehung und Unternehmensstufe; Sitzplätze sind keine Obergrenze.">
          <span>GÄSTE</span>
          <strong>{view.guests.length}</strong>
          <small>
            {view.demand.event
              ? `${view.demand.event.label} läuft`
              : view.guests.length ? `~${Math.round(view.demand.perDay)} Gäste/Tag · Laune ${MOOD_LABEL(mood)}` : `~${Math.round(view.demand.perDay)} Gäste/Tag`}
          </small>
        </div>
        <div className={`vital rep${dirty > 0 ? ' warn' : ''}`} title={HELP.ruf}>
          <span>RUF</span>
          <strong>{view.reputation}<em>%</em></strong>
          <small>{dirty > 0 ? `${dirty} Flecken drücken den Ruf` : 'sauber'}</small>
        </div>
        <div className={`vital${bar && bar.stock === 0 ? ' warn' : ''}`} title={HELP.bar}>
          <span>BAR</span>
          <strong>{bar ? bar.stock : 0}<em>/{6 + 6 * view.barLevel}</em></strong>
          <small>{bar ? (bar.stock === 0 ? 'leer – Laune sinkt' : `${view.parts} Ersatzteile im Lager`) : 'keine Bar'}</small>
        </div>
        {(view.crates.length > 0 || view.disputes.length > 0) && (
          <div className={`vital${view.disputes.length > 0 ? ' hot' : ''}`} title="Kisten warten am Eingang, Streit muss geschlichtet werden.">
            <span>KISTEN / STREIT</span>
            <strong>{view.crates.length}<em> / </em>{view.disputes.length}</strong>
            <small>{view.disputes.length > 0 ? 'Streit eskaliert' : 'Ware abholen'}</small>
          </div>
        )}
      </div>

      <div className="hud-actions">
        <button type="button" className="btn primary" onClick={onBuild} title="Spiele, Deko, Personal und Preise">BAUEN</button>
        <button type="button" className={`btn${view.pending > 0 ? ' alert' : ''}`} onClick={onGuests} title="Budget, Laune, Geduld und Sucht jedes Gastes">
          GÄSTE{view.pending > 0 ? <b className="badge">{view.guests.filter((g) => (view.guestMoney[g.id]?.pending ?? 0) > 0).length}</b> : null}
        </button>
        <button type="button" className="btn" onClick={onVisit} title="Bei anderen Betreibern spielen – dein Portemonnaie ist dort Gast.">FREMDES CASINO</button>
        <button type="button" className={`btn${dirty > 0 ? ' warm' : ''}`} onClick={onClean} disabled={dirty === 0 || view.house < view.prices.cleaningCost * dirty} title={dirty > 0 ? `Alles putzen für ${vc(view.prices.cleaningCost * dirty, 2)}` : 'Alles sauber'}>
          PUTZEN{dirty > 0 ? <b className="badge">{dirty}</b> : null}
        </button>
        <button type="button" className="btn ghost" onClick={onOverview} title="Kamera auf das ganze Haus ziehen">ÜBERSICHT</button>
        <button type="button" className="btn ghost" onClick={onJournal} title="Jede Buchung mit Ursache und Folge lesen">PROTOKOLL</button>
        <button type="button" className="btn ghost" onClick={onDiagnostics} title="Buchhaltung, Personal und Lager prüfen">PRÜFUNG</button>
        <button type="button" className="btn ghost" onClick={onLook} title="Aussehen deiner Spielfigur ändern">CHARAKTER</button>
        <button type="button" className="btn ghost help-btn" onClick={onHelp} aria-label="Hilfe: Spiel erklärt" title="Spiel erklärt: Geld, Gäste, Objekte, Steuerung">?</button>
      </div>

      <div className="hud-rpg">
        <span>LV {rpg.level}</span>
        <small>XP {rpg.xp}/{rpg.level * 100}</small>
        {rpg.unspentPoints > 0 && (
          <>
            <button type="button" className="btn warm" onClick={() => onSkill('speed')} title="Schneller laufen">SPEED {rpg.speedLevel}</button>
            <button type="button" className="btn warm" onClick={() => onSkill('charisma')} title="Bessere Chance beim Beschwatzen">CHARISMA {rpg.charismaLevel}</button>
            <button type="button" className="btn warm" onClick={() => onSkill('brawl')} title="Bessere Chance im Handgemenge">KAMPF {rpg.brawlLevel}</button>
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
          <span>Öffne ? für Geld, Gäste und Steuerung.</span>
        </div>
      )}
    </header>
  );
}
