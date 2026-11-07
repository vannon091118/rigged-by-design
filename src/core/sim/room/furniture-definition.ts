/**
 * Furniture Definition - Phase 7.2
 * Objektdefinitionen mit roleWeightsBps: Record<RoleId, integer>.
 * Furniture.kind bleibt Übergangs-/Technikdiscriminator.
 * Rollenvektoren sind Definition-/Content-Daten, Instanzzustand separat.
 */

import type { RoleId } from "../sim/role-manifest";
import { roleRegistry } from "./role-registry";
import { roleManifest } from "../sim/role-manifest";

export interface FurnitureDefinition {
  readonly id: string;
  readonly kind: string; // Übergangs-/Technikdiscriminator
  readonly label: string;
  readonly domain: string;
  readonly version: string;
  readonly roleWeightsBps: Record<RoleId, number>; // roleId -> weightBps (0..10000)
  readonly description?: string;
}

export interface FurnitureDefinitionConfig {
  readonly failClosed: boolean;
}

export const DEFAULT_FURNITURE_DEFINITION_CONFIG: FurnitureDefinitionConfig = {
  failClosed: true,
};

export class FurnitureDefinitionRegistry {
  private definitions = new Map<string, FurnitureDefinition>();
  private readonly config: FurnitureDefinitionConfig;

  constructor(config: Partial<FurnitureDefinitionConfig> = {}) {
    this.config = { ...DEFAULT_FURNITURE_DEFINITION_CONFIG, ...config };
  }

  /**
   * Registriert eine Furniture-Definition. Fail-closed: unbekannte RoleIds
   * in roleWeightsBps blockieren die Registrierung.
   */
  registerDefinition(def: FurnitureDefinition): { ok: boolean; error?: string } {
    if (!def.id || !def.kind || !def.domain || !def.version) {
      return { ok: false, error: "Definition must have id, kind, domain, and version" };
    }

    // Fail-closed: prüfe alle roleWeightsBps
    const roleIds = Object.keys(def.roleWeightsBps);
    const validation = roleRegistry.validateRoles(roleIds);
    if (!validation.ok) {
      return {
        ok: false,
        error: `Invalid role weights: ${validation.errors.join(", ")}`,
      };
    }

    // Prüfe Gewichtsbereich
    for (const [roleId, weight] of Object.entries(def.roleWeightsBps)) {
      if (weight < 0 || weight > 10000) {
        return {
          ok: false,
          error: `Weight for ${roleId} out of range [0,10000]: ${weight}`,
        };
      }
    }

    this.definitions.set(def.id, def);
    return { ok: true };
  }

  getDefinition(id: string): FurnitureDefinition | undefined {
    return this.definitions.get(id);
  }

  listDefinitions(): FurnitureDefinition[] {
    return Array.from(this.definitions.values());
  }

  /**
   * Gibt die Rolle-Gewichte für eine Furniture-Definition zurück.
   * Rollenvektoren sind Definition-Daten, nicht Instanzzustand.
   */
  getRoleWeights(id: string): Record<RoleId, number> | undefined {
    const def = this.definitions.get(id);
    return def?.roleWeightsBps;
  }

  /**
   * Prüft ob eine Furniture eine bestimmte Rolle hat.
   */
  hasRole(id: string, roleId: RoleId): boolean {
    const def = this.definitions.get(id);
    return def?.roleWeightsBps[roleId] !== undefined && def.roleWeightsBps[roleId]! > 0;
  }

  /**
   * Gibt alle Rollen für eine Furniture zurück (nur solche mit weight > 0).
   */
  getRolesForFurniture(id: string): Array<{ roleId: RoleId; weightBps: number }> {
    const def = this.definitions.get(id);
    if (!def) return [];
    return Object.entries(def.roleWeightsBps)
      .filter(([, weight]) => weight > 0)
      .map(([roleId, weight]) => ({ roleId: roleId as RoleId, weightBps: weight }));
  }
}

export const furnitureDefinitionRegistry = new FurnitureDefinitionRegistry();

// Registriere Standard-Möbel-Definitionen
export function registerStandardFurniture(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const standardDefinitions: FurnitureDefinition[] = [
    {
      id: "slot-machine-01",
      kind: "gaming-machine",
      label: "Slot Machine",
      domain: "casino",
      version: "1.0.0",
      roleWeightsBps: { gambling: 8000, social: 1000 },
      description: "Spielautomat mit Glücksspiel-Rolle",
    },
    {
      id: "blackjack-table-01",
      kind: "gaming-table",
      label: "Blackjack Table",
      domain: "casino",
      version: "1.0.0",
      roleWeightsBps: { gambling: 9000, social: 1000 },
      description: "Blackjack-Tisch",
    },
    {
      id: "bar-counter-01",
      kind: "service-counter",
      label: "Bar Counter",
      domain: "hospitality",
      version: "1.0.0",
      roleWeightsBps: { drinks: 7000, social: 3000 },
      description: "Theke für Getränke",
    },
    {
      id: "restaurant-table-01",
      kind: "dining-table",
      label: "Restaurant Table",
      domain: "hospitality",
      version: "1.0.0",
      roleWeightsBps: { food: 6000, social: 4000 },
      description: "Tisch im Restaurant",
    },
    {
      id: "clothing-rack-01",
      kind: "retail-rack",
      label: "Clothing Rack",
      domain: "commerce",
      version: "1.0.0",
      roleWeightsBps: { "retail.clothing": 9000, retail: 1000 },
      description: "Kleiderständer im Einzelhandel",
    },
    {
      id: "sofa-01",
      kind: "social-furniture",
      label: "Sofa",
      domain: "social",
      version: "1.0.0",
      roleWeightsBps: { social: 8000 },
      description: "Sofa für soziale Interaktion",
    },
  ];

  for (const def of standardDefinitions) {
    const result = registerFurnitureDefinition(def);
    if (!result.ok) {
      errors.push(result.error!);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function registerFurnitureDefinition(def: FurnitureDefinition): { ok: boolean; error?: string } {
  return furnitureDefinitionRegistry.registerDefinition(def);
}

export function getFurnitureDefinition(id: string): FurnitureDefinition | undefined {
  return furnitureDefinitionRegistry.getDefinition(id);
}

export function listFurnitureDefinitions(): FurnitureDefinition[] {
  return furnitureDefinitionRegistry.listDefinitions();
}