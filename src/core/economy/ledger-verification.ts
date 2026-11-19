/**
 * Ledger-Pruefung: Replay-Checkpoint, Vollvergleich, Tickvergleich und Diagnose.
 *
 * Alles hier ist Ableitung aus Buchungen, Salden und Verbindlichkeiten. Der
 * Ledger haelt nur noch seine Salden und Buchungen und delegiert die Pruefung;
 * der Checkpoint-Zustand gehoert genau dieser Klasse.
 */
import { addVC, ZERO_VC, type VaCoinMicro } from './vacoin';
import {
  applyEntry, BASE_ACCOUNTS, isMintingAccount, verifyBalanceSheet,
  type AccountId, type LedgerEntry,
} from './ledger-integrity';

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

/** Umlauf ohne Muenze: Summe aller Konten ausser dem Minting-Konto. */
export function circulatingTotal(balances: ReadonlyMap<AccountId, VaCoinMicro>): VaCoinMicro {
  let total = ZERO_VC;
  for (const [account, balance] of balances) {
    if (!isMintingAccount(account)) total = addVC(total, balance);
  }
  return total;
}

export class LedgerVerification {
  /** Aus Buchungen abgeleiteter Stand bis #replaySeq; nie aus Salden gesetzt. */
  #replay: Map<AccountId, VaCoinMicro> | null = null;
  #replaySeq = 0;
  /** Seit der letzten Pruefung beruehrte Konten: nur die muessen neu verglichen werden. */
  readonly #touched = new Set<AccountId>();

  get checkpointSeq(): number {
    return this.#replaySeq;
  }

  touch(account: AccountId): void {
    this.#touched.add(account);
  }

  /**
   * Vollstaendige Pruefung fuer Audit, Tests und Laden: replay gegen alle Konten.
   * Ab dem zweiten Lauf nur noch ab dem letzten Checkpoint statt ueber die ganze Historie.
   */
  verifyAll(
    entries: readonly LedgerEntry[],
    balances: ReadonlyMap<AccountId, VaCoinMicro>,
    liabilities: ReadonlySet<AccountId>,
  ): boolean {
    const replay = this.#replayFromCheckpoint();
    for (let index = this.#replaySeq; index < entries.length; index += 1) {
      if (!applyEntry(replay, entries[index]!, liabilities)) return this.#dropCheckpoint();
    }
    if (!verifyBalanceSheet(replay, balances, liabilities)) return this.#dropCheckpoint();
    this.#advance(replay, entries.length);
    return true;
  }

  /**
   * Tickpfad: nur neue Buchungen und die zuletzt beruehrten Konten.
   * Der teure Vollvergleich bleibt bei verifyAll().
   */
  verifyIncremental(
    seq: number,
    entries: readonly LedgerEntry[],
    balances: ReadonlyMap<AccountId, VaCoinMicro>,
    liabilities: ReadonlySet<AccountId>,
  ): boolean {
    if (seq !== entries.length) return false;
    const last = entries[entries.length - 1];
    if (last !== undefined && last.seq !== seq - 1) return false;
    const replay = this.#replayFromCheckpoint();
    for (let index = this.#replaySeq; index < entries.length; index += 1) {
      if (!applyEntry(replay, entries[index]!, liabilities)) return this.#dropCheckpoint();
    }
    for (const account of this.#touched) {
      if ((replay.get(account) ?? ZERO_VC) !== (balances.get(account) ?? ZERO_VC)) {
        return this.#dropCheckpoint();
      }
    }
    this.#advance(replay, entries.length);
    return true;
  }

  /**
   * Diagnose fuer die UI: voller Replay, aber nur auf ausdrueckliche Anforderung.
   * Der Tickpfad nutzt weiterhin verifyIncremental().
   */
  diagnose(
    entries: readonly LedgerEntry[],
    balances: ReadonlyMap<AccountId, VaCoinMicro>,
    liabilities: ReadonlySet<AccountId>,
  ): LedgerDiagnosis {
    const replay = new Map<AccountId, VaCoinMicro>();
    let failure: LedgerFailure | null = null;
    for (const entry of entries) {
      if (!applyEntry(replay, entry, liabilities)) {
        failure = { seq: entry.seq, reason: `Buchung ${entry.seq} ist nicht replaybar (Betrag, Konto oder Deckung).` };
        break;
      }
    }
    if (!failure && !verifyBalanceSheet(replay, balances, liabilities)) {
      failure = {
        seq: entries[entries.length - 1]?.seq ?? 0,
        reason: 'Die Bilanz weicht vom Replay ab oder die Summe ist nicht null.',
      };
    }
    const last = entries[entries.length - 1];
    return {
      ok: failure === null,
      entries: entries.length,
      lastSeq: last?.seq ?? -1,
      lastTick: last?.tick ?? 0,
      circulating: circulatingTotal(balances),
      liabilities: [...liabilities],
      checkpointSeq: this.#replaySeq,
      failure,
    };
  }

  #replayFromCheckpoint(): Map<AccountId, VaCoinMicro> {
    if (this.#replay) return this.#replay;
    const fresh = new Map<AccountId, VaCoinMicro>();
    for (const account of BASE_ACCOUNTS) fresh.set(account, ZERO_VC);
    this.#replay = fresh;
    this.#replaySeq = 0;
    return fresh;
  }

  #advance(replay: Map<AccountId, VaCoinMicro>, seq: number): void {
    this.#replay = replay;
    this.#replaySeq = seq;
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
