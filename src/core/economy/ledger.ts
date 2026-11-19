/**
 * Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast
 * ein eigenes Wallet und eine eigene Auszahlung besitzt. Kein Geld entsteht
 * ausserhalb einer Buchung gegen EXTERNAL_WORLD.
 */
import { addVC, canAfford, subVC, toVCString, ZERO_VC, type VaCoinMicro } from './vacoin';
import {
  BASE_ACCOUNTS, isMintingAccount, MINTING_ACCOUNT, type AccountId, type LedgerEntry,
} from './ledger-integrity';
import { circulatingTotal, LedgerVerification, type LedgerDiagnosis } from './ledger-verification';

export type { AccountId } from './ledger-integrity';
export type { LedgerDiagnosis } from './ledger-verification';

class LedgerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LedgerError';
  }
}

export class InsufficientFundsError extends LedgerError {
  constructor(
    readonly account: AccountId,
    readonly requested: VaCoinMicro,
    readonly available: VaCoinMicro,
    readonly reason: string,
  ) {
    super(
      `Unterdeckung auf ${account}: ${toVCString(requested)} angefragt, ` +
        `${toVCString(available)} verfuegbar (Grund: "${reason}")`,
    );
    this.name = 'InsufficientFundsError';
  }
}

export class Ledger {
  readonly #balances = new Map<AccountId, VaCoinMicro>();
  readonly #liabilities = new Set<AccountId>();
  readonly #entries: LedgerEntry[] = [];
  readonly #verification = new LedgerVerification();
  #seq = 0;

  constructor(opening?: Readonly<Record<AccountId, VaCoinMicro>>) {
    for (const account of BASE_ACCOUNTS) this.#balances.set(account, ZERO_VC);
    if (!opening) return;
    for (const [account, amount] of Object.entries(opening)) {
      if (account === MINTING_ACCOUNT || !amount) continue;
      this.transfer(MINTING_ACCOUNT, account, amount, 'opening balance', 0);
    }
  }

  openAccount(account: AccountId): void {
    if (!account.trim()) throw new LedgerError('Konto darf nicht leer sein');
    if (!this.#balances.has(account)) this.#balances.set(account, ZERO_VC);
  }

  /** Verbindlichkeitskonto: darf negativ stehen, damit eine Schuld gebucht statt gekappt wird. */
  openLiability(account: AccountId): void {
    if (!account.trim()) throw new LedgerError('Konto darf nicht leer sein');
    this.#liabilities.add(account);
    this.openAccount(account);
  }

  hasAccount(account: AccountId): boolean {
    return this.#balances.has(account);
  }

  get accounts(): readonly AccountId[] {
    return [...this.#balances.keys()];
  }

  getBalance(account: AccountId): VaCoinMicro {
    return this.#balances.get(account) ?? ZERO_VC;
  }

  snapshot(): Readonly<Record<AccountId, VaCoinMicro>> {
    return Object.freeze(Object.fromEntries(this.#balances));
  }

  get entries(): readonly LedgerEntry[] {
    return Object.freeze([...this.#entries]);
  }

  /** Nur neue Zeilen kopieren; die UI muss nicht die ganze Historie anfassen. */
  entriesSince(seq: number): readonly LedgerEntry[] {
    return this.#entries.slice(Math.max(0, seq));
  }

  /** Buchungen nach dem gespeicherten `seq`; binaer gesucht, weil `seq` monoton ist. */
  entriesAfterSeq(seq: number): readonly LedgerEntry[] {
    let low = 0;
    let high = this.#entries.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (this.#entries[mid]!.seq <= seq) low = mid + 1;
      else high = mid;
    }
    return this.#entries.slice(low);
  }

  get entryCount(): number {
    return this.#entries.length;
  }

  get liabilityAccounts(): readonly AccountId[] {
    return [...this.#liabilities];
  }

  get circulating(): VaCoinMicro {
    return circulatingTotal(this.#balances);
  }

  transfer(from: AccountId, to: AccountId, amount: VaCoinMicro, reason: string, tick: number, game: string | null = null): LedgerEntry {
    if (!from.trim() || !to.trim()) throw new LedgerError('transfer: Konto fehlt');
    if (from === to) throw new LedgerError('transfer: Quelle und Ziel muessen verschieden sein');
    if (!reason.trim()) throw new LedgerError('transfer: Grund darf nicht leer sein');
    if (!Number.isSafeInteger(tick) || tick < 0) throw new LedgerError('transfer: tick ungueltig');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new LedgerError('transfer: Betrag muss positiv sein');
    const gameTag = game === null ? null : game.trim();
    if (gameTag !== null && !gameTag) throw new LedgerError('transfer: Spieltyp darf nicht leer sein');
    this.openAccount(from);
    this.openAccount(to);

    const available = this.#balances.get(from) ?? ZERO_VC;
    if (!isMintingAccount(from) && !this.#liabilities.has(from) && !canAfford(available, amount)) {
      throw new InsufficientFundsError(from, amount, available, reason);
    }

    // Beide neuen Salden vollstaendig berechnen und validieren, bevor irgendein
    // Kontostand mutiert. addVC wirft bei Zielkonto-Overflow, subVC bei
    // Quellkonto-Unterlauf - beides passiert hier, bevor ein Saldo geschrieben wird.
    const newFrom = subVC(available, amount);
    const currentTo = this.#balances.get(to) ?? ZERO_VC;
    const newTo = addVC(currentTo, amount);

    this.#balances.set(from, newFrom);
    this.#balances.set(to, newTo);

    const entry: LedgerEntry = Object.freeze({
      seq: this.#seq,
      tick,
      from,
      to,
      amount,
      reason: reason.trim(),
      game: gameTag,
    });
    this.#seq += 1;
    this.#entries.push(entry);
    this.#verification.touch(from);
    this.#verification.touch(to);
    return entry;
  }

  /** Vollstaendige Pruefung fuer Audit, Tests und Laden (Replay ab dem Checkpoint). */
  verifyLedgerIntegrity(): boolean {
    return this.#verification.verifyAll(this.#entries, this.#balances, this.#liabilities);
  }

  /** Diagnose fuer die UI: voller Replay, nur auf ausdrueckliche Anforderung. */
  diagnose(): LedgerDiagnosis {
    return this.#verification.diagnose(this.#entries, this.#balances, this.#liabilities);
  }

  /** Tickpfad: nur neue Buchungen und die zuletzt beruehrten Konten. */
  verifyIncremental(): boolean {
    return this.#verification.verifyIncremental(this.#seq, this.#entries, this.#balances, this.#liabilities);
  }
}
