/**
 * Communication Domain Tests — Phase 5
 * Ende-zu-End-Beweis mit den fünf Szenarien (A–E):
 * A: Spieler tätigt ausgehenden Anruf
 * B: Spieler erhält eingehenden Anruf von NPC
 * C: Spieler sendet Nachricht
 * D: NPC initiiert Kontakt (Anruf oder Nachricht)
 * E: Verpasster Anruf und Rückruf
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  CommunicationDomain,
  communicationDomain,
  NPCContactPlanner,
  npcContactPlanner,
  type Call,
  type CommunicationStatus,
  type Contact,
  type Message,
} from "../../src/core/communication.js";
import { renderCallView, renderDialer, renderCommunicationHistory, callStatusLabel } from "../../src/core/communication-view.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    actorId: "contact-1",
    displayName: "Test Kontakt",
    relationshipScore: 50,
    lastContactTick: undefined,
    contactCount: 0,
    blocked: false,
    favorite: false,
    ...overrides,
  };
}

function makeWorldTime(tick: number) {
  return createWorldTime(tick);
}

describe("Phase 5 — Communication Domain", () => {
  let comm: CommunicationDomain;

  beforeEach(() => {
    comm = new CommunicationDomain();
    comm.upsertContact(makeContact({ actorId: "npc-1", displayName: "NPC Eins" }));
    comm.upsertContact(makeContact({ actorId: "player", displayName: "Spieler" }));
    comm.upsertContact(makeContact({ actorId: "npc-2", displayName: "NPC Zwei", blocked: true }));
  });

  describe("Szenario A: Spieler tätigt ausgehenden Anruf", () => {
    it("A1: Spieler wählt NPC und Anruf klingelt", () => {
      const worldTime = makeWorldTime(100);
      const result = comm.startCall("player", "npc-1", worldTime);

      expect(result.ok).toBe(true);
      expect(result.call?.direction).toBe("outbound");
      expect(result.call?.callerId).toBe("player");
      expect(result.call?.calleeId).toBe("npc-1");
      expect(result.call?.status).toBe("ringing");
    });

    it("A2: Anruf an blockierten Kontakt wird abgelehnt", () => {
      const worldTime = makeWorldTime(100);
      const result = comm.startCall("player", "npc-2", worldTime);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("blocked");
    });

    it("A3: Unbekannter Kontakt kann nicht angerufen werden", () => {
      const worldTime = makeWorldTime(100);
      const result = comm.startCall("player", "unknown", worldTime);

      expect(result.ok).toBe(false);
      expect(result.error).toContain("not found");
    });

    it("A4: Anruf annehmen und beenden", () => {
      const worldTime = makeWorldTime(100);
      const startResult = comm.startCall("player", "npc-1", worldTime);
      expect(startResult.ok).toBe(true);

      const answerResult = comm.answerCall(startResult.call!.callId, makeWorldTime(105));
      expect(answerResult.ok).toBe(true);
      expect(comm.getCall(startResult.call!.callId)?.status).toBe("active");

      const endResult = comm.endCall(startResult.call!.callId, makeWorldTime(120));
      expect(endResult.ok).toBe(true);
      expect(endResult.call?.status).toBe("completed");
      expect(endResult.call?.durationTicks).toBe(15); // 120 - 105
    });
  });

  describe("Szenario B: Spieler erhält eingehenden Anruf von NPC", () => {
    it("B1: NPC startet eingehenden Anruf an Spieler", () => {
      const worldTime = makeWorldTime(200);
      const result = comm.startCall("npc-1", "player", worldTime);

      expect(result.ok).toBe(true);
      expect(result.call?.direction).toBe("outbound");
      expect(result.call?.callerId).toBe("npc-1");
      expect(result.call?.calleeId).toBe("player");
      expect(result.call?.status).toBe("ringing");
    });

    it("B2: Spieler nimmt den Anruf an", () => {
      const startResult = comm.startCall("npc-1", "player", makeWorldTime(200));
      expect(startResult.ok).toBe(true);

      const answerResult = comm.answerCall(startResult.call!.callId, makeWorldTime(205));
      expect(answerResult.ok).toBe(true);
      expect(comm.getCall(startResult.call!.callId)?.status).toBe("active");
    });

    it("B3: Spieler lehnt den Anruf ab (als verpasst markiert)", () => {
      const startResult = comm.startCall("npc-1", "player", makeWorldTime(200));
      expect(startResult.ok).toBe(true);

      const missResult = comm.missCall(startResult.call!.callId, makeWorldTime(210));
      expect(missResult.ok).toBe(true);
      expect(comm.getCall(startResult.call!.callId)?.status).toBe("missed");
      expect(comm.getCall(startResult.call!.callId)?.missedReason).toBe("ring_timeout");
    });
  });

  describe("Szenario C: Spieler sendet Nachricht", () => {
    it("C1: Spieler sendet Nachricht an NPC", () => {
      const worldTime = makeWorldTime(300);
      const result = comm.sendMessage("player", "npc-1", "Hallo, wie geht es dir?", worldTime);

      expect(result.ok).toBe(true);
      expect(result.message?.direction).toBe("outbound");
      expect(result.message?.senderId).toBe("player");
      expect(result.message?.recipientId).toBe("npc-1");
      expect(result.message?.content).toBe("Hallo, wie geht es dir?");
      expect(result.message?.status).toBe("delivered");
    });

    it("C2: Leere Nachricht wird abgelehnt", () => {
      const result = comm.sendMessage("player", "npc-1", "", makeWorldTime(300));
      expect(result.ok).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("C3: Zu lange Nachricht wird abgelehnt", () => {
      const longContent = "x".repeat(1001);
      const result = comm.sendMessage("player", "npc-1", longContent, makeWorldTime(300));
      expect(result.ok).toBe(false);
      expect(result.error).toContain("too long");
    });

    it("C4: Nachricht als gelesen markieren", () => {
      const sendResult = comm.sendMessage("player", "npc-1", "Les mich", makeWorldTime(300));
      expect(sendResult.ok).toBe(true);

      const readResult = comm.readMessage(sendResult.message!.messageId, makeWorldTime(310));
      expect(readResult.ok).toBe(true);
      expect(comm.getMessage(sendResult.message!.messageId)?.status).toBe("read");
      expect(comm.getMessage(sendResult.message!.messageId)?.readAtTick).toBe(310);
    });
  });

  describe("Szenario D: NPC initiiert Kontakt (Anruf oder Nachricht)", () => {
    let planner: NPCContactPlanner;

    beforeEach(() => {
      planner = new NPCContactPlanner(comm);
    });

    it("D1: NPC plant einen Anruf zum späteren Zeitpunkt", () => {
      planner.planContact(
        "npc-1",
        "player",
        "call",
        500,
        "Möchte sich verabreden",
        7
      );

      const plans = planner.listPlans("npc-1");
      expect(plans.length).toBe(1);
      expect(plans[0].action).toBe("call");
      expect(plans[0].scheduledAtTick).toBe(500);
      expect(plans[0].priority).toBe(7);
    });

    it("D2: NPC plant eine Nachricht", () => {
      planner.planContact(
        "npc-1",
        "player",
        "message",
        600,
        "Erinnerung an Termin",
        5
      );

      const plans = planner.listPlans("npc-1");
      expect(plans.length).toBe(1);
      expect(plans[0].action).toBe("message");
    });

    it("D3: Fällige Pläne werden ausgeführt (Anruf)", () => {
      planner.planContact("npc-1", "player", "call", 500, "Anruf", 5);
      const duePlans = planner.getDuePlans("npc-1", 500);
      expect(duePlans.length).toBe(1);

      const result = planner.executePlan(duePlans[0], makeWorldTime(500));
      expect(result.ok).toBe(true);
      expect(comm.getCall(result.call!.callId)?.status).toBe("ringing");
    });

    it("D4: Fällige Pläne werden ausgeführt (Nachricht)", () => {
      planner.planContact("npc-1", "player", "message", 500, "Nachricht", 5);
      const duePlans = planner.getDuePlans("npc-1", 500);
      expect(duePlans.length).toBe(1);

      const result = planner.executePlan(duePlans[0], makeWorldTime(500));
      expect(result.ok).toBe(true);
      expect(comm.getMessage(result.message!.messageId)?.status).toBe("delivered");
    });

    it("D5: Pläne sind nach Priorität sortiert", () => {
      planner.planContact("npc-1", "player", "message", 500, "Niedrige Priorität", 2);
      planner.planContact("npc-1", "player", "call", 500, "Hohe Priorität", 9);

      const plans = planner.listPlans("npc-1");
      expect(plans[0].priority).toBe(9);
      expect(plans[1].priority).toBe(2);
    });
  });

  describe("Szenario E: Verpasster Anruf und Rückruf", () => {
    it("E1: Anruf wird als verpasst markiert bei Ring-Timeout", () => {
      const startResult = comm.startCall("npc-1", "player", makeWorldTime(700));
      expect(startResult.ok).toBe(true);

      // 40 Ticks später (nach Ring-Timeout von 30)
      const missResult = comm.missCall(startResult.call!.callId, makeWorldTime(740));
      expect(missResult.ok).toBe(true);
      expect(comm.getCall(startResult.call!.callId)?.status).toBe("missed");
    });

    it("E2: Spieler ruft zurück nach verpasstem Anruf", () => {
      // Erst verpasster Anruf
      const startResult = comm.startCall("npc-1", "player", makeWorldTime(700));
      comm.missCall(startResult.call!.callId, makeWorldTime(740));

      // Dann Rückruf
      const callbackResult = comm.startCall("player", "npc-1", makeWorldTime(800));
      expect(callbackResult.ok).toBe(true);
      expect(callbackResult.call?.direction).toBe("outbound");
      expect(callbackResult.call?.calleeId).toBe("npc-1");
    });

    it("E3: Verpasste Anrufe werden in der Historie angezeigt", () => {
      const startResult = comm.startCall("npc-1", "player", makeWorldTime(700));
      comm.missCall(startResult.call!.callId, makeWorldTime(740));

      const missedCalls = comm.listCalls("player").filter((c) => c.status === "missed");
      expect(missedCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Communication View (UI)", () => {
    it("rendert eingehenden Anruf mit Annehmen/Ablehnen", () => {
      const call: Call = {
        callId: "call-1",
        direction: "inbound",
        callerId: "npc-1",
        calleeId: "player",
        status: "ringing",
        durationTicks: 0,
      };

      const html = renderCallView({
        call,
        onAnswer: () => {},
        onReject: () => {},
        onHangup: () => {},
        onDial: () => {},
      });

      expect(html).toContain("Annehmen");
      expect(html).toContain("Ablehnen");
      expect(html).toContain("npc-1");
    });

    it("rendert aktiven Anruf mit Auflegen", () => {
      const call: Call = {
        callId: "call-2",
        direction: "outbound",
        callerId: "player",
        calleeId: "npc-1",
        status: "active",
        startedAtTick: 100,
        endedAtTick: undefined,
        durationTicks: 20,
      };

      const html = renderCallView({
        call,
        onAnswer: () => {},
        onReject: () => {},
        onHangup: () => {},
        onDial: () => {},
      });

      expect(html).toContain("Auflegen");
      expect(html).toContain("20");
    });

    it("rendert Dialer", () => {
      const html = renderDialer({ onDial: () => {} });
      expect(html).toContain("dialer");
      expect(html).toContain("Wählen");
    });

    it("rendert Kommunikations-Historie", () => {
      const calls: Call[] = [
        {
          callId: "c1",
          direction: "outbound",
          callerId: "player",
          calleeId: "npc-1",
          status: "completed",
          durationTicks: 30,
        },
        {
          callId: "c2",
          direction: "inbound",
          callerId: "npc-1",
          calleeId: "player",
          status: "missed",
          missedReason: "ring_timeout",
        },
      ];

      const html = renderCommunicationHistory(calls);
      expect(html).toContain("npc-1");
      expect(html).toContain("completed");
      expect(html).toContain("missed");
    });

    it("callStatusLabel gibt korrekte Labels", () => {
      expect(callStatusLabel("ringing")).toBe("Klingelt");
      expect(callStatusLabel("active")).toBe("Aktiv");
      expect(callStatusLabel("missed")).toBe("Verpasst");
      expect(callStatusLabel("completed")).toBe("Beendet");
      expect(callStatusLabel("blocked")).toBe("Blockiert");
    });
  });

  describe("Statistics", () => {
    it("liefert korrekte Kommunikations-Statistiken", () => {
      comm.startCall("player", "npc-1", makeWorldTime(100));
      comm.sendMessage("player", "npc-1", "Hallo", makeWorldTime(200));
      comm.upsertContact(makeContact({ actorId: "blocked", blocked: true }));

      const stats = comm.getStats();
      expect(stats.contacts).toBe(4); // npc-1, player, npc-2, blocked
      expect(stats.blockedContacts).toBe(2); // npc-2 + blocked contact
      expect(stats.totalCalls).toBe(1);
      expect(stats.totalMessages).toBe(1);
    });
  });
});

