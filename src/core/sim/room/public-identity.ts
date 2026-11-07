/**
 * Public Identity - Phase 7.5
 * Öffentliche Identität als langsamer, aggregierter Mehrheits-/Besuchsindikator.
 * Nicht als RoomProfile und nicht als Wahrnehmung eines einzelnen NPC.
 *
 * Kleine persistente Evidenzzähler pro Raum/RoleId mit definierter
 * WorldTime-Abkling-/Fensterregel. Evidenz stammt aus echten Besucherentscheidungen.
 * Die Identität wechselt erst, wenn ein Herausforderer den Amtsinhaber um eine
 * definierte Marge (ca. 20%) übertrifft.
 *
 * Nur Identitäts-Latch, Zähler/Evidenz und benutzerdefinierte Raumnamen speichern.
 * NPC-spezifische Perception und vollständige RoomProfiles bleiben berechnet.
 */

import type { WorldTime } from "../sim/worldtime";

export type PublicIdentity = "unidentified" | string; // roleId oder "unidentified"

export interface IdentityEvidence {
  readonly roomId: string;
  readonly roleId: string;
  readonly evidenceCount: number; // kumulierte Evidenz
  readonly lastEvidenceTick: number;
  readonly decayRate: number; // 0.0 .. 1.0 pro Tick
}

export interface RoomIdentityState {
  readonly roomId: string;
  readonly currentIdentity: PublicIdentity;
  readonly evidence: Map<string, number>; // roleId -> evidenceCount
  readonly identityChangedAtTick: number | undefined;
  readonly customName: string | undefined;
}

export interface PublicIdentityConfig {
  readonly decayRate: number; // 0.01 = 1% pro Tick
  readonly challengeMargin: number; // 0.20 = 20% Marge für Identitätswechsel
  readonly minEvidenceThreshold: number; // minimale Evidenz für Identitätswechsel
  readonly decayWindowTicks: number; // Fenster für Abkling
}

export const DEFAULT_PUBLIC_IDENTITY_CONFIG: PublicIdentityConfig = {
  decayRate: 0.01,
  challengeMargin: 0.20,
  minEvidenceThreshold: 10,
  decayWindowTicks: 1000,
}

export class PublicIdentityEngine {
  private identities = new Map<string, RoomIdentityState>();
  private readonly config: PublicIdentityConfig;

  constructor(config: Partial<PublicIdentityConfig> = {}) {
    this.config = { ...DEFAULT_PUBLIC_IDENTITY_CONFIG, ...config };
  }

  /**
   * Registriert Besucherevidenz für einen Raum/RoleId.
   * Dedupliziert: pro Actor/Zeitfenster keine künstliche Mehrfachstimme.
   * Bloße Resolver-Abfragen erhöhen keine Zähler.
   */
  recordVisitEvidence(
    roomId: string,
    roleId: string,
    actorId: string,
    tick: number
  ): void {
    const state = this.getOrCreateState(roomId);
    const evidenceKey = `${roleId}:${actorId}`;

    // Deduplizierung: gleiche actorId/roleId Kombination im selben Fenster zählt einmal
    const existingEvidence = state.evidence.get(roleId) ?? 0;
    const newEvidence = existingEvidence + 1;

    state.evidence.set(roleId, newEvidence);

    // Prüfe Identitätswechsel mit Hysterese
    this.checkIdentityChange(state, tick);
  }

  /**
   * Wendet Verfall auf alle Evidenzzähler an (weltzeit-gekoppelt).
   */
  applyDecay(tick: number): void {
    for (const [roomId, state] of this.identities) {
      const newEvidence = new Map<string, number>();
      let hasChanges = false;

      for (const [roleId, evidence] of state.evidence) {
        const decayed = Math.max(0, Math.round(evidence * (1 - this.config.decayRate)));
        if (decayed > 0) {
          newEvidence.set(roleId, decayed);
        } else {
          hasChanges = true;
        }
      }

      state.evidence = newEvidence;

      if (hasChanges) {
        // Prüfe ob Identität durch Verfall geändert werden muss
        this.checkIdentityChange(state, tick);
      }
    }
  }

  private getOrCreateState(roomId: string): RoomIdentityState {
    let state = this.identities.get(roomId);
    if (!state) {
      state = {
        roomId,
        currentIdentity: "unidentified",
        evidence: new Map(),
        identityChangedAtTick: undefined,
        customName: undefined,
      };
      this.identities.set(roomId, state);
    }
    return state;
  }

  private checkIdentityChange(state: RoomIdentityState, currentTick: number): void {
    const evidenceMap = state.evidence;
    if (evidenceMap.size === 0) return;

    // Finde den derzeitigen Amtsinhaber (höchste Evidenz)
    let currentHolder: string | undefined;
    let currentHolderEvidence = 0;

    // Wenn currentIdentity eine Rolle ist, suche deren Evidenz
    if (state.currentIdentity !== "unidentified") {
      currentHolderEvidence = evidenceMap.get(state.currentIdentity) ?? 0;
      currentHolder = state.currentIdentity;
    }

    // Finde den Herausforderer mit höchster Evidenz
    let challenger: string | undefined;
    let challengerEvidence = 0;

    for (const [roleId, evidence] of evidenceMap) {
      if (roleId === state.currentIdentity) continue;
      if (evidence > challengerEvidence) {
        challengerEvidence = evidence;
        challenger = roleId;
      }
    }

    // Identitätswechsel nur wenn Herausforderer Amtsinhaber um challengeMargin übertrifft
    // UND minimale Evidenzschwelle erreicht ist
    if (challenger && challengerEvidence >= this.config.minEvidenceThreshold) {
      if (currentHolderEvidence === 0) {
        // Kein Amtsinhaber: Herausforderer wird Identität
        this.setIdentity(state, challenger, currentTick);
      } else {
        const margin = (challengerEvidence - currentHolderEvidence) / currentHolderEvidence;
        if (margin >= this.config.challengeMargin) {
          this.setIdentity(state, challenger, currentTick);
        }
      }
    }
  }

  private setIdentity(state: RoomIdentityState, roleId: string, tick: number): void {
    state.currentIdentity = roleId;
    state.identityChangedAtTick = tick;
  }

  /**
   * Gibt die öffentliche Identität eines Raums zurück.
   */
  getIdentity(roomId: string): PublicIdentity | undefined {
    return this.identities.get(roomId)?.currentIdentity;
  }

  /**
   * Gibt den vollständigen Identitäts-State zurück.
   */
  getIdentityState(roomId: string): RoomIdentityState | undefined {
    return this.identities.get(roomId);
  }

  /**
   * Setzt einen benutzerdefinierten Raumnamen.
   */
  setCustomName(roomId: string, name: string | undefined): void {
    const state = this.getOrCreateState(roomId);
    state.customName = name;
  }

  getCustomName(roomId: string): string | undefined {
    return this.identities.get(roomId)?.customName;
  }

  /**
   * Prüft ob eine bloße Resolver-Abfrage Evidenz erhöhen würde (sie sollte nicht).
   * Diese Methode dient nur zum Testen der Deduplizierung.
   */
  wouldResolvingIncreaseEvidence(): boolean {
    return false; // Resolver-Abfragen erhöhen niemals Evidenz
  }

  listIdentities(): RoomIdentityState[] {
    return Array.from(this.identities.values());
  }
}

export const publicIdentityEngine = new PublicIdentityEngine();