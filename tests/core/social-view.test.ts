/**
 * Social View Tests — Phase 6
 * Testet Ego-Netzwerk, Influence Inspector und Beziehungsprofil.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  SocialView,
  socialView,
  type SocialViewConfig,
} from "../../src/core/social-view.js";
import {
  buildEgoNetworkView,
  type EgoNetworkView,
} from "../../src/core/ego-network.js";
import {
  analyzeInfluence,
  type InfluenceAnalysis,
} from "../../src/core/influence-inspector.js";
import {
  buildRelationshipProfile,
  type RelationshipProfile,
} from "../../src/core/relationship-profile.js";
import {
  RelationshipEdge,
  type RelationshipDimension,
} from "../../src/core/relationship-engine.js";
import { FactorSnapshot } from "../../src/core/factor-resolver.js";
import { createWorldTime } from "../../src/core/sim/worldtime.js";

function makeWorldTime(tick: number) {
  return createWorldTime(tick);
}

function makeEdge(
  fromActorId: string,
  toActorId: string,
  dimension: RelationshipDimension,
  score: number,
  tick: number = 100
): RelationshipEdge {
  return {
    fromActorId,
    toActorId,
    dimension,
    score,
    lastUpdatedTick: tick,
    sourceEventId: undefined,
  };
}

function makeSnapshot(
  totalWeightBps: number = 0,
  normalizedScore: number = 0,
  contributions: Array<{
    factorId: string;
    weightBps: number;
    normalizedValue: number;
    sourceId: string;
    appliedAtTick: number;
    context: string;
    explanation: string;
  }> = []
): FactorSnapshot {
  return {
    context: {
      actingActorId: "actor-1",
      action: "test",
      situation: "social",
      worldTime: createWorldTime(100),
      sourceId: "test-source",
    },
    contributions: contributions.map((c) => ({
      factorId: c.factorId,
      sourceId: c.sourceId,
      rawValue: c.normalizedValue,
      normalizedValue: c.normalizedValue,
      weightBps: c.weightBps,
      appliedAtTick: c.appliedAtTick,
      context: c.context as any,
      explanation: c.explanation,
    })),
    totalWeightBps,
    normalizedScore,
    appliedAtTick: 100,
    deterministic: true,
  };
}

describe("Social View (Phase 6)", () => {
  let socialView: SocialView;

  beforeEach(() => {
    socialView = new SocialView({
      egoActorId: "player",
      egoDisplayName: "Spieler",
      actorNames: new Map([
        ["npc-1", "NPC Eins"],
        ["npc-2", "NPC Zwei"],
      ]),
    });
  });

  describe("Ego-Netzwerk", () => {
    it("baut Ego-Netzwerk aus Kanten auf", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 50),
        makeEdge("player", "npc-2", "sympathy", -30),
        makeEdge("npc-1", "npc-2", "conflict", 20), // Nicht direkt mit Ego verbunden
      ];

      const view = socialView.buildEgoNetwork(edges, makeWorldTime(100));

      expect(view.egoActorId).toBe("player");
      expect(view.nodes.length).toBe(2); // npc-1 und npc-2
      expect(view.totalConnections).toBe(2);
    });

    it("berechnet korrekte Dispositionen", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 80), // intimate
        makeEdge("player", "npc-2", "trust", -50), // hostile
      ];

      const view = socialView.buildEgoNetwork(edges, makeWorldTime(100));

      const npc1 = view.nodes.find((n) => n.actorId === "npc-1");
      const npc2 = view.nodes.find((n) => n.actorId === "npc-2");

      expect(npc1?.disposition).toBe("intimate");
      expect(npc2?.disposition).toBe("hostile");
    });

    it("rendert Ego-Netzwerk", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 50),
      ];

      const view = socialView.buildEgoNetwork(edges, makeWorldTime(100));
      const html = socialView.renderEgoNetwork(view);

      expect(html).toContain("Spieler");
      expect(html).toContain("NPC Eins");
    });
  });

  describe("Influence Inspector", () => {
    it("analysiert Einfluss-Faktoren", () => {
      const snapshot = makeSnapshot(5000, 0.5, [
        {
          factorId: "rapport",
          weightBps: 3000,
          normalizedValue: 0.6,
          sourceId: "s1",
          appliedAtTick: 100,
          context: "social",
          explanation: "Rapport durch Geschenk",
        },
        {
          factorId: "tension",
          weightBps: -1000,
          normalizedValue: -0.2,
          sourceId: "s2",
          appliedAtTick: 100,
          context: "social",
          explanation: "Spannung durch Konflikt",
        },
      ]);

      const analysis = socialView.analyzeInfluence(snapshot);

      expect(analysis.totalWeightBps).toBe(5000);
      expect(analysis.normalizedScore).toBe(0.5);
      expect(analysis.factors.length).toBe(2);
      expect(analysis.dominantFactor?.factorId).toBe("rapport");
      expect(analysis.deterministic).toBe(true);
    });

    it("rendert Einfluss-Analyse", () => {
      const snapshot = makeSnapshot(3000, 0.3, [
        {
          factorId: "engagement",
          weightBps: 3000,
          normalizedValue: 0.6,
          sourceId: "s1",
          appliedAtTick: 100,
          context: "social",
          explanation: "Hohes Engagement",
        },
      ]);

      const analysis = socialView.analyzeInfluence(snapshot);
      const html = socialView.renderInfluenceAnalysis(analysis);

      expect(html).toContain("engagement");
      expect(html).toContain("3000bps");
    });
  });

  describe("Beziehungsprofil", () => {
    it("baut Beziehungsprofil auf", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 60),
        makeEdge("player", "npc-1", "sympathy", 30),
        makeEdge("player", "npc-1", "conflict", -10),
        makeEdge("player", "npc-1", "influence", 20),
      ];

      const profile = socialView.buildRelationshipProfile(
        "player",
        "npc-1",
        edges,
        null,
        makeWorldTime(100)
      );

      expect(profile.actorId).toBe("player");
      expect(profile.otherActorId).toBe("npc-1");
      expect(profile.trust).toBe(60);
      expect(profile.sympathy).toBe(30);
      expect(profile.conflict).toBe(-10);
      expect(profile.influence).toBe(20);
      expect(profile.overallScore).toBe(30); // (60+30-(-10)+20)/4 = 30
      expect(profile.overallDisposition).toBe("friendly");
    });

    it("rendert Beziehungsprofil", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 60),
        makeEdge("player", "npc-1", "sympathy", 30),
        makeEdge("player", "npc-1", "conflict", -10),
        makeEdge("player", "npc-1", "influence", 20),
      ];

      const profile = socialView.buildRelationshipProfile(
        "player",
        "npc-1",
        edges,
        null,
        makeWorldTime(100)
      );
      const html = socialView.renderRelationshipProfile(profile);

      expect(html).toContain("player");
      expect(html).toContain("npc-1");
      expect(html).toContain("friendly");
    });
  });

  describe("Kombinierte soziale Übersicht", () => {
    it("rendert soziale Übersicht", () => {
      const edges: RelationshipEdge[] = [
        makeEdge("player", "npc-1", "trust", 50),
      ];

      const egoNetwork = socialView.buildEgoNetwork(edges, makeWorldTime(100));
      const profile = socialView.buildRelationshipProfile(
        "player",
        "npc-1",
        edges,
        null,
        makeWorldTime(100)
      );

      const html = socialView.renderSocialOverview(egoNetwork, [profile], null);

      expect(html).toContain("Spieler");
      expect(html).toContain("NPC Eins");
      expect(html).toContain("Beziehungsprofile");
      expect(html).toContain("Einfluss-Analyse");
    });
  });
});