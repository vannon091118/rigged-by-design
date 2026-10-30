/** Risiko-Karte nach einem Gewinn: eine Farbe, 50/50, gebucht in doppelter Buchfuehrung. */
import type { Ledger } from '../economy/ledger';
import { ZERO_VC, type VaCoinMicro } from '../economy/vacoin';
import type { Prng } from '../rng/prng';
import { foreignWin } from '../sim/money';

export type RiskColor = 'ROT' | 'SCHWARZ';

export interface RiskOutcome {
  readonly card: RiskColor;
  readonly choice: RiskColor;
  readonly won: boolean;
  readonly stake: VaCoinMicro;
  /** 2x Einsatz bei Treffer, sonst 0. */
  readonly payout: VaCoinMicro;
}

const PORTEMONNAIE = 'PORTEMONNAIE';
const EXTERNAL_WORLD = 'EXTERNAL_WORLD';

/** Eine Karte, zwei Farben, keine Serie: der Zug ist ein einzelner fairer Wurf. */
export function drawRiskCard(prng: Prng): RiskColor {
  return prng.nextFloat() < 0.5 ? 'ROT' : 'SCHWARZ';
}

/**
 * Setzt den gerade gewonnenen Betrag erneut aufs Spiel.
 * Treffer zahlt das fremde Haus aus, Fehlschlag bucht den Betrag dorthin zurueck.
 */
export function gambleRivalWin(
  ledger: Ledger,
  stake: VaCoinMicro,
  choice: RiskColor,
  prng: Prng,
  tick: number,
): RiskOutcome {
  if (stake <= ZERO_VC) throw new Error('Kein Gewinn zum Riskieren.');
  if (ledger.getBalance(PORTEMONNAIE) < stake) throw new Error('Der Gewinn liegt nicht mehr im Portemonnaie.');
  const card = drawRiskCard(prng);
  const won = card === choice;
  if (won) foreignWin(ledger, stake, tick);
  else ledger.transfer(PORTEMONNAIE, EXTERNAL_WORLD, stake, 'risiko-karte verloren', tick);
  return { card, choice, won, stake, payout: won ? ((stake * 2) as VaCoinMicro) : ZERO_VC };
}
