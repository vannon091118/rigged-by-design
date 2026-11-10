/** Fremdes Haus: Kopfzeile, Betreiberprofil und Geraetebuehne als eigene Zustaendigkeit. */
import type { GameResult } from '../core/games/contracts';
import { HOUSE_FLOAT } from '../core/sim/money';
import { rivalStates, type RivalId } from '../core/sim/rivals';
import { vc } from './format';
import { attractionBand, houseEdgeText } from './glossary';
import { UI_ICON } from './icons';

type RivalState = ReturnType<typeof rivalStates>[number];

const personaLabel = (id: string): string =>
  id === 'HIGH_ROLLER' ? 'High Roller' : id === 'STAMMGAST' ? 'Stammgast'
    : id.charAt(0) + id.slice(1).toLowerCase();

interface VenueTopProps {
  readonly states: readonly RivalState[];
  readonly rivalId: RivalId;
  readonly onSelect: (id: RivalId) => void;
  readonly wallet: number;
  readonly house: number;
  readonly full: boolean;
  readonly onTakeHome: () => void;
  readonly onToggleFull: () => void;
}

/** Hauswahl und Portemonnaie: der erste Blick im fremden Haus. */
export function VenueTop({ states, rivalId, onSelect, wallet, house, full, onTakeHome, onToggleFull }: VenueTopProps) {
  return (
    <div className="foreign-top">
      <div className="house-tabs">
        {states.map((entry) => (
          <button
            key={entry.id}
            type="button"
            className={`house-tab${entry.id === rivalId ? ' active' : ''}`}
            onClick={() => onSelect(entry.id)}
          >
            <strong>{entry.name}</strong>
            <span>Ruf {entry.reputation} % · Sicherheit {entry.security}/5 · ab {vc(entry.machines[0]!.baseBet, 2)}</span>
          </button>
        ))}
      </div>
      <div className="foreign-wallet" title="Dein privates Bargeld. Es gehört nicht dem Casino.">
        <span><img className="ui-icon" src={UI_ICON.coin} alt="" />PORTEMONNAIE</span>
        <strong>{vc(wallet, 2)}</strong>
        <button type="button" className="btn small" onClick={onTakeHome} disabled={house <= HOUSE_FLOAT} title="Holt bis zu 5 VC vom Hauskonto. 5 VC bleiben als Betriebsreserve.">ABHEBEN</button>
        <button type="button" className="btn small ghost" onClick={onToggleFull}>{full ? 'FENSTER' : 'VOLLBILD'}</button>
      </div>
    </div>
  );
}

/** Betreiberprofil: wer hier haushaltet und zu welchem Preis. */
export function RivalProfile({ rival }: { readonly rival: RivalState }) {
  return (
    <>
      <section className="rival-profile" aria-label={`Profil ${rival.name}`}>
        <div>
          <span className="eyebrow">BETREIBER</span>
          <strong>{rival.operator}</strong>
          <p>{rival.style}</p>
        </div>
        <dl>
          <div title="Wie angesehen das Haus ist. Hoher Ruf zieht bessere Gäste an."><dt>Ruf</dt><dd>{rival.reputation} %</dd></div>
          <div title="Security schlichtet Streit – hier zahlst du dafür, nicht der Betreiber."><dt>Sicherheit</dt><dd>{rival.security}/5</dd></div>
          <div title="Anteil jedes Einsatzes, der im Schnitt beim Betreiber bleibt."><dt>Hausvorteil</dt><dd>{(rival.edgeBps / 100).toFixed(2)} %</dd></div>
          <div title={`Rohwert ${rival.attractiveness}`}><dt>Anziehung</dt><dd>{attractionBand(rival.attractiveness)}</dd></div>
        </dl>
      </section>
      <p className="hint">
        {houseEdgeText(rival.edgeBps)} Er gehört dem Betreiber – dein Portemonnaie ist hier Gast.
        Dieses Haus zieht vor allem {rival.personas.map(personaLabel).join(', ')} an.
      </p>
    </>
  );
}

interface TableStageProps {
  readonly machine: RivalState['machines'][number];
  readonly spinning: boolean;
  readonly result: GameResult | null;
  readonly bets: readonly number[];
  readonly betVC: number;
  readonly cannotPay: boolean;
  readonly full: boolean;
  readonly onBet: (value: number) => void;
  readonly onPlay: () => void;
}

/** Spiele ohne eigene Buehne: ein gemeinsames Geraetebild mit Einsatzchips. */
export function TableStage({ machine, spinning, result, bets, betVC, cannotPay, full, onBet, onPlay }: TableStageProps) {
  return (
    <div className={`table-stage${full ? ' full' : ''}`} data-game={machine.game}>
      <div className={`game-screen${spinning ? ' spinning' : ''}`}>
        <div className="screen-title">{machine.label}</div>
        <div className="screen-result">
          {result ? result.detail.slice(0, 5).map((part, index) => <span key={index} className="screen-symbol">{part}</span>)
            : <span className="screen-symbol muted">BEREIT</span>}
        </div>
        <div className={`screen-label${result && result.payout > 0 ? ' win' : ''}`}>
          {spinning ? 'Das Rad dreht…' : result ? `${result.label}${result.payout > 0 ? ` · ${vc(result.payout, 2)}` : ''}` : 'Setze einen Einsatz und drücke SPIELEN.'}
        </div>
      </div>
      <div className="table-controls">
        <div className="bet-row">
          {bets.map((value) => (
            <button key={value} type="button" className={`chip${betVC === value ? ' active' : ''}`} onClick={() => onBet(value)}>{value} VC</button>
          ))}
        </div>
        <button type="button" className="btn primary big" disabled={spinning || cannotPay} onClick={onPlay}>
          {cannotPay ? 'ZU WENIG BARGELD' : spinning ? 'SPIELT…' : `SPIELEN · ${betVC} VC`}
        </button>
        <small>
          Gewinne gehen zurück ins Portemonnaie, Verluste bleiben im fremden Haus.
          {cannotPay ? ' Hebe am Hauskonto ab, um weiterzuspielen.' : ` Mindesteinsatz ${vc(machine.baseBet, 2)}.`}
        </small>
      </div>
    </div>
  );
}
