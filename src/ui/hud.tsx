/** HUD: Marke, eine sichtbare Perspektive und nur die Zahlen, die zu ihr gehören. */
import { barCapacityForLevel } from '../core/sim/deliveries';
import type { RpgAttribute } from '../core/sim/player-rpg';
import type { GameView } from '../store/types';
import type { Perspective } from './app-model';
import { vc } from './format';
import { HELP } from './glossary';
import { startGoal } from './goal';
import { HudMoney } from './hud-money';
import { MOOD_LABEL, PENALTY_LABEL, reputationOf, SKILLS } from './hud-labels';
import { UI_ICON } from './icons';
import { PerspectiveSwitch } from './perspective-switch';

/** Erster-Tag-Hinweis: derselbe Platz im HUD, aber der Text folgt dem Ort. */
const SCENE_TIP: Record<GameView['scene']['kind'], string> = {
  APARTMENT: 'Du bist zu Hause. Die Haustür führt auf die Straße.',
  CITY: 'Du stehst auf der Straße. Dein Casino ist gleich um die Ecke.',
  OWN: 'Der Abend beginnt. Öffne BETRIEB für dein Angebot – Gäste kommen, sobald das Haus sie anzieht.',
  FOREIGN: 'Fremder Floor. Sieh dich um, aber es ist nicht dein Haus.',
  INTERIOR: 'Du bist drinnen. Die Tür führt zurück auf die Straße.',
};

interface HudProps {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onPerspective: (next: Perspective) => void;
  readonly onSkill: (attribute: RpgAttribute) => void;
  /** Versteckter Werkstatt-Einstieg: fuenf Tipps auf die Marke. */
  readonly onBrandTap?: (timeStamp: number) => void;
  /** Die Gästezahl ist der Welt-Einstieg in die Übersicht, kein Dock-Tab. */
  readonly onGuests: () => void;
}

export function Hud({ view, perspective, onPerspective, onSkill, onBrandTap, onGuests }: HudProps) {
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
  // Am ersten Abend führt der Tipp zum Gerät: ohne Automaten kommt kein Gast (S1-06).
  const ownTip = machines.length > 0
    ? SCENE_TIP.OWN
    : 'Die Starter-Kiste wartet am Eingang: anklicken, dann eine freie Fläche. Erst mit einem Automaten kommt der erste Gast.';
  const sceneTip = view.day === 1 && view.onboarding.step !== 'DONE'
    ? (view.scene.kind === 'OWN' ? ownTip : SCENE_TIP[view.scene.kind])
    : null;
  const mood = view.guests.length ? view.mood : 0;
  const pact = view.exclusionPact ? `Pakt ${vc(view.exclusionPact.limit, 0)}` : 'kein Pakt';
  const goal = startGoal(view);
  const amount = vc(guest ? view.wallet : view.house, guest || view.house < 1000 * 10_000 ? 2 : 0);
  return (
<header className={`hud ${perspective}`}>
      <div className="hud-brand" onClick={(event) => onBrandTap?.(event.timeStamp)}>
        <span className="hud-mark">R</span>
        <div>
          <strong>RIGGED BY DESIGN</strong>
          <small title={guest ? undefined : `Stufe: ${view.company.note}`}>
            {guest ? 'GASTANSICHT' : view.company.name}
            <span className="hud-brand-sep" aria-hidden="true">·</span>
            <span className="hud-day">TAG {view.day}</span>
          </small>
        </div>
      </div>

      <PerspectiveSwitch perspective={perspective} onChange={onPerspective} />

      <HudMoney
        guest={guest}
        amount={amount}
        desk={vc(view.desk, 2)}
        pending={vc(view.pending, 2)}
        pact={pact}
        goal={goal}
      />

      <div className="hud-vitals">
        <button
          type="button"
          className="vital guests"
          onClick={onGuests}
          aria-label="Gästeübersicht öffnen"
          title="Wie viele Gäste gerade im Haus sind. Klick öffnet die Gästeliste; der Zulauf folgt Ruf, Zufriedenheit, Stammgästen, Anziehung und Unternehmensstufe."
        >
          <span><img className="ui-icon" src={UI_ICON.guests} alt="" />GÄSTE</span>
          <strong>{view.guests.length}</strong>
          <small>
            {guest && waiting > 0
              ? `${waiting} offene Gewinne`
              : view.demand.event
                ? `${view.demand.event.label} läuft`
                : view.guests.length ? `~${Math.round(view.demand.perDay)}/Tag · Laune ${MOOD_LABEL(mood)}` : `~${Math.round(view.demand.perDay)}/Tag`}
          </small>
        </button>
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

      {!guest && sceneTip && (
        <p className="hud-tip">{sceneTip}</p>
      )}
    </header>
  );
}
