/**
 * Access Policy - Phase 7.5
 * Zugangs-Policy separat modelliert: public, private, residents-only.
 * Liegt bei Raum/Gebäude und ist orthogonal zu Rolle/Profil.
 */

export type AccessPolicy = "public" | "private" | "residents-only";

export interface AccessRule {
  readonly roomId: string;
  readonly policy: AccessPolicy;
  readonly allowedActorIds: Set<string>; // für residents-only
  readonly version: number;
  readonly updatedAtTick: number;
}

export class AccessPolicyEngine {
  private rules = new Map<string, AccessRule>();

  /**
   * Setzt die Zugriffspolicy für einen Raum.
   */
  setPolicy(
    roomId: string,
    policy: AccessPolicy,
    allowedActorIds: string[] = [],
    tick: number = 0
  ): void {
    this.rules.set(roomId, {
      roomId,
      policy,
      allowedActorIds: new Set(allowedActorIds),
      version: 1,
      updatedAtTick: tick,
    });
  }

  /**
   * Prüft ob ein Actor einen Raum betreten darf.
   * Orthogonal zu Rolle/Profil.
   */
  canEnter(roomId: string, actorId: string): { allowed: boolean; policy: AccessPolicy; reason?: string } {
    const rule = this.rules.get(roomId);
    if (!rule) {
      return { allowed: true, policy: "public", reason: "No policy - default public" };
    }

    switch (rule.policy) {
      case "public":
        return { allowed: true, policy: "public" };
      case "private":
        return { allowed: false, policy: "private", reason: "Private room" };
      case "residents-only":
        if (rule.allowedActorIds.has(actorId)) {
          return { allowed: true, policy: "residents-only" };
        }
        return { allowed: false, policy: "residents-only", reason: "Not a resident" };
      default:
        return { allowed: true, policy: "public" };
    }
  }

  getPolicy(roomId: string): AccessPolicy | undefined {
    return this.rules.get(roomId)?.policy;
  }

  listPolicies(): AccessRule[] {
    return Array.from(this.rules.values());
  }
}

export const accessPolicyEngine = new AccessPolicyEngine();