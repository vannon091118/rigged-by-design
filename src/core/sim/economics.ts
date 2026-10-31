/**
 * Wirtschaftliche Kennzahlen als reine Ableitung aus den Ledger-Buchungen.
 * Keine zweite Geldquelle: jede Zahl ist die Summe echter Buchungen. Der Cursor
 * merkt sich, bis wohin gelesen wurde, damit pro Aufruf nur neue Zeilen angefasst werden.
 */
import type { Ledger } from '../economy/ledger';
import type { LedgerEntry } from '../economy/ledger-integrity';
import { HAUSKONTO, SHOP, STAFF, UTILITIES, DEBT_ACCOUNT } from './money';
import { ROBBERY_ACCOUNT } from './penalty-pool';

export interface EconomySummary {
  /** Einsatzvolumen (Bruttospielumsatz): alles, was Gaeste ins Haus spielen. */
  readonly stakeVolume: number;
  /** Alle Gewinnauszahlungen, auch die nicht gedeckten Schulden. */
  readonly gamePayouts: number;
  /** Nicht gedeckter Teil der Gewinnauszahlungen (offene Verbindlichkeit). */
  readonly unpaidPayouts: number;
  /** Einbehaltener Spielgewinn: Einsatzvolumen minus alle Gewinnauszahlungen. */
  readonly retainedGamingWin: number;
  /** Erloese aus Getraenken und sonstigem Service. */
  readonly serviceRevenue: number;
  readonly wages: number;
  readonly rent: number;
  readonly operatingRepairs: number;
  readonly goods: number;
  readonly losses: number;
  /** Investitionen (Ausbau, Einrichtung, Upgrades): nicht im Betriebsgewinn. */
  readonly investment: number;
  /** Kumulierter Betriebsgewinn: Spielgewinn plus Service minus laufende Kosten und Verluste. */
  readonly operatingProfit: number;
}

interface Totals {
  stakeVolume: number;
  gamePayouts: number;
  unpaidPayouts: number;
  serviceRevenue: number;
  wages: number;
  rent: number;
  operatingRepairs: number;
  goods: number;
  losses: number;
  investment: number;
}

const MICRO = 10_000;
const OPERATING_SHOP = new Set(['reinigung', 'grossreinigung', 'reparatur', 'mod betrieb']);
const GOODS_SHOP = new Set(['getraenkekiste', 'ersatzteile']);

const cursors = new WeakMap<Ledger, { seq: number; totals: Totals }>();

function emptyTotals(): Totals {
  return {
    stakeVolume: 0, gamePayouts: 0, unpaidPayouts: 0, serviceRevenue: 0, wages: 0, rent: 0,
    operatingRepairs: 0, goods: 0, losses: 0, investment: 0,
  };
}

function classify(entry: LedgerEntry, t: Totals): void {
  const { from, to, amount, reason } = entry;
  if (to === HAUSKONTO && from.startsWith('VISITOR_')) {
    if (reason.endsWith(' einsatz')) t.stakeVolume += amount;
    else if (reason.endsWith(' drink') || reason === 'getraenk') t.serviceRevenue += amount;
    return;
  }
  // Auszahlungen und laufende Kosten koennen aus der Kasse oder aus der Verbindlichkeit kommen.
  if (from !== HAUSKONTO && from !== DEBT_ACCOUNT) return;
  const onCredit = from === DEBT_ACCOUNT;
  if (to.startsWith('PENDING_')) {
    t.gamePayouts += amount;
    if (onCredit) t.unpaidPayouts += amount;
    return;
  }
  if (to === STAFF) t.wages += amount;
  else if (to === UTILITIES) t.rent += amount;
  else if (to === ROBBERY_ACCOUNT) t.losses += amount;
  else if (to === SHOP) {
    if (OPERATING_SHOP.has(reason)) t.operatingRepairs += amount;
    else if (GOODS_SHOP.has(reason)) t.goods += amount;
    else t.investment += amount;
  }
  // Entnahmen an PORTEMONNAIE sind weder Kosten noch Ertrag.
}

/** Liest nur Buchungen seit dem letzten Aufruf nach; alte Zeilen werden nie erneut angefasst. */
function totalsOf(ledger: Ledger): Totals {
  let cursor = cursors.get(ledger);
  if (!cursor) {
    cursor = { seq: 0, totals: emptyTotals() };
    cursors.set(ledger, cursor);
  }
  const fresh = ledger.entriesSince(cursor.seq);
  for (const entry of fresh) classify(entry, cursor.totals);
  cursor.seq += fresh.length;
  return cursor.totals;
}

const toVC = (micro: number): number => Math.floor(micro / MICRO);

export function economyOf(ledger: Ledger): EconomySummary {
  const t = totalsOf(ledger);
  const retained = t.stakeVolume - t.gamePayouts;
  const operatingProfit =
    retained + t.serviceRevenue - t.wages - t.rent - t.operatingRepairs - t.goods - t.losses;
  return {
    stakeVolume: toVC(t.stakeVolume),
    gamePayouts: toVC(t.gamePayouts),
    unpaidPayouts: toVC(t.unpaidPayouts),
    retainedGamingWin: toVC(retained),
    serviceRevenue: toVC(t.serviceRevenue),
    wages: toVC(t.wages),
    rent: toVC(t.rent),
    operatingRepairs: toVC(t.operatingRepairs),
    goods: toVC(t.goods),
    losses: toVC(t.losses),
    investment: toVC(t.investment),
    operatingProfit: toVC(operatingProfit),
  };
}
