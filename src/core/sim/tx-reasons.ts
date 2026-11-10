/**
 * Ein Ort für Buchungsgründe: Wer bucht und wer klassifiziert, liest dieselben
 * Werte. Der Ledger selbst bleibt bei freiem Text, aber die Wirtschaftskennzahlen
 * haengen an genau diesen Strings – ein abweichender Grund wuerde sonst still im
 * Investitionstopf landen, ohne dass irgendwo ein Fehler auftaucht.
 */

/** Feste Gründe, die eine Kennzahl bedeuten. */
export const TX_REASON = {
  START_CAPITAL: 'startkapital',
  CLEANING: 'reinigung',
  DEEP_CLEANING: 'grossreinigung',
  REPAIR: 'reparatur',
  MOD_OPERATING: 'mod betrieb',
  DEBT_REPAYMENT: 'schuldentilgung',
  DRINK_CRATE: 'getraenkekiste',
  SPARE_PARTS: 'ersatzteile',
  DRINK_SALE: 'getraenk',
  REEL_UPGRADE: 'walze erweitern',
  BAR_UPGRADE: 'bar ausbauen',
  WC_UPGRADE: 'wc ausbauen',
  TAKE_HOME: 'betreiber entnahme',
  PROPERTY: 'immobilie kaufen',
  FOREIGN_STAKE: 'fremdes haus einsatz',
  FOREIGN_WIN: 'fremdes haus gewinn',
  BACKYARD_ENTRY: 'hinterhof startgeld',
  BACKYARD_PRIZE: 'hinterhof preisgeld',
  OWN_STAKE: 'eigenes haus einsatz',
  OWN_WIN: 'eigenes haus gewinn',
  OWN_RISK_LOST: 'eigene risiko-karte verloren',
  RISK_CARD_LOST: 'risiko-karte verloren',
  PACT_RESERVE: 'disziplin-pakt reserve',
  PACT_BONUS: 'disziplin-bonus',
} as const;

/** Gründe mit variablem Anhang: das Praefix steht hier, der Rest kommt vom Aufrufer. */
export const TX_PREFIX = {
  MOD_PURCHASE: 'mod ',
  BUILD_PURCHASE: 'kauf ',
  EXPANSION: 'ausbau ',
  RENOVATION: 'renovierung ',
} as const;

/** Gast-Buchungen tragen die Gast-ID im Grund; das Suffix ist die Kategorie. */
export const GUEST_REASON = { STAKE: 'einsatz', DRINK: 'drink' } as const;

type GuestReasonKind = keyof typeof GUEST_REASON;

/** Grund einer Gast-Buchung, z. B. `gast 7 einsatz`. */
export const guestReason = (kind: GuestReasonKind, guestId: number): string =>
  `gast ${guestId} ${GUEST_REASON[kind]}`;

/** Kategorie eines Grunds, der an der Kasse des Hauses landet, oder null. */
export function guestReasonKind(reason: string): GuestReasonKind | null {
  if (reason === TX_REASON.DRINK_SALE) return 'DRINK';
  if (reason.endsWith(` ${GUEST_REASON.STAKE}`)) return 'STAKE';
  if (reason.endsWith(` ${GUEST_REASON.DRINK}`)) return 'DRINK';
  return null;
}

/** Wohin ein Einkauf beim SHOP in den Kennzahlen gehoert. */
type ShopBucket = 'operating' | 'goods' | 'investment';

const OPERATING: ReadonlySet<string> = new Set([
  TX_REASON.CLEANING,
  TX_REASON.DEEP_CLEANING,
  TX_REASON.REPAIR,
  TX_REASON.MOD_OPERATING,
]);

const GOODS: ReadonlySet<string> = new Set([TX_REASON.DRINK_CRATE, TX_REASON.SPARE_PARTS]);

/**
 * Der Rueckfall ist bewusst `investment`: Ausbau, Kauf und Ausstattung sind die
 * haeufigsten Shop-Buchungen. Wer einen Betriebs- oder Warengrund bucht, nimmt
 * die Konstante – nur so bleibt der Topf richtig.
 */
export function shopBucket(reason: string): ShopBucket {
  if (OPERATING.has(reason)) return 'operating';
  if (GOODS.has(reason)) return 'goods';
  return 'investment';
}
