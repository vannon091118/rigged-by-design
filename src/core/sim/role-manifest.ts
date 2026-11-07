/**
 * Role Manifest — Versioned role definitions for objects.
 * Phase 1.3: Role IDs are open/extensible (gambling, drinks, food,
 * retail, retail.clothing, social, ...). Objects receive a fixed-point
 * vector role -> weight.
 */

export type RoleId = string;

export interface RoleDefinition {
  readonly id: RoleId;
  readonly label: string;
  readonly domain: string;
  readonly version: string;
  readonly description: string;
}

export interface RoleWeightEntry {
  readonly roleId: RoleId;
  /** Weight in basis points (0..10000), fixed-point */
  readonly weightBps: number;
}

export interface ObjectRoleVector {
  readonly objectId: string;
  readonly weights: Map<RoleId, number>; // roleId -> weightBps
}

export class RoleManifest {
  private roles = new Map<RoleId, RoleDefinition>();
  private objectVectors = new Map<string, ObjectRoleVector>();

  registerRole(role: RoleDefinition): { ok: boolean; role?: RoleDefinition; error?: string } {
    if (!role.id || !role.domain || !role.version) {
      return { ok: false, error: "Role must have id, domain, and version" };
    }
    // Idempotent only for the identical definition. The same id with a
    // different domain or version is contract drift, not a harmless retry.
    const existing = this.roles.get(role.id);
    if (existing) {
      if (existing.domain !== role.domain || existing.version !== role.version) {
        return {
          ok: false,
          role: existing,
          error: `Role ${role.id} already registered as ${existing.domain}@${existing.version}; refusing ${role.domain}@${role.version}`,
        };
      }
      return { ok: true, role: existing };
    }
    this.roles.set(role.id, role);
    return { ok: true, role };
  }

  getRole(roleId: RoleId): RoleDefinition | undefined {
    return this.roles.get(roleId);
  }

  listRoles(): RoleDefinition[] {
    return Array.from(this.roles.values());
  }

  setObjectRoleVector(objectId: string, entries: RoleWeightEntry[]): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    const weights = new Map<RoleId, number>();

    let totalBps = 0;
    for (const entry of entries) {
      if (!this.roles.has(entry.roleId)) {
        errors.push(`Unknown roleId: ${entry.roleId}`);
        continue;
      }
      if (entry.weightBps < 0 || entry.weightBps > 10000) {
        errors.push(`Weight for ${entry.roleId} out of range [0,10000]: ${entry.weightBps}`);
        continue;
      }
      totalBps += entry.weightBps;
      weights.set(entry.roleId, entry.weightBps);
    }

    if (totalBps > 10000) {
      errors.push(`Total weight ${totalBps}bps exceeds 10000bps (100%)`);
    }

    if (errors.length > 0) return { ok: false, errors };

    this.objectVectors.set(objectId, { objectId, weights });
    return { ok: true, errors: [] };
  }

  getObjectRoleVector(objectId: string): ObjectRoleVector | undefined {
    return this.objectVectors.get(objectId);
  }

  getWeight(objectId: string, roleId: RoleId): number {
    const vec = this.objectVectors.get(objectId);
    return vec?.weights.get(roleId) ?? 0;
  }
}

export const roleManifest = new RoleManifest();

// Built-in extensible role IDs (open/extensible)
export const BUILTIN_ROLES: RoleDefinition[] = [
  { id: "gambling", label: "Gambling", domain: "casino", version: "1.0.0", description: "Gambling-related object" },
  { id: "drinks", label: "Drinks", domain: "hospitality", version: "1.0.0", description: "Beverage-serving object" },
  { id: "food", label: "Food", domain: "hospitality", version: "1.0.0", description: "Food-serving object" },
  { id: "retail", label: "Retail", domain: "commerce", version: "1.0.0", description: "General retail object" },
  { id: "retail.clothing", label: "Clothing Retail", domain: "commerce", version: "1.0.0", description: "Clothing store object" },
  { id: "social", label: "Social", domain: "social", version: "1.0.0", description: "Social interaction object" },
];

// Register built-in roles on module load
for (const role of BUILTIN_ROLES) {
  roleManifest.registerRole(role);
}