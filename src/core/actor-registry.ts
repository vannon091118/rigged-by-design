/**
 * Actor Registry — Phase 2.1
 * Stable Actor-IDs und zentrale Identitätsverwaltung.
 * Trennt dauerhafte Personendaten von vorübergehender Präsenz, Rolle, Ort und Session.
 */

import type { WorldTime } from "./sim/worldtime";
import { createActorId, actorIdEquals, actorIdToString } from "./actor-id";

export type ActorKind = "player" | "visitor" | "staff" | "rival" | "npc";

export type PresenceState = "absent" | "present" | "guest" | "archived";

export interface ActorIdentity {
  readonly id: string;               // stabile Actor-ID
  readonly kind: ActorKind;
  readonly createdAtTick: number;
  readonly archivedAtTick?: number;  // undefined = nicht archiviert
  readonly displayName: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Vorübergehende Präsenz — getrennt von der dauerhaften Identität.
 * Ein Visitor kann ein temporärer Guest-Aufenthalt werden, wenn er das Casino betritt.
 */
export interface ActorPresence {
  readonly actorId: string;
  readonly state: PresenceState;
  readonly locationId?: string;      // aktueller Ort (nur wenn present/guest)
  readonly roleId?: string;          // temporäre Rolle im aktuellen Kontext
  readonly sessionId?: string;       // aktuelle Session-ID
  readonly enteredAtTick?: number;   // wann der Gast-Aufenthalt begann
  readonly updatedAtTick: number;
}

export interface ActorRecord {
  readonly identity: ActorIdentity;
  readonly presence: ActorPresence;
}

export interface ActorRegistryConfig {
  readonly visitorCap: number;       // VISITOR_CAP = 40 als Hot-Set-Grenze
}

export const DEFAULT_ACTOR_REGISTRY_CONFIG: ActorRegistryConfig = {
  visitorCap: 40,
};

export class ActorRegistry {
  private identities = new Map<string, ActorIdentity>();
  private presences = new Map<string, ActorPresence>();
  private readonly config: ActorRegistryConfig;

  constructor(config: Partial<ActorRegistryConfig> = {}) {
    this.config = { ...DEFAULT_ACTOR_REGISTRY_CONFIG, ...config };
  }

  // ── Identität ──────────────────────────────────────────────

  /**
   * Registriert eine neue stabile Actor-Identität.
   * Fehlschlägt, wenn die ID bereits existiert.
   */
  registerIdentity(
    id: string,
    kind: ActorKind,
    displayName: string,
    createdAtTick: number,
    metadata: Record<string, unknown> = {}
  ): { ok: boolean; identity?: ActorIdentity; error?: string } {
    if (this.identities.has(id)) {
      return { ok: false, error: `Actor ${id} already registered` };
    }

    const identity: ActorIdentity = {
      id,
      kind,
      createdAtTick,
      archivedAtTick: undefined,
      displayName,
      metadata,
    };
    this.identities.set(id, identity);
    this.presences.set(id, {
      actorId: id,
      state: "absent",
      updatedAtTick: createdAtTick,
    });
    return { ok: true, identity };
  }

  getIdentity(actorId: string): ActorIdentity | undefined {
    return this.identities.get(actorId);
  }

  /**
   * Archiviert eine Identität (soft delete). Die Identität bleibt bestehen,
   * wird aber als archiviert markiert. Keine stillschweigende Vernichtung.
   */
  archiveIdentity(actorId: string, archivedAtTick: number): { ok: boolean; error?: string } {
    const identity = this.identities.get(actorId);
    if (!identity) {
      return { ok: false, error: `Actor ${actorId} not found` };
    }
    if (identity.archivedAtTick !== undefined) {
      return { ok: false, error: `Actor ${actorId} already archived` };
    }

    const archived: ActorIdentity = { ...identity, archivedAtTick };
    this.identities.set(actorId, archived);

    const presence = this.presences.get(actorId);
    if (presence) {
      this.presences.set(actorId, { ...presence, state: "archived", updatedAtTick: archivedAtTick });
    }

    return { ok: true };
  }

  /**
   * Stellt eine archivierte Identität wieder her.
   */
  restoreIdentity(actorId: string, restoredAtTick: number): { ok: boolean; error?: string } {
    const identity = this.identities.get(actorId);
    if (!identity) {
      return { ok: false, error: `Actor ${actorId} not found` };
    }
    if (identity.archivedAtTick === undefined) {
      return { ok: false, error: `Actor ${actorId} is not archived` };
    }

    const restored: ActorIdentity = { ...identity, archivedAtTick: undefined };
    this.identities.set(actorId, restored);

    const presence = this.presences.get(actorId);
    if (presence) {
      this.presences.set(actorId, { ...presence, state: "absent", updatedAtTick: restoredAtTick });
    }

    return { ok: true };
  }

  listIdentities(kind?: ActorKind): ActorIdentity[] {
    const all = Array.from(this.identities.values());
    return kind ? all.filter((i) => i.kind === kind) : all;
  }

  listNonArchived(): ActorIdentity[] {
    return Array.from(this.identities.values()).filter((i) => i.archivedAtTick === undefined);
  }

  // ── Präsenz ────────────────────────────────────────────────

  getPresence(actorId: string): ActorPresence | undefined {
    return this.presences.get(actorId);
  }

  /**
   * Setzt die Präsenz eines Actors. Gibt Fehler, wenn die Identität nicht existiert
   * oder archiviert ist (archivierte Actors dürfen keine Präsenz haben).
   */
  setPresence(
    actorId: string,
    presence: Partial<ActorPresence>,
    currentTick: number
  ): { ok: boolean; presence?: ActorPresence; error?: string } {
    const identity = this.identities.get(actorId);
    if (!identity) {
      return { ok: false, error: `Actor ${actorId} not registered` };
    }
    if (identity.archivedAtTick !== undefined) {
      return { ok: false, error: `Actor ${actorId} is archived` };
    }

    const current = this.presences.get(actorId) || {
      actorId,
      state: "absent",
      updatedAtTick: currentTick,
    };

    const next: ActorPresence = {
      ...current,
      ...presence,
      updatedAtTick: currentTick,
    };

    // VISITOR_CAP: nur aktive Gäste/Präsenz zählen zum Hot-Set
    if ((next.state === "present" || next.state === "guest") && current.state !== next.state) {
      const activeCount = this.countActivePresences();
      if (activeCount >= this.config.visitorCap) {
        return {
          ok: false,
          error: `Visitor cap ${this.config.visitorCap} reached — cannot activate ${actorId}`,
        };
      }
    }

    this.presences.set(actorId, next);
    return { ok: true, presence: next };
  }

  /**
   * Besucher betritt das Casino → wird zu einem temporären Gast (Guest).
   * Der persistente Visitor bleibt unverändert; nur die Präsenz wechselt auf "guest".
   * Änderungen am Gast werden später zurückgeschrieben (siehe writeBackGuest).
   */
  enterAsGuest(
    actorId: string,
    locationId: string,
    roleId: string,
    sessionId: string,
    enteredAtTick: number
  ): { ok: boolean; presence?: ActorPresence; error?: string } {
    return this.setPresence(actorId, {
      state: "guest",
      locationId,
      roleId,
      sessionId,
      enteredAtTick,
    }, enteredAtTick);
  }

  /**
   * Gast verlässt das Casino → zurück zu "present" (oder "absent", je nach Kontext).
   * Änderungen am Gast-Aufenthalt werden in die persistente Identität zurückgeschrieben.
   */
  leaveGuest(
    actorId: string,
    currentTick: number,
    writeBack: boolean = true
  ): { ok: boolean; presence?: ActorPresence; error?: string } {
    const presence = this.presences.get(actorId);
    if (!presence) {
      return { ok: false, error: `Actor ${actorId} has no presence record` };
    }
    if (presence.state !== "guest") {
      return { ok: false, error: `Actor ${actorId} is not a guest` };
    }

    // Rückschreibung: Gast-spezifische Daten in Identität überführen (falls writeBack)
    if (writeBack) {
      const identity = this.identities.get(actorId);
      if (identity) {
        const updatedIdentity: ActorIdentity = {
          ...identity,
          metadata: {
            ...identity.metadata,
            lastGuestLocation: presence.locationId,
            lastGuestRole: presence.roleId,
            lastGuestSession: presence.sessionId,
            lastGuestTick: presence.enteredAtTick,
          },
        };
        this.identities.set(actorId, updatedIdentity);
      }
    }

    return this.setPresence(actorId, {
      state: "present",
      enteredAtTick: undefined,
    }, currentTick);
  }

  countActivePresences(): number {
    let count = 0;
    for (const p of this.presences.values()) {
      if (p.state === "present" || p.state === "guest") {
        count++;
      }
    }
    return count;
  }

  countByState(state: PresenceState): number {
    let count = 0;
    for (const p of this.presences.values()) {
      if (p.state === state) count++;
    }
    return count;
  }

  /**
   * Gibt alle aktiven Gäste (Hot-Set) zurück — begrenzt durch VISITOR_CAP.
   */
  listActiveGuests(): ActorPresence[] {
    return Array.from(this.presences.values())
      .filter((p) => p.state === "guest" || p.state === "present");
  }

  // ── Lebenszyklus-Fälle ─────────────────────────────────────

  /**
   * NPC kehrt zurück (war absent, wird wieder present).
   * Keine neue Identität erstellt — vorhandene wird reaktiviert.
   */
  welcomeBack(actorId: string, currentTick: number): { ok: boolean; error?: string } {
    const identity = this.identities.get(actorId);
    if (!identity) {
      return { ok: false, error: `Actor ${actorId} not registered` };
    }
    if (identity.archivedAtTick !== undefined) {
      return { ok: false, error: `Actor ${actorId} is archived — cannot welcome back` };
    }

    return this.setPresence(actorId, { state: "present" }, currentTick);
  }

  /**
   * Rollenwechsel für einen präsenten Actor.
   */
  changeRole(actorId: string, newRoleId: string, currentTick: number): { ok: boolean; error?: string } {
    const presence = this.presences.get(actorId);
    if (!presence) {
      return { ok: false, error: `Actor ${actorId} has no presence record` };
    }
    if (presence.state === "absent" || presence.state === "archived") {
      return { ok: false, error: `Actor ${actorId} is not present` };
    }

    return this.setPresence(actorId, { roleId: newRoleId }, currentTick);
  }

  /**
   * Unbekannter Kontakt — registriert einen neuen Actor mit Kind "visitor" wenn noch unbekannt.
   */
  registerUnknownContact(
    displayName: string,
    currentTick: number,
    metadata: Record<string, unknown> = {}
  ): { ok: boolean; actorId?: string; error?: string } {
    const id = `visitor-${currentTick}-${Math.random().toString(36).slice(2, 7)}`;
    const result = this.registerIdentity(id, "visitor", displayName, currentTick, metadata);
    if (!result.ok) return { ok: false, error: result.error };
    return { ok: true, actorId: id };
  }

  /**
   * Gibt zu einer Actor-ID den vollständigen Record zurück.
   */
  getRecord(actorId: string): ActorRecord | undefined {
    const identity = this.identities.get(actorId);
    const presence = this.presences.get(actorId);
    if (!identity || !presence) return undefined;
    return { identity, presence };
  }

  /**
   * Prüft, ob eine Actor-ID bekannt und nicht archiviert ist.
   */
  isKnownAndActive(actorId: string): boolean {
    const identity = this.identities.get(actorId);
    return !!identity && identity.archivedAtTick === undefined;
  }
}

export const actorRegistry = new ActorRegistry();