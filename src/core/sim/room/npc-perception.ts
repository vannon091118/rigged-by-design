/**
 * NPC Perception - Phase 7.4
 * Individuelle NPC-Wahrnehmung des Raumprofils.
 * Perceived(room, actor, context)[role] = RoomProfile(room)[role] × Interest(actor, role, context)
 * als deterministischer Festkomma-Resolver.
 *
 * Wahrnehmung wird NICHT gespeichert. Sie wird bei relevanten Änderungen
 * oder Abfragen aus RoomProfile + ActorContext berechnet/gecacht.
 */

import type { RoomProfile } from "./room-profile";
import type { WorldTime } from "../sim/worldtime";

export type NeedType = "hunger" | "thirst" | "social" | "gambling" | "rest" | "shopping";

export type ActorTrait = "introvert" | "extrovert" | "gambler" | "foodie" | "socialite";

export interface ActorContext {
  readonly actorId: string;
  readonly needs: Map<NeedType, number>; // 0.0 .. 1.0
  readonly traits: Set<ActorTrait>;
  readonly persona: string | undefined;
  readonly relationshipToRoom: Map<string, number>; // roomId -> relationship score (-100 .. 100)
}

export interface PerceptionContext {
  readonly actorId: string;
  readonly roomId: string;
  readonly need: NeedType | undefined;
  readonly trait: ActorTrait | undefined;
  readonly worldTime: WorldTime;
}

export interface PerceivedProfile {
  readonly roomId: string;
  readonly actorId: string;
  readonly perceivedProfile: Map<string, number>; // roleId -> perceived weight (0..10000)
  readonly dominantRole: string | undefined;
  readonly calculatedAtTick: number;
  readonly deterministic: boolean;
}

export interface PerceptionResult {
  readonly roomId: string;
  readonly actorId: string;
  readonly role: string;
  readonly perceivedWeight: number; // 0 .. 10000
  readonly roomProfileWeight: number;
  readonly interestFactor: number;
}

export class NPCPerceptionResolver {
  private perceptionCache = new Map<string, PerceptionProfile>(); // key: actorId:roomId
  private readonly cacheRevision = 0;

  /**
   * Berechnet den Interest-Faktor für einen Actor in Bezug auf eine Rolle
   * und Kontext. Deterministisch - keine Zufallswerte.
   */
  calculateInterest(
    actorContext: ActorContext,
    roleId: string,
    context: PerceptionContext
  ): number {
    let interest = 0.5; // Basis-Interesse

    // Need-basiertes Interesse
    if (context.need && actorContext.needs.has(context.need)) {
      const needValue = actorContext.needs.get(context.need)!;
      // Hunger → food, Durst → drinks, etc.
      const needRoleMap: Record<NeedType, string> = {
        hunger: "food",
        thirst: "drinks",
        social: "social",
        gambling: "gambling",
        rest: "social",
        shopping: "retail",
      };
      if (needRoleMap[context.need] === roleId) {
        interest += needValue * 0.4; // Need verstärkt Interesse stark
      }
    }

    // Trait-basiertes Interesse
    if (context.trait && actorContext.traits.has(context.trait)) {
      const traitRoleMap: Record<ActorTrait, string> = {
        introvert: "social",
        extrovert: "social",
        gambler: "gambling",
        foodie: "food",
        socialite: "social",
      };
      if (traitRoleMap[context.trait] === roleId) {
        interest += 0.3; // Trait verstärkt Interesse
      }
    }

    // Beziehung zum Raum
    const roomRelationship = actorContext.relationshipToRoom.get(context.roomId) ?? 0;
    interest += (roomRelationship / 100) * 0.2; // Beziehung leicht modifiziert

    // Clamp auf [0, 1]
    return Math.max(0, Math.min(1, interest));
  }

  /**
   * Berechnet die wahrgenommene Raumwahrnehmung für einen Actor.
   * Perceived(room, actor, context)[role] = RoomProfile(room)[role] × Interest(actor, role, context)
   */
  perceiveRoom(
    actorId: string,
    roomId: string,
    roomProfile: RoomProfile,
    actorContext: ActorContext,
    worldTime: WorldTime,
    need?: NeedType,
    trait?: ActorTrait
  ): PerceptionProfile {
    const cacheKey = `${actorId}:${roomId}:${roomProfile.revision}`;

    // Prüfe Cache (wird bei relevanten Änderungen invalidiert)
    const cached = this.perceptionCache.get(cacheKey);
    if (cached && cached.calculatedAtTick === worldTime.tick) {
      return cached;
    }

    const perceivedProfile = new Map<string, number>();

    for (const [roleId, roomWeightBps] of roomProfile.profile) {
      const interest = this.calculateInterest(
        actorContext,
        roleId,
        {
          actorId,
          roomId,
          need,
          trait,
          worldTime,
        }
      );

      // Festkomma: roomWeightBps × interest (0..1)
      const perceivedWeight = Math.round(roomWeightBps * interest);
      perceivedProfile.set(roleId, perceivedWeight);
    }

    // Bestimme dominante Rolle
    let dominantRole: string | undefined;
    let maxWeight = 0;
    for (const [roleId, weight] of perceivedProfile) {
      if (weight > maxWeight) {
        maxWeight = weight;
        dominantRole = roleId;
      }
    }

    const result: PerceptionProfile = {
      roomId,
      actorId,
      perceivedProfile,
      dominantRole,
      calculatedAtTick: worldTime.tick,
      deterministic: true,
    };

    this.perceptionCache.set(cacheKey, result);
    return result;
  }

  /**
   * Wahrnehmung für eine spezifische Rolle abfragen.
   */
  perceiveRole(
    actorId: string,
    roomId: string,
    roomProfile: RoomProfile,
    actorContext: ActorContext,
    worldTime: WorldTime,
    roleId: string,
    need?: NeedType,
    trait?: ActorTrait
  ): PerceptionResult {
    const profile = this.perceiveRoom(
      actorId,
      roomId,
      roomProfile,
      actorContext,
      worldTime,
      need,
      trait
    );

    const roomWeight = roomProfile.profile.get(roleId) ?? 0;
    const interest = this.calculateInterest(actorContext, roleId, {
      actorId,
      roomId,
      need,
      trait,
      worldTime,
    });
    const perceivedWeight = profile.perceivedProfile.get(roleId) ?? 0;

    return {
      roomId,
      actorId,
      role: roleId,
      perceivedWeight,
      roomProfileWeight: roomWeight,
      interestFactor: interest,
    };
  }

  /**
   * Invalidiert Wahrnehmung für einen Raum (bei relevanten Änderungen).
   * NPC-Wahrnehmung wird niemals gespeichert.
   */
  invalidatePerception(roomId: string): void {
    for (const [key] of this.perceptionCache) {
      if (key.includes(`:${roomId}:`)) {
        this.perceptionCache.delete(key);
      }
    }
  }

  /**
   * Invalidiert Wahrnehmung für einen Actor.
   */
  invalidateActorPerception(actorId: string): void {
    for (const [key] of this.perceptionCache) {
      if (key.startsWith(`${actorId}:`)) {
        this.perceptionCache.delete(key);
      }
    }
  }

  getStats(): { cachedPerceptions: number } {
    return { cachedPerceptions: this.perceptionCache.size };
  }
}

export const npcPerceptionResolver = new NPCPerceptionResolver();