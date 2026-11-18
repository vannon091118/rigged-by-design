/** Charaktereditor: reine Kosmetik, sofort im Save und auf dem Floor sichtbar. */
import type { ReactElement } from 'react';
import {
  LOOK_ACCESSORIES, LOOK_HAIRS, LOOK_HEADS, LOOK_OUTFITS, LOOK_SKINS,
  type LookAccessory, type LookHead, type PlayerLook,
} from '../core/sim/player-look';
import manifest from '../render/assets/manifest.json';
import { LOOK_HAIR_RECTS } from '../render/guest-head';
import { headTextureForFamily } from '../render/guest-parts';
import type { PropertyId } from '../core/sim/types';
import type { GameView } from '../store/types';
import { CareerSection } from './career-section';
import { PopupShell } from './popup-shell';

interface Props {
  readonly view: GameView;
  readonly onClose: () => void;
  readonly onLook: (patch: Partial<PlayerLook>) => void;
  /** Herausforderung des naechsten Hinterhof-Gegners; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onChallenge?: () => void;
  /** Kauf der ersten Immobilie; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onBuyProperty?: (id: PropertyId) => void;
  /** Naechste Renovierungsstufe; ohne Handler bleibt der Knopf wirkungslos. */
  readonly onRenovate?: () => void;
  /** Wartung eines Automaten der eigenen Flaeche. */
  readonly onMaintain?: (itemId: number) => void;
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

const HEAD_LABELS: Readonly<Record<LookHead, string>> = {
  'head-01': 'Rund', 'head-02': 'Kappe', 'head-03': 'Bob',
};

/** Haarton-Rechtecke aus derselben Tabelle wie die Pixi-Figur. */
const hairRects = (head: LookHead, hair: string): ReactElement[] =>
  LOOK_HAIR_RECTS[head].map(([x, y, w, h], index) => (
    <i
      key={index}
      className="look-hair-tone"
      style={{
        left: `${((x + 7) / 14) * 100}%`, top: `${((y + 7) / 14) * 100}%`,
        width: `${(w / 14) * 100}%`, height: `${(h / 14) * 100}%`,
        background: hair,
      }}
    />
  ));

function LookPreview({ look }: { look: PlayerLook }) {
  const headArt = `${manifest.base}${headTextureForFamily(look.head)}`;
  return (
    <div className="look-preview" role="img" aria-label={`Vorschau deiner Spielfigur mit ${HEAD_LABELS[look.head]}kopf`}>
      <div className="look-shadow" />
      <div className="look-leg left" />
      <div className="look-leg right" />
      <div className="look-body" style={{ background: look.outfit }}>
        {look.accessory === 'CHAIN' && <i className="look-chain" />}
      </div>
      <div className="look-arm left" style={{ background: look.outfit }} />
      <div className="look-arm right" style={{ background: look.outfit }} />
      <div className="look-head">
        <img className="look-head-art" src={headArt} alt="" draggable={false} />
        <span
          className="look-hair-layer"
          style={{ maskImage: `url(${headArt})`, WebkitMaskImage: `url(${headArt})` }}
        >
          {hairRects(look.head, look.hair)}
        </span>
        {look.accessory === 'GLASSES' && <i className="look-glasses" />}
        {look.accessory === 'CAP' && <i className="look-cap" style={{ background: look.outfit }} />}
      </div>
    </div>
  );
}

export function LookPopup({ view, onClose, onLook, onChallenge, onBuyProperty, onRenovate, onMaintain }: Props) {
  return (
    <PopupShell eyebrow="DEIN CHARAKTER" title="Werte und Aussehen" onClose={onClose}>
      <div className="look-layout">
        <LookPreview look={view.look} />
        <div className="look-controls">
          <p className="hint">Optik bleibt Optik. Deine Werte darunter kommen aus dem Spielzustand.</p>
          <Swatches label="Haut" colors={LOOK_SKINS} active={view.look.skin} onPick={(skin) => onLook({ skin })} />
          <div className="look-row">
            <span>Kopf</span>
            <div className="look-options">
              {LOOK_HEADS.map((head) => (
                <button
                  key={head}
                  type="button"
                  className={`btn small${view.look.head === head ? ' primary' : ' ghost'}`}
                  aria-pressed={view.look.head === head}
                  onClick={() => onLook({ head })}
                >
                  {HEAD_LABELS[head]}
                </button>
              ))}
            </div>
          </div>
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
      <CareerSection view={view} onChallenge={onChallenge} onBuyProperty={onBuyProperty} onRenovate={onRenovate} onMaintain={onMaintain} />
    </PopupShell>
  );
}
