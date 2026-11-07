/**
 * Ledger with atomic transfer semantics.
 * Phase 0.3 P0 fix: nextFrom and nextTo are fully computed/validated BEFORE
 * any balance mutates. On overflow/underflow, all state remains unchanged.
 */

export interface LedgerEntry {
  readonly id: string;
  readonly accountId: string;
  readonly amount: number; // positive = credit, negative = debit
  readonly type: "transfer" | "adjustment" | "liability";
  readonly timestamp: number;
}

export interface Account {
  readonly id: string;
  readonly balance: number;
  readonly version: number;
}

export interface LedgerState {
  readonly accounts: Map<string, Account>;
  readonly entries: LedgerEntry[];
  readonly entryCount: number;
}

export const MAX_BALANCE = Number.MAX_SAFE_INTEGER;

export function createLedger(): LedgerState {
  return {
    accounts: new Map(),
    entries: [],
    entryCount: 0,
  };
}

export function createAccount(id: string, initialBalance = 0): Account {
  return { id, balance: initialBalance, version: 0 };
}

export function deposit(ledger: LedgerState, accountId: string, amount: number): LedgerState {
  const account = ledger.accounts.get(accountId);
  if (!account) throw new Error(`Account ${accountId} not found`);
  if (amount <= 0) throw new Error("Deposit amount must be positive");

  const nextBalance = account.balance + amount;
  if (!Number.isFinite(nextBalance) || nextBalance > MAX_BALANCE) {
    // Overflow: reject without mutation
    return ledger;
  }

  const nextAccount: Account = { id: accountId, balance: nextBalance, version: account.version + 1 };
  const nextAccounts = new Map(ledger.accounts);
  nextAccounts.set(accountId, nextAccount);

  const entry: LedgerEntry = {
    id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    accountId,
    amount,
    type: "adjustment",
    timestamp: Date.now(),
  };

  return {
    accounts: nextAccounts,
    entries: [...ledger.entries, entry],
    entryCount: ledger.entryCount + 1,
  };
}

export function transfer(
  ledger: LedgerState,
  fromId: string,
  toId: string,
  amount: number
): { ledger: LedgerState; ok: boolean; reason?: string } {
  if (amount <= 0) {
    return { ledger, ok: false, reason: "Transfer amount must be positive" };
  }

  const from = ledger.accounts.get(fromId);
  const to = ledger.accounts.get(toId);

  if (!from) {
    return { ledger, ok: false, reason: `Source account ${fromId} not found` };
  }
  if (!to) {
    return { ledger, ok: false, reason: `Target account ${toId} not found` };
  }
  if (fromId === toId) {
    // Self-transfer: no-op but valid
    return { ledger, ok: true };
  }

  // P0 INTEGRITY FIX: compute and validate ALL next-state BEFORE mutating anything
  const nextFromBalance = from.balance - amount;
  const nextToBalance = to.balance + amount;

  // Validate source: no underflow
  if (nextFromBalance < 0) {
    return { ledger, ok: false, reason: "Insufficient funds" };
  }

  // Validate target: no overflow
  if (!Number.isFinite(nextToBalance) || nextToBalance > MAX_BALANCE) {
    return { ledger, ok: false, reason: "Target account overflow" };
  }

  // Validate entry count won't overflow
  if (ledger.entryCount + 2 > Number.MAX_SAFE_INTEGER) {
    return { ledger, ok: false, reason: "Ledger entry count overflow" };
  }

  // All validations passed — now mutate
  const nextFrom: Account = { id: fromId, balance: nextFromBalance, version: from.version + 1 };
  const nextTo: Account = { id: toId, balance: nextToBalance, version: to.version + 1 };

  const nextAccounts = new Map(ledger.accounts);
  nextAccounts.set(fromId, nextFrom);
  nextAccounts.set(toId, nextTo);

  const now = Date.now();
  const entryFrom: LedgerEntry = {
    id: `entry-${now}-a`,
    accountId: fromId,
    amount: -amount,
    type: "transfer",
    timestamp: now,
  };
  const entryTo: LedgerEntry = {
    id: `entry-${now}-b`,
    accountId: toId,
    amount,
    type: "transfer",
    timestamp: now,
  };

  return {
    ledger: {
      accounts: nextAccounts,
      entries: [...ledger.entries, entryFrom, entryTo],
      entryCount: ledger.entryCount + 2,
    },
    ok: true,
  };
}

export function transferLiability(
  ledger: LedgerState,
  fromId: string,
  toId: string,
  amount: number
): { ledger: LedgerState; ok: boolean; reason?: string } {
  // Liability transfers follow the same atomicity as normal transfers
  return transfer(ledger, fromId, toId, amount);
}

export function diagnose(ledger: LedgerState): {
  valid: boolean;
  issues: string[];
  accountCount: number;
  entryCount: number;
  totalBalance: number;
} {
  const issues: string[] = [];
  let totalBalance = 0;

  for (const [id, acc] of ledger.accounts) {
    if (!Number.isFinite(acc.balance)) {
      issues.push(`Account ${id} has non-finite balance`);
    }
    if (acc.balance < 0) {
      issues.push(`Account ${id} has negative balance: ${acc.balance}`);
    }
    if (acc.balance > MAX_BALANCE) {
      issues.push(`Account ${id} exceeds MAX_BALANCE`);
    }
    totalBalance += acc.balance;
  }

  if (ledger.entries.length !== ledger.entryCount) {
    issues.push(
      `Entry count mismatch: entries=${ledger.entries.length}, entryCount=${ledger.entryCount}`
    );
  }

  if (!Number.isFinite(totalBalance)) {
    issues.push("Total balance is non-finite");
  }

  return {
    valid: issues.length === 0,
    issues,
    accountCount: ledger.accounts.size,
    entryCount: ledger.entryCount,
    totalBalance,
  };
}