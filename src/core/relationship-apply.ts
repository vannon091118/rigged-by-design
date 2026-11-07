/**
 * Relationship Apply — Phase 3.1
 * Wendet Beziehungsänderungen ausschließlich über definierte Ereignisse/Kommandos an.
 * Entkoppelt von der Narrative-Grenze: Narrative liest Beziehungen, verändert sie
 * aber nicht direkt. Alle Änderungen gehen über die Relationship Engine.
 */

import type { WorldTime } from "./sim/worldtime";
import type { DomainEvent, EventType } from "./domain-event";
import {
  RelationshipEngine,
  relationshipEngine,
  createRelationshipCommand,
  type RelationshipCommand,
  type RelationshipDimension,
} from "./relationship-engine";
import type { ActorRegistry } from "./actor-registry";
import { actorRegistry } from "./actor-registry";

/**
 * Event-Typen, die Beziehungsänderungen auslösen können.
 */
export const RELATIONSHIP_EVENT_TYPES = {
  TRUST_CHANGED: "relationship.trust-changed",
  SYMPATHY_CHANGED: "relationship.sympathy-changed",
  CONFLICT_CHANGED: "relationship.conflict-changed",
  INFLUENCE_CHANGED: "relationship.influence-changed",
} as const;

/**
 * Ergebnis einer Beziehungserstellung durch ein Event.
 */
export interface RelationshipEventResult {
  ok: boolean;
  edgesApplied: number;
  errors: string[];
}

/**
 * Wendet ein Domain-Event auf die Relationship Engine an.
 * Nur Events, die eine Beziehungsänderung bedeuten, werden verarbeitet.
 * Dies ist der einzige autorisierte Weg, wie Narrative oder andere Domänen
 * Beziehungen ändern dürfen.
 */
export function applyRelationshipEvent(
  event: DomainEvent<EventType>,
  engine: RelationshipEngine = relationshipEngine
): RelationshipEventResult {
  const errors: string[] = [];
  let edgesApplied = 0;

  const cmd = eventToCommand(event);
  if (!cmd) {
    // Kein Beziehungs-relevantes Event — nichts anwenden
    return { ok: true, edgesApplied: 0, errors: [] };
  }

  // Prüfen ob beide Akteure bekannt sind
  if (!actorRegistry.getIdentity(cmd.fromActorId)) {
    errors.push(`Unknown actor: ${cmd.fromActorId}`);
    return { ok: false, edgesApplied: 0, errors };
  }
  if (!actorRegistry.getIdentity(cmd.toActorId)) {
    errors.push(`Unknown actor: ${cmd.toActorId}`);
    return { ok: false, edgesApplied: 0, errors };
  }

  const result = engine.applyCommand(cmd);
  if (result.ok) {
    edgesApplied = 1;
  } else {
    errors.push(result.error ?? "Command failed");
  }

  return { ok: errors.length === 0, edgesApplied, errors };
}

/**
 * Konvertiert ein Domain-Event in ein RelationshipCommand.
 * Gibt null zurück, wenn das Event keine Beziehung ändert.
 */
function eventToCommand(event: DomainEvent<EventType>): RelationshipCommand | null {
  const { type, payload, actorId, createdAtTick } = event;

  // Wir benötigen eine WorldTime-Instanz; hier erstellen wir eine minimale
  // aus dem Event-Kontext (die echte WorldTime kommt vom Simulator).
  const worldTime = { tick: createdAtTick, day: 0, tickInDay: 0, ms: 0 } as WorldTime;

  switch (type) {
    case "relationship.changed": {
      // Generisches Beziehungs-Event mit spezifischer Dimension im Payload
      const targetId = payload["targetActorId"] as string;
      const dimension = payload["dimension"] as RelationshipDimension;
      const delta = payload["delta"] as number;
      const reason = payload["reason"] as string ?? "relationship.changed";

      if (!targetId || !dimension || delta === undefined) {
        return null;
      }

      return createRelationshipCommand(
        "adjust-trust", // generisch mapped auf trust, spezifische Dimensionen werden unten behandelt
        actorId,
        targetId,
        dimension,
        delta,
        worldTime,
        reason,
        event.id
      );
    }

    case "gift.given":
    case "compliment":
    case "favor.done":
      return createRelationshipCommand(
        "adjust-trust",
        actorId,
        payload["targetActorId"] as string,
        "trust",
        (payload["delta"] as number) ?? 50,
        worldTime,
        `${type}: positive interaction`,
        event.id
      );

    case "insult":
    case "betrayal":
    case "conflict.started":
      return createRelationshipCommand(
        "adjust-conflict",
        actorId,
        payload["targetActorId"] as string,
        "conflict",
        (payload["delta"] as number) ?? -50,
        worldTime,
        `${type}: negative interaction`,
        event.id
      );

    case "relationship.trust-changed":
      return createRelationshipCommand(
        "adjust-trust",
        actorId,
        payload["targetActorId"] as string,
        "trust",
        payload["delta"] as number,
        worldTime,
        payload["reason"] as string ?? "trust.changed",
        event.id
      );

    case "relationship.sympathy-changed":
      return createRelationshipCommand(
        "adjust-trust",
        actorId,
        payload["targetActorId"] as string,
        "sympathy",
        payload["delta"] as number,
        worldTime,
        payload["reason"] as string ?? "sympathy.changed",
        event.id
      );

    case "relationship.conflict-changed":
      return createRelationshipCommand(
        "adjust-conflict",
        actorId,
        payload["targetActorId"] as string,
        "conflict",
        payload["delta"] as number,
        worldTime,
        payload["reason"] as string ?? "conflict.changed",
        event.id
      );

    case "relationship.influence-changed":
      return createRelationshipCommand(
        "adjust-trust",
        actorId,
        payload["targetActorId"] as string,
        "influence",
        payload["delta"] as number,
        worldTime,
        payload["reason"] as string ?? "influence.changed",
        event.id
      );

    default:
      return null;
  }
}

/**
 * Erstellt eine Stapel von Befehlen aus mehreren Events und wendet sie
 * atomisch an (Transaktion).
 */
export function applyRelationshipEvents(
  events: DomainEvent<EventType>[],
  engine: RelationshipEngine = relationshipEngine
): RelationshipEventResult {
  const cmds: RelationshipCommand[] = [];
  const errors: string[] = [];

  for (const event of events) {
    const cmd = eventToCommand(event);
    if (cmd) {
      cmds.push(cmd);
    }
  }

  if (cmds.length === 0) {
    return { ok: true, edgesApplied: 0, errors: [] };
  }

  const result = engine.applyCommands(cmds);
  return {
    ok: result.ok,
    edgesApplied: result.ok ? result.edges.length : 0,
    errors: result.errors,
  };
}

/**
 * Migration: Wandelt bestehende einfache Relationship-Objekte (aus relationship.ts)
 * in das neue gerichtete Edge-Modell um. Jede Dimension wird als separate Edge
 * erstellt, die alte symmetrische Annahme wird aufgelöst.
 */
export function migrateLegacyRelationships(
  legacyRelationships: Array<{
    actorId: string;
    otherActorId: string;
    score: number;
    disposition?: string;
  }>,
  engine: RelationshipEngine = relationshipEngine,
  worldTime: WorldTime
): { migrated: number; errors: string[] } {
  const errors: string[] = [];
  let migrated = 0;

  for (const rel of legacyRelationships) {
    if (!actorRegistry.getIdentity(rel.actorId)) {
      errors.push(`Unknown actor: ${rel.actorId}`);
      continue;
    }
    if (!actorRegistry.getIdentity(rel.otherActorId)) {
      errors.push(`Unknown actor: ${rel.otherActorId}`);
      continue;
    }

    // Alte symmetrische Beziehung wird in 4 getrennte Dimensionen aufgeteilt.
    // Keine automatische Symmetrie: jeder Actor hat seine eigene Perspektive.
    const cmds = [
      "trust",
      "sympathy",
      "conflict",
      "influence",
    ].map((dimension) =>
      createRelationshipCommand(
        "adjust-trust",
        rel.actorId,
        rel.otherActorId,
        dimension as RelationshipDimension,
        rel.score / 4, // gleicher Anteil pro Dimension
        worldTime,
        `migrated from legacy relationship (${rel.disposition ?? "neutral"})`
      )
    );

    const result = engine.applyCommands(cmds);
    if (result.ok) {
      migrated++;
    } else {
      errors.push(...result.errors);
    }
  }

  return { migrated, errors };
}