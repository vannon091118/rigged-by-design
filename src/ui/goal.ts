/** Das eine sichtbare Ziel des ersten Abends: eine Zahl, ein Balken, kein zweiter Zustand. */
import { fromVC, type VaCoinMicro } from '../core/economy/vacoin';
import type { GameView } from '../store/types';

export interface StartGoal {
  readonly id: 'BAR' | 'RENT';
  /** Kurzlabel am Balken; nie mehr als ein Wort. */
  readonly label: string;
  /** Der ganze Satz fuer Tooltip und Vorleser. */
  readonly text: string;
  readonly current: VaCoinMicro;
  readonly target: VaCoinMicro;
  /** 0..100, ganzzahlig, aus dem Zustand gerechnet. */
  readonly percent: number;
}

const BAR_TARGET = fromVC(50);
const RENT_TARGET = fromVC(500);

function share(current: VaCoinMicro, target: VaCoinMicro): number {
  if (target <= 0) return 100;
  const percent = Math.floor((current / target) * 100);
  return Math.max(0, Math.min(100, percent));
}

/**
 * Ein Ziel zur Zeit: erst der Barkauf, danach die erste Miete. Beide Groessen
 * stehen bereits im Snapshot (Portemonnaie, Hauskonto) - die UI rechnet nichts
 * nach, was der Zustand nicht sagt, und fuehrt keinen eigenen Fortschritt.
 */
export function startGoal(view: Pick<GameView, 'barPurchased' | 'wallet' | 'house'>): StartGoal {
  if (!view.barPurchased) {
    return {
      id: 'BAR',
      label: 'BARKAUF',
      text: 'Ziel: 50 VC Bargeld für die Bar',
      current: view.wallet,
      target: BAR_TARGET,
      percent: share(view.wallet, BAR_TARGET),
    };
  }
  return {
    id: 'RENT',
    label: 'MIETE',
    text: 'Ziel: 500 VC Hausvermögen für die erste Miete',
    current: view.house,
    target: RENT_TARGET,
    percent: share(view.house, RENT_TARGET),
  };
}
