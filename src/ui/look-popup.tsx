/** Charaktereditor: reine Kosmetik, sofort im Save und auf dem Floor sichtbar. */
import {
  LOOK_ACCESSORIES, LOOK_HAIRS, LOOK_OUTFITS, LOOK_SKINS,
  type LookAccessory, type PlayerLook,
} from '../core/sim/player-look';
import { hpNotice } from '../core/sim/player-career';
import type { GameView } from '../store/types';
import { CareerBackyard } from './career-backyard';
import { CareerHistory } from './career-history';
import { vc } from './format';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onLook: (patch: Partial<PlayerLook>) => void;
  /** Herausforderung des naechsten Hinterhof-Gegners; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onChallenge?: () => void;
}

function Swatches(props: {
  label: string; colors: readonly string[]; active: string; onPick: (color: string) => void;
}) {
  return (
    <div className="look-row">
      <span>{props.label}</span>
      <div className="look-swatches">
        {props.colors.map((color) => (
          <button
            key={color}
            type="button"
            className={`look-swatch${props.active === color ? ' active' : ''}`}
            style={{ background: color }}
            aria-label={`${props.label} ${color}`}
            aria-pressed={props.active === color}
            onClick={() => props.onPick(color)}
          />
        ))}
      </div>
    </div>
  );
}

function LookPreview({ look }: { look: PlayerLook }) {
  return (
    <div className="look-preview" role="img" aria-label="Vorschau deiner Spielfigur">
      <div className="look-shadow" />
      <div className="look-leg left" />
      <div className="look-leg right" />
      <div className="look-body" style={{ background: look.outfit }}>
        {look.accessory === 'CHAIN' && <i className="look-chain" />}
      </div>
      <div className="look-arm left" style={{ background: look.outfit }} />
      <div className="look-arm right" style={{ background: look.outfit }} />
      <div className="look-head" style={{ background: look.skin }}>
        <i className="look-eye left" />
        <i className="look-eye right" />
        {look.accessory === 'GLASSES' && <i className="look-glasses" />}
        {look.accessory === 'CAP' && <i className="look-cap" style={{ background: look.outfit }} />}
        <i className="look-hair" style={{ background: look.hair }} />
      </div>
    </div>
  );
}

function CareerSection({ view, onChallenge }: { view: GameView; onChallenge?: () => void }) {
  const career = view.career;
  return (
    <section className="career" aria-label="Deine Werte">
      <div className="career-head">
        <strong>LEVEL {career.level}</strong>
        <span>{career.xp} / {career.xp + career.xpToNext} XP</span>
        <span>{career.unspentPoints > 0 ? `${career.unspentPoints} Punkte offen` : 'keine Punkte offen'}</span>
      </div>
      <p className={`career-hp${career.injured ? ' warn' : ''}`}>{hpNotice(career)}</p>
      <ul className="career-attributes">
        {career.attributes.map((attribute) => (
          <li key={attribute.id}>
            <span>{attribute.label}</span>
            <b>{attribute.level}</b>
            <small>{attribute.effect}</small>
          </li>
        ))}
      </ul>
      <div className="career-grid">
        <div><span>Portemonnaie</span><b>{vc(career.wallet, 2)}</b></div>
        <div><span>Bonus</span><b>{vc(career.playerCash, 2)}</b></div>
        <div><span>Bilanz</span><b>{career.record.wins} S · {career.record.losses} N · {career.record.kos} KO</b></div>
        <div>
          <span>Arbeit</span>
          <b>{career.job ? `${career.job.label} · ${career.job.workDays} Schichten` : 'kein Job'}</b>
        </div>
        <div>
          <span>Lohn</span>
          <b>{career.job ? `${career.job.wageVC} VC/Tag · letzte Schicht ${career.job.lastWorkDay > 0 ? `Tag ${career.job.lastWorkDay}` : 'offen'}` : 'keine Schicht'}</b>
        </div>
      </div>
      <ul className="career-achievements">
        {career.achievements.map((entry) => (
          <li key={entry.id} className={entry.unlocked ? 'on' : 'off'}>{entry.label}</li>
        ))}
      </ul>
      <CareerHistory history={career.history} />
      <CareerBackyard backyard={career.backyard} onChallenge={onChallenge} />
    </section>
  );
}

export function LookPopup({ view, onClose, onLook, onChallenge }: Props) {
  return (
    <PopupShell eyebrow="DEIN CHARAKTER" title="Werte und Aussehen" onClose={onClose}>
      <div className="look-layout">
        <LookPreview look={view.look} />
        <div className="look-controls">
          <p className="hint">Nur Optik. Kein Einfluss auf Geld, Geduld oder Spielausgang.</p>
          <Swatches label="Haut" colors={LOOK_SKINS} active={view.look.skin} onPick={(skin) => onLook({ skin })} />
          <Swatches label="Haare" colors={LOOK_HAIRS} active={view.look.hair} onPick={(hair) => onLook({ hair })} />
          <Swatches label="Outfit" colors={LOOK_OUTFITS} active={view.look.outfit} onPick={(outfit) => onLook({ outfit })} />
          <div className="look-row">
            <span>Accessoire</span>
            <div className="look-options">
              {LOOK_ACCESSORIES.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`btn small${view.look.accessory === entry.id ? ' primary' : ' ghost'}`}
                  aria-pressed={view.look.accessory === entry.id}
                  onClick={() => onLook({ accessory: entry.id as LookAccessory })}
                >
                  {entry.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <CareerSection view={view} onChallenge={onChallenge} />
    </PopupShell>
  );
}
