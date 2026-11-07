/**
 * Casino Integration — Phase 6
 * Casino als erste Domain an die allgemeinen Verträge anbinden.
 * Verbindet Casino-Spiele (SLOT, BLACKJACK, POKER, ROULETTE, PLINKO, SHELL, DICE)
 * mit dem Relationship-, Factor-, Memory- und Event-System.
 */

import type { WorldTime } from "./worldtime";
import type { ActorId } from "./actor-id";
import { createDomainEvent } from "./domain-event";

// ──────────────────────────────────────────────────────────────────────────────
// Typen
// ──────────────────────────────────────────────────────────────────────────────

export type CasinoGameType =
  | "SLOT"
  | "BLACKJACK"
  | "POKER"
  | "ROULETTE"
  | "PLINKO"
  | "SHELL"
  | "DICE";

export type CasinoTransactionType = "bet" | "win" | "loss" | "cashout" | "cash_in";

export interface CasinoGameResult {
  readonly gameType: CasinoGameType;
  readonly playerId: string;
  readonly betAmount: number;
  readonly winAmount: number;
  readonly netResult: number; // winAmount - betAmount
  readonly worldTime: WorldTime;
  readonly transactionId: string;
}

export interface CasinoRevenueAttribution {
  readonly gameType: CasinoGameType;
  readonly totalBets: number;
  readonly totalWins: number;
  readonly netRevenue: number;
  readonly playerCount: number;
  readonly lastUpdatedTick: number;
}

export interface PlayerCashAccount {
  readonly playerId: string;
  readonly balance: number;
  readonly totalCashIn: number;
  readonly totalCashOut: number;
  readonly lastCashOutTick?: number;
  readonly version: number;
}

export interface CasinoCalloutRecord {
  readonly calloutId: string;
  readonly playerId: string;
  readonly gameType: CasinoGameType;
  readonly amount: number;
  readonly worldTime: WorldTime;
  readonly productionCaller: string; // Wer hat den Cash-out aufgerufen
}

// ──────────────────────────────────────────────────────────────────────────────
// Casino Domain Service
// ──────────────────────────────────────────────────────────────────────────────

export interface CasinoConfig {
  readonly enableProductionCashOut: boolean;
  readonly maxBetPerGame: number;
  readonly revenueAttributionWindowTicks: number;
}

export const DEFAULT_CASINO_CONFIG: CasinoConfig = {
  enableProductionCashOut: true,
  maxBetPerGame: 10000,
  revenueAttributionWindowTicks: 600, // 1 Tag
}

export class CasinoIntegration {
  private gameResults = new Map<string, CasinoGameResult[]>();
  private revenueAttribution = new Map<CasinoGameType, CasinoRevenueAttribution>();
  private playerCash = new Map<string, PlayerCashAccount>();
  private cashOutCallouts = new Map<string, CasinoCalloutRecord>();
  private readonly config: CasinoConfig;
  private nextTransactionId = 0;
  private nextCalloutId = 0;

  constructor(config: Partial<CasinoConfig> = {}) {
    this.config = { ...DEFAULT_CASINO_CONFIG, ...config };
    this.initializeRevenueAttribution();
  }

  private initializeRevenueAttribution(): void {
    const gameTypes: CasinoGameType[] = ["SLOT", "BLACKJACK", "POKER", "ROULETTE", "PLINKO", "SHELL", "DICE"];
    for (const gt of gameTypes) {
      this.revenueAttribution.set(gt, {
        gameType: gt,
        totalBets: 0,
        totalWins: 0,
        netRevenue: 0,
        playerCount: 0,
        lastUpdatedTick: 0,
      });
    }
  }

  // ── Spiel-Ergebnisse ─────────────────────────────────────────

  recordGameResult(
    gameType: CasinoGameType,
    playerId: string,
    betAmount: number,
    winAmount: number,
    worldTime: WorldTime
  ): { ok: boolean; result?: CasinoGameResult; error?: string } {
    if (betAmount <= 0) {
      return { ok: false, error: "Bet amount must be positive" };
    }
    if (betAmount > this.config.maxBetPerGame) {
      return { ok: false, error: `Bet exceeds max ${this.config.maxBetPerGame}` };
    }

    const netResult = winAmount - betAmount;
    const transactionId = `tx-${this.nextTransactionId++}`;

    const result: CasinoGameResult = {
      gameType,
      playerId,
      betAmount,
      winAmount,
      netResult,
      worldTime,
      transactionId,
    };

    // Speichern
    const existing = this.gameResults.get(gameType) ?? [];
    existing.push(result);
    this.gameResults.set(gameType, existing);

    // Revenue Attribution aktualisieren
    this.updateRevenueAttribution(gameType, betAmount, winAmount, worldTime.tick);

    // Player Cash aktualisieren
    this.updatePlayerCash(playerId, betAmount, winAmount, worldTime);

    // Domain Event emittieren
    const event = createDomainEvent(
      `evt-${transactionId}`,
      "casino.game.result",
      playerId,
      {
        gameType,
        betAmount,
        winAmount,
        netResult,
        transactionId,
        worldTimeTick: worldTime.tick,
      },
      worldTime.tick,
      100
    );

    return { ok: true, result, event };
  }

  private updateRevenueAttribution(
    gameType: CasinoGameType,
    betAmount: number,
    winAmount: number,
    tick: number
  ): void {
    const attr = this.revenueAttribution.get(gameType);
    if (!attr) return;

    const next: CasinoRevenueAttribution = {
      ...attr,
      totalBets: attr.totalBets + betAmount,
      totalWins: attr.totalWins + winAmount,
      netRevenue: attr.netRevenue + (betAmount - winAmount), // Haus gewinnt, wenn positiv
      playerCount: attr.playerCount + 1,
      lastUpdatedTick: tick,
    };
    this.revenueAttribution.set(gameType, next);
  }

  private updatePlayerCash(
    playerId: string,
    betAmount: number,
    winAmount: number,
    worldTime: WorldTime
  ): void {
    const existing = this.playerCash.get(playerId);
    const netChange = winAmount - betAmount;

    const next: PlayerCashAccount = {
      playerId,
      balance: (existing?.balance ?? 0) + netChange,
      totalCashIn: existing?.totalCashIn ?? 0,
      totalCashOut: existing?.totalCashOut ?? 0,
      lastCashOutTick: existing?.lastCashOutTick,
      version: (existing?.version ?? 0) + 1,
    };
    this.playerCash.set(playerId, next);
  }

  // ── Cash-out (Produktions-Aufrufer) ──────────────────────────

  cashOut(
    playerId: string,
    amount: number,
    worldTime: WorldTime,
    productionCaller: string
  ): { ok: boolean; result?: CasinoCalloutRecord; error?: string } {
    if (!this.config.enableProductionCashOut) {
      return { ok: false, error: "Production cash-out disabled" };
    }
    if (amount <= 0) {
      return { ok: false, error: "Amount must be positive" };
    }

    const account = this.playerCash.get(playerId);
    if (!account || account.balance < amount) {
      return { ok: false, error: "Insufficient balance" };
    }

    const next: PlayerCashAccount = {
      ...account,
      balance: account.balance - amount,
      totalCashOut: account.totalCashOut + amount,
      lastCashOutTick: worldTime.tick,
      version: account.version + 1,
    };
    this.playerCash.set(playerId, next);

    const calloutId = `co-${this.nextCalloutId++}`;
    const record: CasinoCalloutRecord = {
      calloutId,
      playerId,
      gameType: "SLOT", // Default, kann überschrieben werden
      amount,
      worldTime,
      productionCaller,
    };
    this.cashOutCallouts.set(calloutId, record);

    const event = createDomainEvent(
      `evt-${calloutId}`,
      "player.cash-out",
      playerId,
      {
        calloutId,
        amount,
        productionCaller,
        worldTimeTick: worldTime.tick,
        remainingBalance: next.balance,
      },
      worldTime.tick,
      100
    );

    return { ok: true, record, event };
  }

  cashIn(
    playerId: string,
    amount: number,
    worldTime: WorldTime
  ): { ok: boolean; account?: PlayerCashAccount; error?: string } {
    if (amount <= 0) {
      return { ok: false, error: "Amount must be positive" };
    }

    const existing = this.playerCash.get(playerId);
    const next: PlayerCashAccount = {
      playerId,
      balance: (existing?.balance ?? 0) + amount,
      totalCashIn: (existing?.totalCashIn ?? 0) + amount,
      totalCashOut: existing?.totalCashOut ?? 0,
      lastCashOutTick: existing?.lastCashOutTick,
      version: (existing?.version ?? 0) + 1,
    };
    this.playerCash.set(playerId, next);

    return { ok: true, account: next };
  }

  // ── Abfragen ─────────────────────────────────────────────────

  getGameResults(gameType?: CasinoGameType): CasinoGameResult[] {
    if (!gameType) {
      const all: CasinoGameResult[] = [];
      for (const results of this.gameResults.values()) {
        all.push(...results);
      }
      return all;
    }
    return this.gameResults.get(gameType) ?? [];
  }

  getRevenueAttribution(gameType?: CasinoGameType): CasinoRevenueAttribution[] {
    if (!gameType) {
      return Array.from(this.revenueAttribution.values());
    }
    const attr = this.revenueAttribution.get(gameType);
    return attr ? [attr] : [];
  }

  getPlayerCash(playerId: string): PlayerCashAccount | undefined {
    return this.playerCash.get(playerId);
  }

  getCashOutCallouts(): CasinoCalloutRecord[] {
    return Array.from(this.cashOutCallouts.values());
  }

  getCashOutCallout(calloutId: string): CasinoCalloutRecord | undefined {
    return this.cashOutCallouts.get(calloutId);
  }

  // ── Statistik ────────────────────────────────────────────────

  getStats(): {
    totalGames: number;
    totalBets: number;
    totalWins: number;
    netRevenue: number;
    totalPlayers: number;
    totalCashOuts: number;
    totalCashOutAmount: number;
  } {
    const allResults = this.getGameResults();
    const totalBets = allResults.reduce((sum, r) => sum + r.betAmount, 0);
    const totalWins = allResults.reduce((sum, r) => sum + r.winAmount, 0);
    const netRevenue = totalBets - totalWins;
    const callouts = this.getCashOutCallouts();
    const totalCashOutAmount = callouts.reduce((sum, c) => sum + c.amount, 0);

    return {
      totalGames: allResults.length,
      totalBets,
      totalWins,
      netRevenue,
      totalPlayers: this.playerCash.size,
      totalCashOuts: callouts.length,
      totalCashOutAmount,
    };
  }
}

export const casinoIntegration = new CasinoIntegration();