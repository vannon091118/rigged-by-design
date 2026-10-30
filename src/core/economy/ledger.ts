// @loc-exception: Ledger, Diagnose und Checkpoint teilen eine Geldwahrheit; getrennt waere die Replay-Garantie zerrissen.
/**
 * Doppelte Buchfuehrung fuer VaCoin. Konten sind dynamisch, damit jeder Gast
 * ein eigenes Wallet und eine eigene Auszahlung besitzt. Kein Geld entsteht
 * ausserhalb einer Buchung gegen EXTERNAL_WORLD.
 */
import { addVC, canAfford, subVC, toVCString, ZERO_VC, type VaCoinMicro } from './vacoin';
import {
  applyEntry, BASE_ACCOUNTS, isMintingAccount, MINTING_ACCOUNT, verifyBalanceSheet,
  type AccountId, type LedgerEntry,
} from './ledger-integrity';

export type { AccountId } from './ledger-integrity';

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

interface LedgerFailure {
  readonly seq: number;
  readonly reason: string;
}

export interface LedgerDiagnosis {
  readonly ok: boolean;
  readonly entries: number;
  readonly lastSeq: number;
  readonly lastTick: number;
  readonly circulating: VaCoinMicro;
  readonly liabilities: readonly AccountId[];
  readonly checkpointSeq: number;
  readonly failure: LedgerFailure | null;
}

export class Ledger {
  readonly #balances = new Map<AccountId, VaCoinMicro>();
  readonly #liabilities = new Set<AccountId>();
  readonly #entries: LedgerEntry[] = [];
  #seq = 0;
  /** Seit der letzten Pruefung beruehrte Konten: nur die muessen neu verglichen werden. */
  readonly #touched = new Set<AccountId>();
  /** Aus Buchungen abgeleiteter Stand bis #replaySeq; nie aus #balances gesetzt. */
  #replay: Map<AccountId, VaCoinMicro> | null = null;
  #replaySeq = 0;

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

  get entryCount(): number {
    return this.#entries.length;
  }

  get liabilityAccounts(): readonly AccountId[] {
    return [...this.#liabilities];
  }

  get circulating(): VaCoinMicro {
    let total = ZERO_VC;
    for (const [account, balance] of this.#balances) {
      if (!isMintingAccount(account)) total = addVC(total, balance);
    }
    return total;
  }

  transfer(from: AccountId, to: AccountId, amount: VaCoinMicro, reason: string, tick: number): LedgerEntry {
    if (!from.trim() || !to.trim()) throw new LedgerError('transfer: Konto fehlt');
    if (from === to) throw new LedgerError('transfer: Quelle und Ziel muessen verschieden sein');
    if (!reason.trim()) throw new LedgerError('transfer: Grund darf nicht leer sein');
    if (!Number.isSafeInteger(tick) || tick < 0) throw new LedgerError('transfer: tick ungueltig');
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new LedgerError('transfer: Betrag muss positiv sein');
    this.openAccount(from);
    this.openAccount(to);

    const available = this.#balances.get(from) ?? ZERO_VC;
    if (!isMintingAccount(from) && !this.#liabilities.has(from) && !canAfford(available, amount)) {
      throw new InsufficientFundsError(from, amount, available, reason);
    }

    this.#balances.set(from, subVC(available, amount));
    this.#balances.set(to, addVC(this.#balances.get(to) ?? ZERO_VC, amount));

    const entry: LedgerEntry = Object.freeze({
      seq: this.#seq,
      tick,
      from,
      to,
      amount,
      reason: reason.trim(),
    });
    this.#seq += 1;
    this.#entries.push(entry);
    this.#touched.add(from);
    this.#touched.add(to);
    return entry;
  }

  /**
   * Vollstaendige Pruefung fuer Audit, Tests und Laden: replay gegen alle Konten.
   * Ab dem zweiten Lauf nur noch ab dem letzten Checkpoint statt ueber die ganze Historie.
   */
  verifyLedgerIntegrity(): boolean {
    const replay = this.#replayFromCheckpoint();
    if (!replay) return this.#dropCheckpoint();
    for (let index = this.#replaySeq; index < this.#entries.length; index += 1) {
      if (!applyEntry(replay, this.#entries[index]!, this.#liabilities)) return this.#dropCheckpoint();
    }
    if (!verifyBalanceSheet(replay, this.#balances, this.#liabilities)) return this.#dropCheckpoint();
    this.#advance(replay);
    return true;
  }

  /**
   * Diagnose fuer die UI: voller Replay, aber nur auf ausdrueckliche Anforderung.
   * Der Tickpfad nutzt weiterhin verifyIncremental().
   */
  diagnose(): LedgerDiagnosis {
    const replay = new Map<AccountId, VaCoinMicro>();
    let failure: LedgerFailure | null = null;
    for (const entry of this.#entries) {
      if (!applyEntry(replay, entry, this.#liabilities)) {
        failure = { seq: entry.seq, reason: `Buchung ${entry.seq} ist nicht replaybar (Betrag, Konto oder Deckung).` };
        break;
      }
    }
    if (!failure && !verifyBalanceSheet(replay, this.#balances, this.#liabilities)) {
      failure = {
        seq: this.#entries[this.#entries.length - 1]?.seq ?? 0,
        reason: 'Die Bilanz weicht vom Replay ab oder die Summe ist nicht null.',
      };
    }
    const last = this.#entries[this.#entries.length - 1];
    return {
      ok: failure === null,
      entries: this.#entries.length,
      lastSeq: last?.seq ?? -1,
      lastTick: last?.tick ?? 0,
      circulating: this.circulating,
      liabilities: [...this.#liabilities],
      checkpointSeq: this.#replaySeq,
      failure,
    };
  }

  /**
   * Tickpfad: nur neue Buchungen und die zuletzt beruehrten Konten.
   * Der teure Vollvergleich bleibt bei verifyLedgerIntegrity().
   */
  verifyIncremental(): boolean {
    if (this.#seq !== this.#entries.length) return false;
    const last = this.#entries[this.#entries.length - 1];
    if (last !== undefined && last.seq !== this.#seq - 1) return false;
    const replay = this.#replayFromCheckpoint();
    if (!replay) return this.verifyLedgerIntegrity();
    for (let index = this.#replaySeq; index < this.#entries.length; index += 1) {
      if (!applyEntry(replay, this.#entries[index]!, this.#liabilities)) return this.#dropCheckpoint();
    }
    for (const account of this.#touched) {
      if ((replay.get(account) ?? ZERO_VC) !== (this.#balances.get(account) ?? ZERO_VC)) {
        return this.#dropCheckpoint();
      }
    }
    this.#advance(replay);
    return true;
  }

  #replayFromCheckpoint(): Map<AccountId, VaCoinMicro> {
    if (this.#replay) return this.#replay;
    const fresh = new Map<AccountId, VaCoinMicro>();
    for (const account of BASE_ACCOUNTS) fresh.set(account, ZERO_VC);
    this.#replay = fresh;
    this.#replaySeq = 0;
    return fresh;
  }

  #advance(replay: Map<AccountId, VaCoinMicro>): void {
    this.#replay = replay;
    this.#replaySeq = this.#entries.length;
    this.#touched.clear();
  }

  /** Ein gebrochener Stand verliert seinen Checkpoint; der naechste Lauf replayt wieder alles. */
  #dropCheckpoint(): boolean {
    this.#replay = null;
    this.#replaySeq = 0;
    this.#touched.clear();
    return false;
  }
}
