import { describe, it, expect } from "vitest";
import {
  createLedger,
  createAccount,
  deposit,
  transfer,
  transferLiability,
  diagnose,
  MAX_BALANCE,
} from "../../src/core/ledger";

describe("Ledger atomicity (P0 integrity)", () => {
  function setup() {
    const ledger = createLedger();
    const from = createAccount("from", 1000);
    const to = createAccount("to", 500);
    ledger.accounts.set(from.id, from);
    ledger.accounts.set(to.id, to);
    return { ledger, from, to };
  }

  it("performs normal transfer atomically", () => {
    const { ledger, from, to } = setup();
    const result = transfer(ledger, from.id, to.id, 300);
    expect(result.ok).toBe(true);
    expect(result.ledger.accounts.get(from.id)!.balance).toBe(700);
    expect(result.ledger.accounts.get(to.id)!.balance).toBe(800);
    expect(result.ledger.entryCount).toBe(2);
    const d = diagnose(result.ledger);
    expect(d.valid).toBe(true);
  });

  it("rejects self-transfer as no-op", () => {
    const { ledger, from } = setup();
    const result = transfer(ledger, from.id, from.id, 300);
    expect(result.ok).toBe(true);
    expect(result.ledger).toBe(ledger); // unchanged
  });

  it("rejects underflow (source insufficient funds)", () => {
    const { ledger, from, to } = setup();
    const before = JSON.stringify([...ledger.accounts.entries()]);
    const result = transfer(ledger, from.id, to.id, 2000);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Insufficient funds");
    // Source unchanged
    expect(result.ledger.accounts.get(from.id)!.balance).toBe(1000);
    // Target unchanged
    expect(result.ledger.accounts.get(to.id)!.balance).toBe(500);
    // Entry count unchanged
    expect(result.ledger.entryCount).toBe(0);
    expect(JSON.stringify([...result.ledger.accounts.entries()])).toBe(before);
  });

  it("rejects target overflow", () => {
    const { ledger, from, to } = setup();
    // Set target near MAX_BALANCE
    const overflowTo: any = { id: to.id, balance: MAX_BALANCE, version: 0 };
    ledger.accounts.set(to.id, overflowTo);

    const result = transfer(ledger, from.id, to.id, 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Target account overflow");
    // Both accounts unchanged
    expect(result.ledger.accounts.get(from.id)!.balance).toBe(1000);
    expect(result.ledger.accounts.get(to.id)!.balance).toBe(MAX_BALANCE);
    expect(result.ledger.entryCount).toBe(0);
  });

  it("rejects missing source account", () => {
    const { ledger } = setup();
    const result = transfer(ledger, "missing", "to", 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("rejects missing target account", () => {
    const { ledger, from } = setup();
    const result = transfer(ledger, from.id, "missing", 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not found");
  });

  it("rejects zero or negative amount", () => {
    const { ledger, from, to } = setup();
    const r1 = transfer(ledger, from.id, to.id, 0);
    expect(r1.ok).toBe(false);
    const r2 = transfer(ledger, from.id, to.id, -50);
    expect(r2.ok).toBe(false);
  });

  it("performs liability transfer atomically", () => {
    const { ledger, from, to } = setup();
    const result = transferLiability(ledger, from.id, to.id, 200);
    expect(result.ok).toBe(true);
    expect(result.ledger.accounts.get(from.id)!.balance).toBe(800);
    expect(result.ledger.accounts.get(to.id)!.balance).toBe(700);
  });

  it("diagnose detects negative balance", () => {
    const ledger = createLedger();
    const bad: any = { id: "bad", balance: -50, version: 0 };
    ledger.accounts.set("bad", bad);
    const d = diagnose(ledger);
    expect(d.valid).toBe(false);
    expect(d.issues.some((i) => i.includes("negative"))).toBe(true);
  });

  it("diagnose detects entry count mismatch", () => {
    const ledger = createLedger();
    ledger.entries.push({ id: "e1", accountId: "a1", amount: 10, type: "adjustment", timestamp: 0 } as any);
    // entryCount is 0 but entries has 1
    const d = diagnose(ledger);
    expect(d.valid).toBe(false);
    expect(d.issues.some((i) => i.includes("Entry count mismatch"))).toBe(true);
  });

  it("deposit overflow rejects without mutation", () => {
    const ledger = createLedger();
    const acc: any = { id: "acc", balance: MAX_BALANCE, version: 0 };
    ledger.accounts.set("acc", acc);
    const before = acc.balance;
    const result = deposit(ledger, "acc", 1);
    expect(result.accounts.get("acc")!.balance).toBe(before);
    expect(result.entryCount).toBe(0);
  });
});