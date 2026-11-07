/**
 * Room Cache - Phase 7.3
 * Cache mit strukturellem Schlüssel/Revision aus Layout-Kanten,
 * Objektdefinitionen, Instanzzustand, Reparatur-/Lagerzustand und
 * relevanten Kapazitätsänderungen. Nur betroffene Räume invalidieren.
 * Invertierter Index role -> room IDs für Top-K-Raumsuchen.
 */

import type { RoomProfile } from "./room-profile";
import type { WorldTime } from "../sim/worldtime";

export interface CacheKey {
  readonly layoutRevision: number;
  readonly objectRevision: number;
  readonly instanceRevision: number;
  readonly repairStateRevision: number;
  readonly capacityRevision: number;
}

export interface CacheEntry {
  readonly key: CacheKey;
  readonly profiles: Map<string, RoomProfile>;
  readonly roleIndex: Map<string, string[]>; // roleId -> roomId[]
  readonly calculatedAtTick: number;
}

export interface RoomCacheConfig {
  readonly maxProfiles: number;
}

export const DEFAULT_ROOM_CACHE_CONFIG: RoomCacheConfig = {
  maxProfiles: 10000,
};

export class RoomCache {
  private cache: CacheEntry | null = null;
  private readonly config: RoomCacheConfig;
  private layoutRevision = 0;
  private objectRevision = 0;
  private instanceRevision = 0;
  private repairStateRevision = 0;
  private capacityRevision = 0;

  constructor(config: Partial<RoomCacheConfig> = {}) {
    this.config = { ...DEFAULT_ROOM_CACHE_CONFIG, ...config };
  }

  /**
   * Generiert einen strukturellen Cache-Schlüssel aus allen relevanten
   * Änderungen. Nur betroffene Räume invalidieren bei Teiländerungen.
   */
  private generateKey(): CacheKey {
    return {
      layoutRevision: this.layoutRevision,
      objectRevision: this.objectRevision,
      instanceRevision: this.instanceRevision,
      repairStateRevision: this.repairStateRevision,
      capacityRevision: this.capacityRevision,
    };
  }

  /**
   * Prüft ob der Cache noch gültig ist (gleicher Schlüssel).
   */
  isValid(key: CacheKey): boolean {
    if (!this.cache) return false;
    return (
      this.cache.key.layoutRevision === key.layoutRevision &&
      this.cache.key.objectRevision === key.objectRevision &&
      this.cache.key.instanceRevision === key.instanceRevision &&
      this.cache.key.repairStateRevision === key.repairStateRevision &&
      this.cache.key.capacityRevision === key.capacityRevision
    );
  }

  /**
   * Gibt das gecachte Profil zurück oder null bei Cache-Miss.
   */
  get(key: CacheKey): CacheEntry | null {
    if (!this.isValid(key)) return null;
    return this.cache;
  }

  /**
   * Speichert ein neues Cache-Entry.
   * Alte Profile für Räume, die sich nicht geändert haben, werden beibehalten.
   */
  set(
    key: CacheKey,
    profiles: Map<string, RoomProfile>,
    roleIndex: Map<string, string[]>,
    calculatedAtTick: number
  ): void {
    this.cache = {
      key,
      profiles,
      roleIndex,
      calculatedAtTick,
    };
  }

  /**
   * Invalidiert nur betroffene Räume (nicht den gesamten Cache).
   */
  invalidateRooms(roomIds: string[]): void {
    if (!this.cache) return;

    const newProfiles = new Map(this.cache.profiles);
    const newRoleIndex = new Map(this.cache.roleIndex);

    for (const roomId of roomIds) {
      newProfiles.delete(roomId);

      // Entferne Raum aus allen Rollen-Indizes
      for (const [roleId, roomIds] of newRoleIndex) {
        const filtered = roomIds.filter((id) => id !== roomId);
        if (filtered.length > 0) {
          newRoleIndex.set(roleId, filtered);
        } else {
          newRoleIndex.delete(roleId);
        }
      }
    }

    this.cache = {
      ...this.cache,
      profiles: newProfiles,
      roleIndex: newRoleIndex,
    };
  }

  /**
   * Top-K-Raumsuchen über viele Räume mittels invertiertem Index.
   * Index ist regenerierbarer Cache.
   */
  getRoomsByRole(roleId: string): string[] {
    if (!this.cache) return [];
    return this.cache.roleIndex.get(roleId) ?? [];
  }

  /**
   * Räume sortiert nach Profil-Gewicht für eine Rolle (Top-K).
   */
  getTopRoomsByRole(
    roleId: string,
    profiles: Map<string, RoomProfile>,
    limit: number = 10
  ): Array<{ roomId: string; weightBps: number }> {
    const roomIds = this.getRoomsByRole(roleId);
    const scored = roomIds
      .map((roomId) => {
        const profile = profiles.get(roomId);
        const weight = profile?.profile.get(roleId) ?? 0;
        return { roomId, weightBps: weight };
      })
      .filter((entry) => entry.weightBps > 0)
      .sort((a, b) => b.weightBps - a.weightBps);

    return scored.slice(0, limit);
  }

  // Revision-Inkrementierung für strukturelle Änderungen

  incrementLayoutRevision(): void {
    this.layoutRevision++;
  }

  incrementObjectRevision(): void {
    this.objectRevision++;
  }

  incrementInstanceRevision(): void {
    this.instanceRevision++;
  }

  incrementRepairStateRevision(): void {
    this.repairStateRevision++;
  }

  incrementCapacityRevision(): void {
    this.capacityRevision++;
  }

  getCurrentKey(): CacheKey {
    return this.generateKey();
  }

  getStats(): {
    readonly cachedProfiles: number;
    readonly cachedRoles: number;
    readonly isValid: boolean;
  } {
    return {
      cachedProfiles: this.cache?.profiles.size ?? 0,
      cachedRoles: this.cache?.roleIndex.size ?? 0,
      isValid: !!this.cache,
    };
  }
}

export const roomCache = new RoomCache();