/** Das eine sichtbare Ziel des ersten Abends: eine Zahl, ein Balken, kein zweiter Zustand. */
import { fromVC, type VaCoinMicro } from '../core/economy/vacoin';
import { BAR_PURCHASE_COST_VC } from '../core/sim/player-jobs';
import type { CompanyStatus } from '../core/sim/progression';
import { dailyHousingCost } from '../core/sim/upkeep-costs';
import type { GameView } from '../store/types';
import { vc } from './format';

interface StartGoal {
  readonly id: 'DEVICE' | 'BAR' | 'RENT' | 'COMPANY' | 'DONE';
  /** Kurzlabel am Balken; nie mehr als ein Wort. */
  readonly label: string;
  /** Der ganze Satz fuer Tooltip und Vorleser. */
  readonly text: string;
  readonly current?: VaCoinMicro;
  readonly target?: VaCoinMicro;
  /** 0..100, ganzzahlig, aus dem Zustand gerechnet. */
  readonly percent: number;
}

const BAR_TARGET = fromVC(BAR_PURCHASE_COST_VC);

function share(current: VaCoinMicro, target: VaCoinMicro): number {
  if (target <= 0) return 100;
  const percent = Math.floor((current / target) * 100);
  return Math.max(0, Math.min(100, percent));
}

/** Fortschritt ueber die offenen Bedingungen der naechsten Firmenstufe. */
function companyShare(company: CompanyStatus): number {
  if (company.next === null) return 100;
  const total = company.open.reduce((sum, metric) => sum + metric.need, 0);
  if (total <= 0) return 100;
  const done = company.open.reduce((sum, metric) => sum + Math.min(metric.current, metric.need), 0);
  return Math.min(99, Math.max(0, Math.floor((done / total) * 100)));
}

function companyGoal(company: CompanyStatus): StartGoal {
  if (company.next === null) {
    return {
      id: 'DONE',
      label: 'ZIEL',
      text: 'Alle Firmenstufen erreicht',
      percent: 100,
    };
  }
  const open = company.open.map((metric) => `${metric.label} ${metric.current}/${metric.need}`).join(', ');
  return {
    id: 'COMPANY',
    label: 'FIRMA',
    text: `Ziel: ${company.next.name}${open ? ` — offen: ${open}` : ''}`,
    percent: companyShare(company),
  };
}

/**
 * Der Handgriff vor dem ersten Geld (#555/S1-06): ohne Geraet kommt kein Gast,
 * ohne Gast kein Bargeld fuer die Bar. Der Schritt liest den echten Zustand —
 * Kiste auf dem Boden, Kiste in der Hand, Geraet steht — nicht ein Tutorial-Flag.
 * `null` heisst: der Weg ist abgeschlossen und das naechste Ziel uebernimmt.
 */
export function deviceGoal(view: Pick<GameView, 'furniture' | 'crates' | 'player'>): StartGoal | null {
  if (view.furniture.some((item) => item.gameId)) return null;
  const carried = /^KRATE:(\d+)$/.exec(view.player.carrying);
  if (carried && view.crates.some((crate) => crate.id === Number(carried[1]))) {
    return {
      id: 'DEVICE',
      label: 'GERÄT',
      text: 'Ziel: Kiste auf eine freie Fläche stellen — erst der Automat bringt Gäste',
      percent: 50,
    };
  }
  if (view.crates.some((crate) => crate.payload.kind === 'FURNITURE')) {
    return {
      id: 'DEVICE',
      label: 'GERÄT',
      text: 'Ziel: Starter-Kiste anklicken, dann eine freie Fläche — ohne Gerät kommt kein Gast',
      percent: 0,
    };
  }
  return {
    id: 'DEVICE',
    label: 'GERÄT',
    text: 'Ziel: Erstes Gerät aufstellen — ohne Automaten kommt kein Gast',
    percent: 0,
  };
}

/**
 * Ein Ziel zur Zeit: im eigenen Raum erst der Weg zum Geraet, danach der
 * Barkauf und die erste echte Tagesmiete. Ist sie gedeckt, folgt die naechste
 * Firmenstufe statt eines stehenden 100-%-Balkens. Die UI rechnet nichts nach,
 * was der Zustand nicht sagt.
 */
export function startGoal(
  view: Pick<GameView, 'scene' | 'furniture' | 'crates' | 'player' | 'barPurchased' | 'wallet' | 'house' | 'prices' | 'company'>,
): StartGoal {
  // Nur im eigenen Raum liegt die Kiste; in Wohnung und Stadt bleibt das Geldziel.
  if (view.scene.kind === 'OWN') {
    const device = deviceGoal(view);
    if (device) return device;
  }
  if (!view.barPurchased) {
    return {
      id: 'BAR',
      label: 'BARKAUF',
      text: `Ziel: ${BAR_PURCHASE_COST_VC} VC Bargeld für die Bar`,
      current: view.wallet,
      target: BAR_TARGET,
      percent: share(view.wallet, BAR_TARGET),
    };
  }
  const rent = dailyHousingCost(view.prices);
  if (view.house < rent) {
    return {
      id: 'RENT',
      label: 'MIETE',
      text: `Ziel: Tagesmiete + Strom ${vc(rent, 2)} aus dem Hauskonto`,
      current: view.house,
      target: rent,
      percent: share(view.house, rent),
    };
  }
  return companyGoal(view.company);
}
