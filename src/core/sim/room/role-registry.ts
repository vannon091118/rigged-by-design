/**
 * Role Registry - Phase 7.2
 * Offener Objektrollen-Katalog als Teil des Phase-1.3-Manifest-Systems.
 * Rollen erhalten stabile, namespaced IDs.
 * Fail-closed Prüfung: unbekannte RoleId, ungültiger Wertebereich,
 * doppelte IDs, fehlende Domain-Owner oder inkompatible Version blockieren den Import.
 */

import type { RoleDefinition } from "../role-manifest";
import { roleManifest } from "../role-manifest";

export interface RoleDomainOwner {
  readonly domainId: string;
  readonly owner: string;
  readonly version: string;
}

export interface RoleCatalogConfig {
  readonly failClosed: boolean;
  readonly allowCrossDomainRoles: boolean;
}

export const DEFAULT_ROLE_CATALOG_CONFIG: RoleCatalogConfig = {
  failClosed: true,
  allowCrossDomainRoles: false,
};

export class RoleRegistry {
  private domains = new Map<string, RoleDomainOwner>();
  private readonly config: RoleCatalogConfig;

  constructor(config: Partial<RoleCatalogConfig> = {}) {
    this.config = { ...DEFAULT_ROLE_CATALOG_CONFIG, ...config };
  }

  /**
   * Registriert eine Domain als Owner für Rollen.
   */
  registerDomain(domainId: string, owner: string, version: string): { ok: boolean; error?: string } {
    if (!domainId || !owner || !version) {
      return { ok: false, error: "Domain must have domainId, owner, and version" };
    }
    if (this.domains.has(domainId)) {
      return { ok: false, error: `Domain ${domainId} already registered` };
    }
    this.domains.set(domainId, { domainId, owner, version });
    return { ok: true };
  }

  /**
   * Registriert eine Rolle im Katalog. Fail-closed: unbekannte Domain
   * oder inkompatible Version blockieren die Registrierung.
   */
  registerRole(role: RoleDefinition): { ok: boolean; error?: string } {
    // Prüfe ob Domain existiert
    const domainOwner = this.domains.get(role.domain);
    if (!domainOwner) {
      return { ok: false, error: `Unknown domain: ${role.domain}` };
    }

    // Prüfe Version-Kompatibilität
    if (domainOwner.version !== role.version) {
      return {
        ok: false,
        error: `Version mismatch: domain ${role.domain} expects ${domainOwner.version}, role has ${role.version}`,
      };
    }

    // Idempotente Registrierung über roleManifest
    const result = roleManifest.registerRole(role);
    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    return { ok: true };
  }

  /**
   * Prüft ob eine RoleId bekannt ist (fail-closed).
   */
  isKnownRole(roleId: string): boolean {
    return roleManifest.getRole(roleId) !== undefined;
  }

  /**
   * Validiert eine RoleId. Wirft bei unbekannt (fail-closed).
   */
  validateRole(roleId: string): { ok: boolean; error?: string } {
    if (!this.isKnownRole(roleId)) {
      return { ok: false, error: `Unknown roleId: ${roleId}` };
    }
    return { ok: true };
  }

  /**
   * Validiert mehrere RoleIds. Fail-closed: erste unbekannte ID bricht ab.
   */
  validateRoles(roleIds: string[]): { ok: boolean; errors: string[] } {
    const errors: string[] = [];
    for (const roleId of roleIds) {
      const result = this.validateRole(roleId);
      if (!result.ok) {
        errors.push(result.error!);
        if (this.config.failClosed) {
          return { ok: false, errors };
        }
      }
    }
    return { ok: errors.length === 0, errors };
  }

  listDomains(): RoleDomainOwner[] {
    return Array.from(this.domains.values());
  }

  getDomain(domainId: string): RoleDomainOwner | undefined {
    return this.domains.get(domainId);
  }
}

export const roleRegistry = new RoleRegistry();

// Registriere Standard-Domains
roleRegistry.registerDomain("casino", "casino-domain", "1.0.0");
roleRegistry.registerDomain("hospitality", "hospitality-domain", "1.0.0");
roleRegistry.registerDomain("commerce", "commerce-domain", "1.0.0");
roleRegistry.registerDomain("social", "social-domain", "1.0.0");