/** Buchungspruefung als reine Funktionen: kein Geld, nur Nachvollziehbarkeit. */
import { ZERO_VC, type VaCoinMicro } from './vacoin';

export type AccountId = string;

/** Die Aussenwelt: hier entsteht Geld, hier verschwindet es. Eine Quelle fuer alle Schreibweisen. */
export const MINTING_ACCOUNT = 'EXTERNAL_WORLD';

export const BASE_ACCOUNTS = [
  MINTING_ACCOUNT,
  'WECHSELKASSE',
  'HAUSKONTO',
  'PORTEMONNAIE',
  'SHOP',
  'STAFF',
  'UTILITIES',
] as const;

export function isMintingAccount(account: AccountId): boolean {
  return account === MINTING_ACCOUNT;
}

export interface LedgerEntry {
  readonly seq: number;
  readonly tick: number;
  readonly from: AccountId;
  readonly to: AccountId;
  readonly amount: VaCoinMicro;
  readonly reason: string;
}

/** Eine Buchung gegen den Replay-Stand pruefen und anwenden. */
export function applyEntry(
  replay: Map<AccountId, VaCoinMicro>,
  entry: LedgerEntry,
  liabilities: ReadonlySet<AccountId>,
): boolean {
  if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0) return false;
  if (entry.from === entry.to) return false;
  for (const account of [entry.from, entry.to]) {
    if (!replay.has(account)) replay.set(account, ZERO_VC);
  }
  const from = (replay.get(entry.from) ?? 0) - entry.amount;
  const to = (replay.get(entry.to) ?? 0) + entry.amount;
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to)) return false;
  if (!isMintingAccount(entry.from) && !liabilities.has(entry.from) && from < 0) return false;
  replay.set(entry.from, from as VaCoinMicro);
  replay.set(entry.to, to as VaCoinMicro);
  return true;
}

/** Bilanzpruefung: Replay muss jede Kontostandszeile decken, Summe bleibt null. */
export function verifyBalanceSheet(
  replay: ReadonlyMap<AccountId, VaCoinMicro>,
  balances: ReadonlyMap<AccountId, VaCoinMicro>,
  liabilities: ReadonlySet<AccountId>,
): boolean {
  let net = 0;
  for (const [account, balance] of balances) {
    if (!isMintingAccount(account) && !liabilities.has(account) && balance < 0) return false;
    if ((replay.get(account) ?? ZERO_VC) !== balance) return false;
    net += balance;
  }
  return net === 0;
}
