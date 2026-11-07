/**
 * Casino Integration Tests — Phase 6
 * Testet die Casino-Domain Integration mit allgemeinen Verträgen.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CasinoIntegration,
  casinoIntegration,
  type CasinoGameType,
  type CasinoGameResult,
  type CasinoRevenueAttribution,
  type PlayerCashAccount,
  type CasinoCalloutRecord,
} from "../../src/core/casino-integration.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeWorldTime(tick: number) {
  return createWorldTime(tick);
}

const GAME_TYPES: CasinoGameType[] = [
  "SLOT",
  "BLACKJACK",
  "POKER",
  "ROULETTE",
  "PLINKO",
  "SHELL",
  "DICE",
];

describe("Casino Integration (Phase 6)", () => {
  let casino: CasinoIntegration;

  beforeEach(() => {
    casino = new CasinoIntegration();
  });

  describe("Spiel-Ergebnisse", () => {
    it("zeichnet Slot-Ergebnis auf", () => {
      const worldTime = makeWorldTime(100);
      const result = casino.recordGameResult("SLOT", "player-1", 100, 150, worldTime);

      expect(result.ok).toBe(true);
      expect(result.result?.gameType).toBe("SLOT");
      expect(result.result?.playerId).toBe("player-1");
      expect(result.result?.betAmount).toBe(100);
      expect(result.result?.winAmount).toBe(150);
      expect(result.result?.netResult).toBe(50);
      expect(result.event).toBeDefined();
    });

    it("zeichnet Blackjack-Verlust auf", () => {
      const worldTime = makeWorldTime(200);
      const result = casino.recordGameResult("BLACKJACK", "player-2", 200, 0, worldTime);

      expect(result.ok).toBe(true);
      expect(result.result?.gameType).toBe("BLACKJACK");
      expect(result.result?.netResult).toBe(-200);
    });

    it("lehnt ungültigen Betrag ab", () => {
      const result = casino.recordGameResult("SLOT", "player-1", 0, 0, makeWorldTime(100));
      expect(result.ok).toBe(false);
      expect(result.error).toContain("positive");

      const result2 = casino.recordGameResult("SLOT", "player-1", -50, 0, makeWorldTime(100));
      expect(result2.ok).toBe(false);
    });

    it("lehnt zu hohen Betrag ab", () => {
      const result = casino.recordGameResult("SLOT", "player-1", 20000, 0, makeWorldTime(100));
      expect(result.ok).toBe(false);
      expect(result.error).toContain("max");
    });

    it("gibt alle Spiel-Ergebnisse zurück", () => {
      casino.recordGameResult("SLOT", "player-1", 100, 150, makeWorldTime(100));
      casino.recordGameResult("BLACKJACK", "player-2", 200, 100, makeWorldTime(200));

      const all = casino.getGameResults();
      expect(all.length).toBe(2);

      const slots = casino.getGameResults("SLOT");
      expect(slots.length).toBe(1);
      expect(slots[0].gameType).toBe("SLOT");
    });

    it("ist deterministisch", () => {
      const worldTime = makeWorldTime(1000);
      const r1 = casino.recordGameResult("SLOT", "player-1", 100, 150, worldTime);
      const r2 = casino.recordGameResult("SLOT", "player-1", 100, 150, worldTime);

      expect(r1.result?.transactionId).not.toBe(r2.result?.transactionId);
      expect(r1.result?.netResult).toBe(r2.result?.netResult);
    });
  });

  describe("Revenue Attribution", () => {
    it("aktualisiert Revenue Attribution pro Spieltyp", () => {
      casino.recordGameResult("SLOT", "player-1", 100, 150, makeWorldTime(100));
      casino.recordGameResult("SLOT", "player-2", 200, 50, makeWorldTime(200));

      const attrs = casino.getRevenueAttribution("SLOT");
      expect(attrs.length).toBe(1);
      expect(attrs[0].gameType).toBe("SLOT");
      expect(attrs[0].totalBets).toBe(300);
      expect(attrs[0].totalWins).toBe(200);
      expect(attrs[0].netRevenue).toBe(100);
      expect(attrs[0].playerCount).toBe(2);
    });

    it("listet alle Revenue Attributions auf", () => {
      casino.recordGameResult("SLOT", "player-1", 100, 150, makeWorldTime(100));
      casino.recordGameResult("POKER", "player-2", 300, 100, makeWorldTime(200));

      const all = casino.getRevenueAttribution();
      expect(all.length).toBe(7); // Alle 7 Spieltypen
    });

    it("hat alle 7 Spieltypen initialisiert", () => {
      const all = casino.getRevenueAttribution();
      const types = all.map((a) => a.gameType);
      for (const gt of GAME_TYPES) {
        expect(types).toContain(gt);
      }
    });
  });

  describe("Player Cash (PLAYER_CASH)", () => {
    it("zahlt Geld ein", () => {
      const result = casino.cashIn("player-1", 500, makeWorldTime(100));
      expect(result.ok).toBe(true);
      expect(result.account?.balance).toBe(500);
      expect(result.account?.totalCashIn).toBe(500);
    });

    it("zahlt Geld aus (Production Cash-out)", () => {
      casino.cashIn("player-1", 1000, makeWorldTime(100));

      const result = casino.cashOut("player-1", 300, makeWorldTime(200), "production-cashier-1");
      expect(result.ok).toBe(true);
      expect(result.record?.playerId).toBe("player-1");
      expect(result.record?.amount).toBe(300);
      expect(result.record?.productionCaller).toBe("production-cashier-1");
      expect(result.event).toBeDefined();
    });

    it("lehnt Cash-out bei unzureichendem Guthaben ab", () => {
      const result = casino.cashOut("player-1", 500, makeWorldTime(100), "cashier");
      expect(result.ok).toBe(false);
      expect(result.error).toContain("Insufficient");
    });

    it("verfolgt Cash-out Historie", () => {
      casino.cashIn("player-1", 1000, makeWorldTime(100));
      casino.cashOut("player-1", 300, makeWorldTime(200), "cashier-1");
      casino.cashOut("player-1", 200, makeWorldTime(300), "cashier-2");

      const callouts = casino.getCashOutCallouts();
      expect(callouts.length).toBe(2);
      expect(callouts[0].productionCaller).toBe("cashier-1");
      expect(callouts[1].productionCaller).toBe("cashier-2");
    });

    it("gibt Spieler-Konto zurück", () => {
      casino.cashIn("player-1", 500, makeWorldTime(100));
      const account = casino.getPlayerCash("player-1");
      expect(account).toBeDefined();
      expect(account?.balance).toBe(500);
    });
  });

  describe("Statistiken", () => {
    it("liefert korrekte Statistiken", () => {
      casino.recordGameResult("SLOT", "player-1", 100, 150, makeWorldTime(100));
      casino.recordGameResult("BLACKJACK", "player-2", 200, 100, makeWorldTime(200));
      casino.cashIn("player-1", 500, makeWorldTime(300));
      casino.cashOut("player-1", 100, makeWorldTime(400), "cashier");

      const stats = casino.getStats();
      expect(stats.totalGames).toBe(2);
      expect(stats.totalBets).toBe(300);
      expect(stats.totalWins).toBe(250);
      expect(stats.netRevenue).toBe(50);
      expect(stats.totalPlayers).toBe(2); // player-1 und player-2
      expect(stats.totalCashOuts).toBe(1);
      expect(stats.totalCashOutAmount).toBe(100);
    });
  });
});