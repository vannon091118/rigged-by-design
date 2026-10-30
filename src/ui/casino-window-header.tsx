/** Kopfzeile eines Casino-Fensters: Geldtoepfe, verbaute Mods, Pakt und Vollbild. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import { vc } from './format';

interface Props {
  readonly wallet: VaCoinMicro;
  readonly house?: VaCoinMicro;
  readonly mods: readonly string[];
  readonly pact: string;
  readonly full: boolean;
  readonly onToggleFull: () => void;
  readonly onWithdraw?: () => void;
  readonly canWithdraw?: boolean;
}

export function CasinoWindowHeader({ wallet, house, mods, pact, full, onToggleFull, onWithdraw, canWithdraw = false }: Props) {
  return (
    <div className="casino-head">
      <div className="casino-head-stat" title="Dein privates Bargeld. Einsaetze hier gehen davon ab.">
        <span>PORTEMONNAIE</span>
        <strong>{vc(wallet, 2)}</strong>
      </div>
      {house !== undefined && (
        <div className="casino-head-stat" title="Konto des Hauses. Abheben bucht Geld auf dein Portemonnaie.">
          <span>HAUSKONTO</span>
          <strong>{vc(house, 2)}</strong>
        </div>
      )}
      <div className="casino-head-stat" title="Verbaute Mods veraendern Auszahlung, Anziehung und Sucht dieses Geraets.">
        <span>MODS</span>
        <strong>{mods.length ? mods.join(' · ') : 'keine'}</strong>
      </div>
      <div className="casino-head-stat" title="Der Pakt begrenzt deinen Netto-Verlust im fremden Haus.">
        <span>PAKT</span>
        <strong>{pact}</strong>
      </div>
      <div className="casino-head-actions">
        {onWithdraw && (
          <button type="button" className="btn small" onClick={onWithdraw} disabled={!canWithdraw}
            title="Holt Geld vom Hauskonto ins Portemonnaie. 5 VC bleiben als Betriebsreserve.">
            ABHEBEN
          </button>
        )}
        <button type="button" className="btn small ghost" onClick={onToggleFull} title="Fenster oder Vollbild">
          {full ? 'FENSTER' : 'VOLLBILD'}
        </button>
      </div>
    </div>
  );
}
