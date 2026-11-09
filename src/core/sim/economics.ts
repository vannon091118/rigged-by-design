/**
 * Wirtschaftliche Kennzahlen als reine Ableitung aus den Ledger-Buchungen.
 * Keine zweite Geldquelle: jede Zahl ist die Summe echter Buchungen. Der Cursor
 * merkt sich, bis wohin gelesen wurde, damit pro Aufruf nur neue Zeilen angefasst werden.
 */
import type { Ledger } from '../economy/ledger';
import type { LedgerEntry } from '../economy/ledger-integrity';
import { HAUSKONTO, PORTEMONNAIE, SHOP, STAFF, UTILITIES, DEBT_ACCOUNT } from './money';
import { ROBBERY_ACCOUNT } from './penalty-pool';
import { guestReasonKind, shopBucket } from './tx-reasons';

interface GameEconomy {
  /** Spieltyp, z. B. SLOT oder PLINKO. */
  readonly game: string;
  readonly stakeVolume: number;
  readonly gamePayouts: number;
  readonly retainedGamingWin: number;
}

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
  /** Einnahmen und Auszahlungen je Spieltyp, deterministisch sortiert. */
  readonly byGame: readonly GameEconomy[];
}

interface GameTotals {
  stake: number;
  payout: number;
}

interface Totals {
  games: Map<string, GameTotals>;
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

const cursors = new WeakMap<Ledger, { seq: number; totals: Totals }>();

function emptyTotals(): Totals {
  return {
    stakeVolume: 0, gamePayouts: 0, unpaidPayouts: 0, serviceRevenue: 0, wages: 0, rent: 0,
    operatingRepairs: 0, goods: 0, losses: 0, investment: 0, games: new Map(),
  };
}

function classify(entry: LedgerEntry, t: Totals): void {
  const { from, to, amount, reason } = entry;
  // Die Spieltyp-Spur zaehlt nur Haus-Umsaetze: Einsatz ans Hauskonto oder
  // Auszahlung aus Hauskonto/Schuld. Fremdes Haus bleibt Spieler-Geld.
  if (entry.game) {
    const flow = to === HAUSKONTO
      ? 'stake'
      : (from === HAUSKONTO || from === DEBT_ACCOUNT) && (to.startsWith('PENDING_') || to === PORTEMONNAIE)
        ? 'payout'
        : null;
    if (flow) {
      const game = t.games.get(entry.game) ?? { stake: 0, payout: 0 };
      game[flow] += amount;
      t.games.set(entry.game, game);
    }
  }
  // Ein Ueberfall trifft die Kasse oder das Portemonnaie; beides ist ein Verlust.
  if (to === ROBBERY_ACCOUNT) { t.losses += amount; return; }
  if (to === HAUSKONTO && from.startsWith('VISITOR_')) {
    const kind = guestReasonKind(reason);
    if (kind === 'STAKE') t.stakeVolume += amount;
    else if (kind === 'DRINK') t.serviceRevenue += amount;
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
  else if (to === SHOP) {
    const bucket = shopBucket(reason);
    if (bucket === 'operating') t.operatingRepairs += amount;
    else if (bucket === 'goods') t.goods += amount;
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
    byGame: [...t.games.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([game, totals]) => ({
        game,
        stakeVolume: toVC(totals.stake),
        gamePayouts: toVC(totals.payout),
        retainedGamingWin: toVC(totals.stake - totals.payout),
      })),
  };
}
