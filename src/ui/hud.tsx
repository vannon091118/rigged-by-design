/** HUD: Marke, eine sichtbare Perspektive und nur die Zahlen, die zu ihr gehören. */
import { barCapacityForLevel } from '../core/sim/deliveries';
import { HAUSKONTO } from '../core/sim/money';
import type { RpgAttribute } from '../core/sim/player-rpg';
import type { GameView } from '../store/types';
import type { Perspective } from './app-model';
import { vc } from './format';
import { ACCOUNT_LABEL, HELP } from './glossary';
import { UI_ICON } from './icons';
import { PerspectiveSwitch } from './perspective-switch';

interface HudProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onPerspective: (next: Perspective) => void;
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

export function Hud({ view, perspective, onPerspective, onSkill }: HudProps) {
  const guest = perspective === 'guest';
  const rpg = view.player.rpg;
  const dirty = view.dirtyTiles.size;
  const bar = view.furniture.find((item) => item.kind === 'BAR');
  const barCapacity = barCapacityForLevel(view.barLevel);
  const reputation = reputationOf(view.reputation);
  const machines = view.furniture.filter((item) => item.gameId);
  const broken = machines.filter((item) => item.damaged || item.condition < 85 || item.clogged).length;
  const occupied = machines.reduce((sum, item) => sum + item.occupants.length, 0);
  const waiting = view.guests.filter((entry) => (view.guestMoney[entry.id]?.pending ?? 0) > 0).length;
  const startTip = view.house === 0 && view.guests.length === 0;
  const mood = view.guests.length ? view.mood : 0;
  const pact = view.exclusionPact ? `Pakt ${vc(view.exclusionPact.limit, 0)}` : 'kein Pakt';
  return (
    <header className={`hud ${perspective}`}>
      <div className="hud-brand">
        <span className="hud-mark">R</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small>{guest ? 'GASTANSICHT' : 'BETRIEBSLEITUNG'} · TAG {view.day}</small>
        </div>
      </div>

      <PerspectiveSwitch perspective={perspective} onChange={onPerspective} />

      <div className={`hud-money ${perspective}`} title={guest ? HELP.portemonnaie : HELP.hauskonto}>
        <span><img className="ui-icon" src={UI_ICON.coin} alt="" />{guest ? 'PORTEMONNAIE' : ACCOUNT_LABEL[HAUSKONTO]}</span>
        <strong>{vc(guest ? view.wallet : view.house, guest || view.house < 1000 * 10_000 ? 2 : 0)}</strong>
        <small>
          {guest ? (
            <>
              <span className="term" title={HELP.offen}>Offen {vc(view.pending, 2)}</span>
              <span> · {pact}</span>
            </>
          ) : (
            <>
              <span className="term" title={HELP.kasse}>Kasse {vc(view.desk, 2)}</span>
              <span className="term" title={HELP.offen}> · Offen {vc(view.pending, 2)}</span>
            </>
          )}
        </small>
        {!guest && !view.barPurchased && (
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
            {guest && waiting > 0
              ? `${waiting} offene Gewinne`
              : view.demand.event
                ? `${view.demand.event.label} läuft`
                : view.guests.length ? `~${Math.round(view.demand.perDay)}/Tag · Laune ${MOOD_LABEL(mood)}` : `~${Math.round(view.demand.perDay)}/Tag`}
          </small>
        </div>
        {guest ? (
          <div className="vital games" title="Alle bespielbaren Geräte auf diesem Floor. Ein Klick öffnet die passende Spielbühne.">
            <span>SPIELE</span>
            <strong>{machines.length}</strong>
            <small>{view.seats} {view.seats === 1 ? 'Platz' : 'Plätze'} · {broken > 0 ? `${broken} in Wartung` : 'alle bereit'}</small>
          </div>
        ) : (
          <>
            <div className={`vital devices${broken > 0 ? ' warn' : ''}`} title="Besetzte Plätze und Geräte, die Pflege brauchen.">
              <span>GERÄTE</span>
              <strong>{occupied}<em>/{view.seats}</em></strong>
              <small>{broken > 0 ? `${broken} brauchen Wartung` : `${machines.length} ${machines.length === 1 ? 'Spiel' : 'Spiele'} · alle heil`}</small>
            </div>
            <div className={`vital rep ${reputation.tone}`} title={`${HELP.ruf} · ${view.reputation} %`}>
              <span>RUF</span>
              <strong><i className="rep-dot" aria-hidden="true" />{reputation.label}</strong>
              <small>{dirty > 0 ? `${dirty} Flecken drücken den Ruf` : 'sauber'}</small>
            </div>
          </>
        )}
      </div>

      {!view.ledgerOk && (
        <p className="hud-penalty" role="alert">
          {guest ? 'Auszahlung gestört · die Buchhaltung prüft' : 'Ledger-Prüfung fehlgeschlagen · Buchungen blockiert · Werkstatt öffnen'}
        </p>
      )}
      {!guest && bar && bar.stock < barCapacity / 3 && (
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

      {!guest && rpg.unspentPoints > 0 && (
        <div className="hud-skills">
          <span>LV {rpg.level} · {rpg.unspentPoints} Punkte</span>
          {SKILLS.map(([attribute, label, hint]) => (
            <button key={attribute} type="button" className="btn tiny warm" title={hint} onClick={() => onSkill(attribute)}>
              {label}+
            </button>
          ))}
        </div>
      )}

      {!guest && startTip && (
        <p className="hud-tip">
          0 VC. Dein Automat steht gratis – Gäste wechseln an der Kasse und spielen. Alles Weitere liegt im Dock.
        </p>
      )}
    </header>
  );
}
