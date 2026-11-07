/**
 * Role Definitions - Phase 7.2
 * Offener Objektrollen-Katalog mit stabilen, namespaced IDs.
 * Rollen sind keine Persönlichkeitswerte und werden nicht in Factor-Snapshots persistiert.
 */

import type { RoleDefinition } from "../role-manifest";
import { roleRegistry } from "./role-registry";
import { roleManifest } from "../role-manifest";

// Standard-Rollenregistrierung (fail-closed, idempotent)
export const STANDARD_ROLES: RoleDefinition[] = [
  {
    id: "gambling",
    label: "Gambling",
    domain: "casino",
    version: "1.0.0",
    description: "Glücksspiel-bezogenes Objekt",
  },
  {
    id: "drinks",
    label: "Drinks",
    domain: "hospitality",
    version: "1.0.0",
    description: "Getränke-ausgebendes Objekt",
  },
  {
    id: "food",
    label: "Food",
    domain: "hospitality",
    version: "1.0.0",
    description: "Lebensmittel-ausgebendes Objekt",
  },
  {
    id: "retail",
    label: "Retail",
    domain: "commerce",
    version: "1.0.0",
    description: "Einzelhandels-Objekt",
  },
  {
    id: "retail.clothing",
    label: "Clothing Retail",
    domain: "commerce",
    version: "1.0.0",
    description: "Bekleidungs-Einzelhandels-Objekt",
  },
  {
    id: "social",
    label: "Social",
    domain: "social",
    version: "1.0.0",
    description: "Soziales Interaktions-Objekt",
  },
];

/**
 * Registriert alle Standard-Rollen im Registry.
 * Idempotent: mehrfache Aufrufe sind sicher.
 */
export function registerStandardRoles(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const role of STANDARD_ROLES) {
    const result = roleRegistry.registerRole(role);
    if (!result.ok) {
      errors.push(result.error!);
    }
  }
  return { ok: errors.length === 0, errors };
}

/**
 * Prüft ob eine Rolle existiert (fail-closed).
 */
export function isValidRole(roleId: string): boolean {
  return roleRegistry.isKnownRole(roleId);
}

/**
 * Gibt alle registrierten Rollen zurück.
 */
export function listAllRoles(): RoleDefinition[] {
  return roleManifest.listRoles();
}

/**
 * Prüft ob eine Rolle zu einer bestimmten Domain gehört.
 */
export function getRoleDomain(roleId: string): string | undefined {
  const role = roleManifest.getRole(roleId);
  return role?.domain;
}