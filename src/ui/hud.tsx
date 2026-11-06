/** HUD: Marke, Geld und drei Kennzahlen. Der Werkzeugkasten lebt im Dock. */
import { barCapacityForLevel } from '../core/sim/deliveries';
import { HAUSKONTO } from '../core/sim/money';
import type { RpgAttribute } from '../core/sim/player-rpg';
import type { GameView } from '../store/types';
import { vc } from './format';
import { ACCOUNT_LABEL, HELP } from './glossary';
import { UI_ICON } from './icons';

interface HudProps {
  readonly view: GameView;
  readonly onSkill: (attribute: RpgAttribute) => void;
}

const PENALTY_LABEL = (kind: string): string =>
  kind === 'UNSAFE_REPUTATION' ? 'Unsicherer Ruf' : kind === 'MOOD_SHOCK' ? 'Stimmungsschock' : 'Ausgeraubt';

const MOOD_LABEL = (mood: number): string => (mood >= 65 ? 'gut' : mood >= 40 ? 'gemischt' : 'gereizt');

/** Ruf als Farbe und Wort: eine Prozentzahl sagt niemandem etwas. */
const reputationOf = (value: number): { readonly label: string; readonly tone: string } =>
  value >= 70 ? { label: 'angesehen', tone: 'ok' }
    : value >= 40 ? { label: 'solide', tone: '' }
      : { label: 'ramponiert', tone: 'warn' };

const SKILLS: readonly (readonly [RpgAttribute, string, string])[] = [
  ['speed', 'SPD', 'Speed: mehr Pfadschritte pro Tick, bessere Queue-Position.'],
  ['charisma', 'CHA', 'Charisma: bessere Talk-Chance, mehr Trinkgeld.'],
  ['brawl', 'BRW', 'Brawl: mehr HP, mehr Kampfschaden.'],
  ['perception', 'PER', 'Wahrnehmung: bessere Queue-Position, Dreck früher sehen.'],
  ['technique', 'TEC', 'Technik: schnellere Reparatur, bessere Mods.'],
  ['endurance', 'END', 'Ausdauer: schnellere Regeneration, kürzere Verletzungen.'],
  ['luck', 'LCK', 'Glück: RNG-Bias bei Spielen, höhere Jackpot-Chance.'],
];

export function Hud({ view, onSkill }: HudProps) {
  const rpg = view.player.rpg;
  const dirty = view.dirtyTiles.size;
  const bar = view.furniture.find((item) => item.kind === 'BAR');
  const barCapacity = barCapacityForLevel(view.barLevel);
  const reputation = reputationOf(view.reputation);
  const startTip = view.house === 0 && view.guests.length === 0;
  const mood = view.guests.length ? view.mood : 0;
  return (
    <header className="hud">
      <div className="hud-brand">
        <span className="hud-mark">R</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>DEIN FLOOR · TAG {view.day}</small>
        </div>
      </div>

      <div className="hud-money" title={HELP.hauskonto}>
        <span><img className="ui-icon" src={UI_ICON.coin} alt="" />{ACCOUNT_LABEL[HAUSKONTO]}</span>
        <strong>{vc(view.house, view.house < 1000 * 10_000 ? 2 : 0)}</strong>
        <small>
          <span className="term" title={HELP.portemonnaie}>Portemonnaie {vc(view.wallet, 2)}</span>
          <span className="term" title={HELP.kasse}> · Kasse {vc(view.desk, 2)}</span>
        </small>
        {!view.barPurchased && (
          <span className="hud-goal" title={`Bargeld bis zum Barkauf: ${vc(view.wallet, 2)} von 50,00`}>
            <i style={{ width: `${Math.min(100, (view.wallet / 10_000) / 50 * 100)}%` }} />
          </span>
        )}
      </div>

      <div className="hud-vitals">
        <div className="vital guests" title="Wie viele Gäste gerade im Haus sind. Der Zulauf folgt Ruf, Zufriedenheit, Stammgästen, Anziehung und Unternehmensstufe.">
          <span><img className="ui-icon" src={UI_ICON.guests} alt="" />GÄSTE</span>
          <strong>{view.guests.length}</strong>
          <small>
            {view.demand.event
              ? `${view.demand.event.label} läuft`
              : view.guests.length ? `~${Math.round(view.demand.perDay)}/Tag · Laune ${MOOD_LABEL(mood)}` : `~${Math.round(view.demand.perDay)}/Tag`}
          </small>
        </div>
        <div className={`vital rep ${reputation.tone}`} title={`${HELP.ruf} · ${view.reputation} %`}>
          <span>RUF</span>
          <strong><i className="rep-dot" aria-hidden="true" />{reputation.label}</strong>
          <small>{dirty > 0 ? `${dirty} Flecken drücken den Ruf` : 'sauber'}</small>
        </div>
      </div>

      {!view.ledgerOk && (
        <p className="hud-penalty" role="alert">Ledger-Prüfung fehlgeschlagen · Buchungen blockiert · Werkstatt öffnen</p>
      )}
      {bar && bar.stock < barCapacity / 3 && (
        <p className="hud-penalty warn" role="status">
          {bar.stock === 0 ? 'Bar leer' : 'Bar fast leer'} · {bar.stock}/{barCapacity}
          {bar.stock === 0 ? ' · Gäste verlieren Laune' : ' · bald keine Drinks'}
        </p>
      )}
      {view.activePenalties.map((penalty) => (
        <p key={penalty.kind} className="hud-penalty" role="status">
          {PENALTY_LABEL(penalty.kind)} · noch {penalty.daysLeft} Tag(e)
        </p>
      ))}

      {rpg.unspentPoints > 0 && (
        <div className="hud-skills">
          <span>LV {rpg.level} · {rpg.unspentPoints} Punkte</span>
          {SKILLS.map(([attribute, label, hint]) => (
            <button key={attribute} type="button" className="btn tiny warm" title={hint} onClick={() => onSkill(attribute)}>
              {label}+
            </button>
          ))}
        </div>
      )}

      {startTip && (
        <p className="hud-tip">
          0 VC. Dein Automat steht gratis – Gäste wechseln an der Kasse und spielen. Alles Weitere liegt im Dock.
        </p>
      )}
    </header>
  );
}
