/**
 * Beziehungsprofil — Phase 6
 * Zeigt ein vollständiges Beziehungsprofil zwischen zwei Akteuren.
 * Kombiniert alle vier Dimensionen (trust, sympathy, conflict, influence)
 * mit Historie und Faktor-Beiträgen.
 */

import type { WorldTime } from "./worldtime";
import type { RelationshipEdge, RelationshipDimension } from "./relationship-engine";
import type { FactorSnapshot } from "./factor-resolver";

export interface RelationshipProfile {
  readonly actorId: string;
  readonly otherActorId: string;
  readonly trust: number;
  readonly sympathy: number;
  readonly conflict: number;
  readonly influence: number;
  readonly overallDisposition: "hostile" | "neutral" | "friendly" | "intimate";
  readonly overallScore: number;
  readonly lastUpdatedTick: number;
  readonly edges: RelationshipEdge[];
  readonly factorSnapshot: FactorSnapshot | null;
  readonly dispositionHistory: Array<{ tick: number; disposition: string; score: number }>;
}

export function buildRelationshipProfile(
  actorId: string,
  otherActorId: string,
  edges: RelationshipEdge[],
  factorSnapshot: FactorSnapshot | null,
  worldTime: WorldTime
): RelationshipProfile {
  const dimensions: Record<RelationshipDimension, number> = {
    trust: 0,
    sympathy: 0,
    conflict: 0,
    influence: 0,
  };

  const relevantEdges: RelationshipEdge[] = [];
  for (const e of edges) {
    if (
      (e.fromActorId === actorId && e.toActorId === otherActorId) ||
      (e.toActorId === actorId && e.fromActorId === otherActorId)
    ) {
      relevantEdges.push(e);
      dimensions[e.dimension] = e.score;
    }
  }

  const { trust, sympathy, conflict, influence } = dimensions;
  const overallScore = (trust + sympathy - conflict + influence) / 4;
  const overallDisposition = scoreToDisposition(overallScore);
  const lastUpdatedTick = Math.max(
    ...relevantEdges.map((e) => e.lastUpdatedTick),
    0
  );

  return {
    actorId,
    otherActorId,
    trust,
    sympathy,
    conflict,
    influence,
    overallDisposition,
    overallScore,
    lastUpdatedTick,
    edges: relevantEdges,
    factorSnapshot,
    dispositionHistory: [], // Wird von der History-Verwaltung befüllt
  };
}

function scoreToDisposition(score: number): "hostile" | "neutral" | "friendly" | "intimate" {
  if (score >= 75) return "intimate";
  if (score >= 25) return "friendly";
  if (score <= -25) return "hostile";
  return "neutral";
}

export function renderRelationshipProfile(profile: RelationshipProfile): string {
  const dispositionColors: Record<RelationshipProfile["overallDisposition"], string> = {
    hostile: "#f44336",
    neutral: "#9e9e9e",
    friendly: "#4caf50",
    intimate: "#e91e63",
  };

  return `
    <div class="relationship-profile" data-disposition="${profile.overallDisposition}">
      <div class="profile-header">
        <h3>${profile.actorId} ↔ ${profile.otherActorId}</h3>
        <span class="disposition-badge" style="color: ${dispositionColors[profile.overallDisposition]}">
          ${profile.overallDisposition}
        </span>
      </div>
      <div class="profile-dimensions">
        <div class="dimension">
          <span class="dim-name">Trust</span>
          <span class="dim-value">${profile.trust}</span>
          <div class="dim-bar" style="width: ${Math.abs(profile.trust)}%"></div>
        </div>
        <div class="dimension">
          <span class="dim-name">Sympathy</span>
          <span class="dim-value">${profile.sympathy}</span>
          <div class="dim-bar" style="width: ${Math.abs(profile.sympathy)}%"></div>
        </div>
        <div class="dimension">
          <span class="dim-name">Conflict</span>
          <span class="dim-value">${profile.conflict}</span>
          <div class="dim-bar" style="width: ${Math.abs(profile.conflict)}%"></div>
        </div>
        <div class="dimension">
          <span class="dim-name">Influence</span>
          <span class="dim-value">${profile.influence}</span>
          <div class="dim-bar" style="width: ${Math.abs(profile.influence)}%"></div>
        </div>
      </div>
      <div class="profile-summary">
        <span>Overall Score: ${profile.overallScore.toFixed(1)}</span>
        <span>Last Updated: Tick ${profile.lastUpdatedTick}</span>
        <span>Edges: ${profile.edges.length}</span>
      </div>
      ${profile.factorSnapshot ? renderFactorSnapshot(profile.factorSnapshot) : ""}
    </div>
  `;
}

function renderFactorSnapshot(snapshot: FactorSnapshot): string {
  return `
    <div class="profile-factors">
      <h4>Factor Contributions</h4>
      <div>Total: ${snapshot.totalWeightBps}bps</div>
      <div>Normalized: ${snapshot.normalizedScore.toFixed(2)}</div>
      <div>Deterministic: ${snapshot.deterministic}</div>
    </div>
  `;
}