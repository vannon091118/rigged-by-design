/**
 * Room Profile - Phase 7.3
 * Abgeleitetes Raumprofil mit inkrementellem Cache.
 *
 * P[room][role] = Σ(weightBps × conditionFactor × capacityFactor)
 * in Integer-/Festkomma-Arithmetik.
 *
 * Room-Profile werden nicht in Save-State kopiert (berechnet aus Geometrie/Objektinstanzen).
 */

import type { WorldTime } from "../sim/worldtime";
import type { RoleId } from "../sim/role-manifest";

export interface RoomProfileEntry {
  readonly roleId: RoleId;
  readonly weightBps: number;       // aggregiertes Gewicht in Basis-Punkten
  readonly contributionCount: number; // Anzahl der beitragenden Objekte
  readonly lastUpdatedTick: number;
}

export interface RoomProfile {
  readonly roomId: string;
  readonly profile: Map<RoleId, number>; // roleId -> weightBps (aggregiert, gekappt)
  readonly entries: Map<RoleId, RoomProfileEntry>;
  readonly revision: number;
  readonly calculatedAtTick: number;
  readonly isStale: boolean;
}

export interface RoomObjectInstance {
  readonly objectId: string;
  readonly furnitureId: string;
  readonly roomId: string;
  readonly x: number;
  readonly y: number;
  readonly isDefective: boolean;
  readonly stock: number | undefined; // undefined = keine Lagerabhängigkeit
  readonly stockCapacity: number | undefined;
  readonly lastUpdatedTick: number;
}

export interface RoomProfileConfig {
  readonly maxWeightBps: number;       // 10000 = 100%
  readonly capacityDiminishingReturns: boolean;
  readonly capacityExponent: number;   // 0.5 = Wurzelgesetz für abnehmenden Grenzertrtrag
}

export const DEFAULT_ROOM_PROFILE_CONFIG: RoomProfileConfig = {
  maxWeightBps: 10000,
  capacityDiminishingReturns: true,
  capacityExponent: 0.5,
};

/**
 * Berechnet den capacityFactor mit abnehmendem Grenzertrtrag.
 * Zehn gleiche Geräte erzeugen nicht zehnmal so viel wie eines.
 */
export function capacityFactor(
  count: number,
  config: RoomProfileConfig
): number {
  if (count <= 0) return 0;
  if (!config.capacityDiminishingReturns) return Math.min(count, 1);
  // Wurzelgesetz: sqrt(count) für abnehmenden Grenzertrtrag
  return Math.sqrt(count);
}

/**
 * Berechnet den conditionFactor aus Betriebszustand.
 * Defekte/gesperrte Objekte tragen 0 bei.
 * Stock=0 trägt nur bei lagerabhängigen Objekten 0 bei.
 */
export function conditionFactor(
  instance: RoomObjectInstance
): number {
  // Defekte Objekte tragen 0
  if (instance.isDefective) return 0;

  // Lagerabhängige Objekte mit leerem Bestand tragen 0
  if (instance.stock !== undefined && instance.stockCapacity !== undefined) {
    if (instance.stock <= 0) return 0;
  }

  // Nicht-lagerabhängige Objekte verlieren nicht ihre Funktion
  return 1;
}

export class RoomProfileCalculator {
  private profiles = new Map<string, RoomProfile>();
  private roomInstances = new Map<string, RoomObjectInstance[]>(); // roomId -> instances
  private readonly config: RoomProfileConfig;

  constructor(config: Partial<RoomProfileConfig> = {}) {
    this.config = { ...DEFAULT_ROOM_PROFILE_CONFIG, ...config };
  }

  /**
   * Registriert Objektinstanzen für einen Raum.
   */
  setRoomInstances(roomId: string, instances: RoomObjectInstance[]): void {
    this.roomInstances.set(roomId, instances);
    this.profiles.delete(roomId); // Markiere als veraltet
  }

  /**
   * Berechnet das RoomProfile für einen Raum (mit Cache).
   * Gleiche Eingaben/Revisionen ergeben gleiche Werte.
   */
  calculateProfile(
    roomId: string,
    furnitureRegistry: Map<string, { roleWeightsBps: Record<string, number> }>,
    currentTick: number
  ): RoomProfile {
    const existing = this.profiles.get(roomId);
    const instances = this.roomInstances.get(roomId) || [];

    // Prüfe ob Recalculate nötig (einfache Revision-basierte Invaliderung)
    if (existing && !existing.isStale && existing.calculatedAtTick === currentTick) {
      return existing;
    }

    const profileMap = new Map<RoleId, number>();
    const entries = new Map<RoleId, RoomProfileEntry>();

    for (const instance of instances) {
      const furnitureDef = furnitureRegistry.get(instance.furnitureId);
      if (!furnitureDef) continue;

      const condFactor = conditionFactor(instance);
      if (condFactor === 0) continue;

      const capFactor = capacityFactor(
        this.countInstancesForFurniture(roomId, instance.furnitureId),
        this.config
      );

      for (const [roleId, weightBps] of Object.entries(furnitureDef.roleWeightsBps)) {
        if (weightBps <= 0) continue;

        // Festkomma-Arithmetik: weightBps × conditionFactor × capacityFactor
        const weightedContribution = Math.round(
          weightBps * condFactor * capFactor
        );

        const current = profileMap.get(roleId) ?? 0;
        const newWeight = Math.min(
          this.config.maxWeightBps,
          current + weightedContribution
        );

        profileMap.set(roleId, newWeight);

        const existingEntry = entries.get(roleId);
        entries.set(roleId, {
          roleId: roleId as RoleId,
          weightBps: newWeight,
          contributionCount: (existingEntry?.contributionCount ?? 0) + 1,
          lastUpdatedTick: currentTick,
        });
      }
    }

    const profile: RoomProfile = {
      roomId,
      profile: profileMap,
      entries,
      revision: (existing?.revision ?? 0) + 1,
      calculatedAtTick: currentTick,
      isStale: false,
    };

    this.profiles.set(roomId, profile);
    return profile;
  }

  private countInstancesForFurniture(roomId: string, furnitureId: string): number {
    const instances = this.roomInstances.get(roomId) || [];
    return instances.filter((i) => i.furnitureId === furnitureId).length;
  }

  /**
   * Markiert ein RoomProfile als veraltet (z.B. nach Objektänderung).
   * Nur betroffene Räume invalidieren.
   */
  invalidateProfile(roomId: string): void {
    const existing = this.profiles.get(roomId);
    if (existing) {
      this.profiles.set(roomId, { ...existing, isStale: true });
    }
  }

  getProfile(roomId: string): RoomProfile | undefined {
    return this.profiles.get(roomId);
  }

  listProfiles(): RoomProfile[] {
    return Array.from(this.profiles.values());
  }
}

export const roomProfileCalculator = new RoomProfileCalculator();