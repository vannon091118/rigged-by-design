import { describe, it, expect, beforeEach } from "vitest";
import {
  ActorRegistry,
  actorRegistry,
  type ActorKind,
  type PresenceState,
} from "../../src/core/actor-registry.js";
import { VisitorRetention, getVisitorRetention } from "../../src/core/visitor-presence.js";

describe("Actor Registry (Phase 2.1)", () => {
  let registry: ActorRegistry;

  beforeEach(() => {
    registry = new ActorRegistry({ visitorCap: 40 });
  });

  it("registers a stable actor identity", () => {
    const result = registry.registerIdentity("actor-1", "player", "Spieler", 0);
    expect(result.ok).toBe(true);
    expect(result.identity?.id).toBe("actor-1");
    expect(result.identity?.kind).toBe("player");
    expect(result.identity?.archivedAtTick).toBeUndefined();
  });

  it("rejects duplicate actor registration", () => {
    registry.registerIdentity("actor-1", "player", "Spieler", 0);
    const result = registry.registerIdentity("actor-1", "visitor", "Besucher", 1);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("already registered");
  });

  it("gets identity by id", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    const identity = registry.getIdentity("actor-1");
    expect(identity).toBeDefined();
    expect(identity!.displayName).toBe("NPC");
  });

  it("archives an identity without destroying it", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    const result = registry.archiveIdentity("actor-1", 100);
    expect(result.ok).toBe(true);

    const identity = registry.getIdentity("actor-1");
    expect(identity?.archivedAtTick).toBe(100);
    // Identität existiert noch — keine Vernichtung
    expect(registry.listIdentities().length).toBe(1);
  });

  it("restores an archived identity", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    registry.archiveIdentity("actor-1", 100);
    const result = registry.restoreIdentity("actor-1", 200);
    expect(result.ok).toBe(true);

    const identity = registry.getIdentity("actor-1");
    expect(identity?.archivedAtTick).toBeUndefined();
  });

  it("rejects archiving unknown actor", () => {
    const result = registry.archiveIdentity("unknown", 100);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not found");
  });

  it("sets presence for a registered actor", () => {
    registry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    const result = registry.setPresence("actor-1", { state: "present" }, 50);
    expect(result.ok).toBe(true);
    expect(result.presence?.state).toBe("present");
  });

  it("rejects presence for archived actor", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    registry.archiveIdentity("actor-1", 100);
    const result = registry.setPresence("actor-1", { state: "present" }, 150);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("archived");
  });

  it("visitor becomes guest when entering casino", () => {
    registry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    const result = registry.enterAsGuest("actor-1", "casino-floor", "gast", "session-1", 50);
    expect(result.ok).toBe(true);
    expect(result.presence?.state).toBe("guest");
    expect(result.presence?.locationId).toBe("casino-floor");
    expect(result.presence?.roleId).toBe("gast");
  });

  it("guest leaves and writes back to identity", () => {
    registry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    registry.enterAsGuest("actor-1", "casino-floor", "gast", "session-1", 50);
    const result = registry.leaveGuest("actor-1", 100, true);
    expect(result.ok).toBe(true);
    expect(result.presence?.state).toBe("present");

    const identity = registry.getIdentity("actor-1");
    expect(identity?.metadata["lastGuestLocation"]).toBe("casino-floor");
    expect(identity?.metadata["lastGuestRole"]).toBe("gast");
  });

  it("rejects leaving guest who is not a guest", () => {
    registry.registerIdentity("actor-1", "visitor", "Besucher", 0);
    const result = registry.leaveGuest("actor-1", 50);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not a guest");
  });

  it("welcomes back an absent NPC", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    registry.setPresence("actor-1", { state: "absent" }, 50);
    const result = registry.welcomeBack("actor-1", 100);
    expect(result.ok).toBe(true);
  });

  it("rejects welcome back for archived actor", () => {
    registry.registerIdentity("actor-1", "npc", "NPC", 0);
    registry.archiveIdentity("actor-1", 100);
    const result = registry.welcomeBack("actor-1", 200);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("archived");
  });

  it("changes role for present actor", () => {
    registry.registerIdentity("actor-1", "staff", "Mitarbeiter", 0);
    registry.setPresence("actor-1", { state: "present" }, 0);
    const result = registry.changeRole("actor-1", "dealer", 50);
    expect(result.ok).toBe(true);
  });

  it("registers unknown contact as visitor", () => {
    const result = registry.registerUnknownContact("Unbekannt", 100);
    expect(result.ok).toBe(true);
    expect(result.actorId).toBeDefined();
    const identity = registry.getIdentity(result.actorId!);
    expect(identity?.kind).toBe("visitor");
  });

  it("enforces visitor cap on active presences", () => {
    const smallRegistry = new ActorRegistry({ visitorCap: 2 });
    smallRegistry.registerIdentity("a1", "visitor", "A1", 0);
    smallRegistry.registerIdentity("a2", "visitor", "A2", 0);
    smallRegistry.registerIdentity("a3", "visitor", "A3", 0);

    smallRegistry.setPresence("a1", { state: "present" }, 0);
    smallRegistry.setPresence("a2", { state: "present" }, 0);
    const result = smallRegistry.setPresence("a3", { state: "present" }, 0);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("Visitor cap");
  });

  it("visitor cap does not destroy persistent identity", () => {
    const smallRegistry = new ActorRegistry({ visitorCap: 1 });
    smallRegistry.registerIdentity("a1", "visitor", "A1", 0);
    smallRegistry.registerIdentity("a2", "visitor", "A2", 0);

    smallRegistry.setPresence("a1", { state: "present" }, 0);
    const result = smallRegistry.setPresence("a2", { state: "present" }, 0);
    expect(result.ok).toBe(false);

    // Beide Identitäten existieren noch
    expect(smallRegistry.getIdentity("a1")).toBeDefined();
    expect(smallRegistry.getIdentity("a2")).toBeDefined();
  });

  it("counts active presences correctly", () => {
    registry.registerIdentity("a1", "visitor", "A1", 0);
    registry.registerIdentity("a2", "npc", "NPC", 0);
    registry.setPresence("a1", { state: "present" }, 0);
    registry.setPresence("a2", { state: "guest" }, 0);
    expect(registry.countActivePresences()).toBe(2);
    expect(registry.countByState("absent")).toBe(0);
  });

  it("isKnownAndActive returns false for archived", () => {
    registry.registerIdentity("a1", "npc", "NPC", 0);
    expect(registry.isKnownAndActive("a1")).toBe(true);
    registry.archiveIdentity("a1", 100);
    expect(registry.isKnownAndActive("a1")).toBe(false);
  });
});

describe("Visitor Retention (Phase 2.1)", () => {
  it("records a visit and creates snapshot", () => {
    actorRegistry.registerIdentity("v1", "visitor", "Besucher", 0);
    const result = getVisitorRetention().recordVisit("v1", 50, true);
    expect(result.ok).toBe(true);
    expect(result.snapshot?.visitCount).toBe(1);
    expect(result.snapshot?.isReturningVisitor).toBe(false);
  });

  it("detects returning visitor", () => {
    actorRegistry.registerIdentity("v2", "visitor", "Besucher", 0);
    getVisitorRetention().recordVisit("v2", 50, false);
    getVisitorRetention().recordVisit("v2", 100, false);
    const snapshot = getVisitorRetention().getSnapshot("v2");
    expect(snapshot?.visitCount).toBe(2);
    expect(snapshot?.isReturningVisitor).toBe(true);
  });

  it("retention is independent of visitor cap — never destroys identity", () => {
    const smallReg = new ActorRegistry({ visitorCap: 1 });
    const retention = new VisitorRetention(smallReg, { visitorCap: 1 });

    smallReg.registerIdentity("v1", "visitor", "V1", 0);
    smallReg.registerIdentity("v2", "visitor", "V2", 0);

    smallReg.setPresence("v1", { state: "present" }, 0);
    const result = smallReg.setPresence("v2", { state: "present" }, 0);
    expect(result.ok).toBe(false); // cap reached

    // Aber beide sind in der Retention bekannt
    retention.recordVisit("v1", 10, false);
    retention.recordVisit("v2", 10, false);
    expect(retention.countKnownVisitors()).toBe(2);
  });

  it("counts known visitors independently of hot set", () => {
    // countKnownVisitors returns the total number of recorded visitors
    expect(getVisitorRetention().countKnownVisitors()).toBeGreaterThanOrEqual(0);
    actorRegistry.registerIdentity("v1", "visitor", "V1", 0);
    getVisitorRetention().recordVisit("v1", 10, false);
    expect(getVisitorRetention().countKnownVisitors()).toBeGreaterThanOrEqual(1);
  });

  it("reports available hot set slots", () => {
    actorRegistry.registerIdentity("v1", "visitor", "V1", 0);
    actorRegistry.registerIdentity("v2", "visitor", "V2", 0);
    actorRegistry.setPresence("v1", { state: "present" }, 0);
    expect(getVisitorRetention().availableHotSetSlots()).toBe(39);
  });

  it("reports when hot set is full", () => {
    const smallReg = new ActorRegistry({ visitorCap: 1 });
    const retention = new VisitorRetention(smallReg, { visitorCap: 1 });
    smallReg.registerIdentity("v1", "visitor", "V1", 0);
    smallReg.setPresence("v1", { state: "present" }, 0);
    expect(retention.isHotSetFull()).toBe(true);
  });
});
