/**
 * Social View — Phase 6
 * Kombinierte soziale Darstellung: Ego-Netzwerk, Influence Inspector,
 * Beziehungsprofil und visuelles System für Beziehungen/Einflüsse.
 */

import type { WorldTime } from "./worldtime";
import type { RelationshipEdge, RelationshipDimension } from "./relationship-engine";
import type { FactorSnapshot } from "./factor-resolver";
import type { NormalizationContext } from "./factor-resolver";
import {
  buildEgoNetworkView,
  renderEgoNetwork,
  type EgoNetworkView,
} from "./ego-network";
import {
  analyzeInfluence,
  renderInfluenceAnalysis,
  type InfluenceAnalysis,
} from "./influence-inspector";
import {
  buildRelationshipProfile,
  renderRelationshipProfile,
  type RelationshipProfile,
} from "./relationship-profile";

export interface SocialViewConfig {
  readonly egoActorId: string;
  readonly egoDisplayName: string;
  readonly actorNames: Map<string, string>;
}

export class SocialView {
  private config: SocialViewConfig;

  constructor(config: SocialViewConfig) {
    this.config = config;
  }

  updateConfig(config: Partial<SocialViewConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Ego-Netzwerk ─────────────────────────────────────────────

  buildEgoNetwork(
    edges: RelationshipEdge[],
    worldTime: WorldTime
  ): EgoNetworkView {
    return buildEgoNetworkView(
      this.config.egoActorId,
      this.config.egoDisplayName,
      edges,
      this.config.actorNames,
      worldTime
    );
  }

  renderEgoNetwork(view: EgoNetworkView): string {
    return renderEgoNetwork(view);
  }

  // ── Influence Inspector ──────────────────────────────────────

  analyzeInfluence(snapshot: FactorSnapshot): InfluenceAnalysis {
    return analyzeInfluence(snapshot);
  }

  renderInfluenceAnalysis(analysis: InfluenceAnalysis): string {
    return renderInfluenceAnalysis(analysis);
  }

  // ── Beziehungsprofil ──────────────────────────────────────────

  buildRelationshipProfile(
    actorId: string,
    otherActorId: string,
    edges: RelationshipEdge[],
    factorSnapshot: FactorSnapshot | null,
    worldTime: WorldTime
  ): RelationshipProfile {
    return buildRelationshipProfile(
      actorId,
      otherActorId,
      edges,
      factorSnapshot,
      worldTime
    );
  }

  renderRelationshipProfile(profile: RelationshipProfile): string {
    return renderRelationshipProfile(profile);
  }

  // ── Kombinierte soziale Übersicht ────────────────────────────

  renderSocialOverview(
    egoNetwork: EgoNetworkView,
    profiles: RelationshipProfile[],
    influence: InfluenceAnalysis | null
  ): string {
    const profilesHtml = profiles
      .map((p) => renderRelationshipProfile(p))
      .join("");

    const influenceHtml = influence
      ? renderInfluenceAnalysis(influence)
      : `<div class="no-influence">Keine Faktor-Analyse verfügbar</div>`;

    return `
      <div class="social-overview">
        <div class="social-ego-network">
          ${this.renderEgoNetwork(egoNetwork)}
        </div>
        <div class="social-profiles">
          <h3>Beziehungsprofile</h3>
          ${profilesHtml}
        </div>
        <div class="social-influence">
          <h3>Einfluss-Analyse</h3>
          ${influenceHtml}
        </div>
      </div>
    `;
  }

  // ── Kontext-Snapshot für UI ──────────────────────────────────

  createNormalizationContext(
    actingActorId: string,
    action: string,
    situation: "casino" | "social" | "work" | "everyday" | "romantic" | "conflict",
    worldTime: WorldTime,
    sourceId: string,
    targetActorId?: string
  ): NormalizationContext {
    return {
      actingActorId,
      targetActorId,
      action,
      situation,
      worldTime,
      sourceId,
    };
  }
}

export const socialView = new SocialView({
  egoActorId: "player",
  egoDisplayName: "Spieler",
  actorNames: new Map(),
});