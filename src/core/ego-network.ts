/**
 * Ego-Netzwerk-Ansicht — Phase 6
 * Visuelle Darstellung des sozialen Netzwerks um einen zentralen Akteur (Ego).
 * Zeigt direkte Beziehungen (Alter) und indirekte Verbindungen (Alter-Alter).
 */

import type { WorldTime } from "./worldtime";
import type { RelationshipEdge, RelationshipDimension } from "./relationship-engine";

export interface EgoNetworkNode {
  readonly actorId: string;
  readonly displayName: string;
  readonly isEgo: boolean;
  readonly relationshipScore: number;
  readonly dominantDimension: RelationshipDimension;
  readonly dominantScore: number;
  readonly disposition: "hostile" | "neutral" | "friendly" | "intimate";
}

export interface EgoNetworkEdge {
  readonly fromActorId: string;
  readonly toActorId: string;
  readonly dimension: RelationshipDimension;
  readonly score: number;
}

export interface EgoNetworkView {
  readonly egoActorId: string;
  readonly egoDisplayName: string;
  readonly nodes: EgoNetworkNode[];
  readonly edges: EgoNetworkEdge[];
  readonly totalConnections: number;
  readonly averageRelationshipScore: number;
  readonly hostileConnections: number;
  readonly friendlyConnections: number;
  readonly intimateConnections: number;
}

export function buildEgoNetworkView(
  egoActorId: string,
  egoDisplayName: string,
  edges: RelationshipEdge[],
  actorNames: Map<string, string>,
  worldTime: WorldTime
): EgoNetworkView {
  // Sammle alle direkten Verbindungen des Ego
  const directEdges = edges.filter(
    (e) => e.fromActorId === egoActorId || e.toActorId === egoActorId
  );

  const connectedActorIds = new Set<string>();
  for (const e of directEdges) {
    const other = e.fromActorId === egoActorId ? e.toActorId : e.fromActorId;
    connectedActorIds.add(other);
  }

  // Baue Nodes
  const nodes: EgoNetworkNode[] = [];
  for (const actorId of connectedActorIds) {
    const actorEdges = directEdges.filter(
      (e) => (e.fromActorId === egoActorId && e.toActorId === actorId) ||
             (e.toActorId === egoActorId && e.fromActorId === actorId)
    );

    // Finde die dominante Dimension
    let dominantDimension: RelationshipDimension = "trust";
    let dominantScore = 0;
    let totalScore = 0;

    for (const ae of actorEdges) {
      totalScore += ae.score;
      if (Math.abs(ae.score) > Math.abs(dominantScore)) {
        dominantScore = ae.score;
        dominantDimension = ae.dimension;
      }
    }

    const avgScore = actorEdges.length > 0 ? totalScore / actorEdges.length : 0;
    const disposition = scoreToDisposition(avgScore);

    nodes.push({
      actorId,
      displayName: actorNames.get(actorId) ?? actorId,
      isEgo: false,
      relationshipScore: avgScore,
      dominantDimension,
      dominantScore,
      disposition,
    });
  }

  // Baue Edges (nur direkte Verbindungen zum Ego)
  const networkEdges: EgoNetworkEdge[] = directEdges.map((e) => ({
    fromActorId: e.fromActorId,
    toActorId: e.toActorId,
    dimension: e.dimension,
    score: e.score,
  }));

  const totalConnections = nodes.length;
  const averageScore =
    totalConnections > 0
      ? nodes.reduce((sum, n) => sum + n.relationshipScore, 0) / totalConnections
      : 0;

  const hostileConnections = nodes.filter((n) => n.disposition === "hostile").length;
  const friendlyConnections = nodes.filter(
    (n) => n.disposition === "friendly" || n.disposition === "intimate"
  ).length;
  const intimateConnections = nodes.filter((n) => n.disposition === "intimate").length;

  return {
    egoActorId,
    egoDisplayName,
    nodes,
    edges: networkEdges,
    totalConnections,
    averageRelationshipScore: averageScore,
    hostileConnections,
    friendlyConnections,
    intimateConnections,
  };
}

function scoreToDisposition(score: number): "hostile" | "neutral" | "friendly" | "intimate" {
  if (score >= 75) return "intimate";
  if (score >= 25) return "friendly";
  if (score <= -25) return "hostile";
  return "neutral";
}

export function renderEgoNetwork(view: EgoNetworkView): string {
  const nodesHtml = view.nodes
    .map(
      (n) => `
        <div class="ego-node" data-disposition="${n.disposition}">
          <span class="node-name">${n.displayName}</span>
          <span class="node-score">${n.relationshipScore.toFixed(0)}</span>
          <span class="node-dimension">${n.dominantDimension}</span>
        </div>
      `
    )
    .join("");

  return `
    <div class="ego-network" data-ego="${view.egoActorId}">
      <div class="ego-center">${view.egoDisplayName} (Ego)</div>
      <div class="ego-stats">
        <span>Verbindungen: ${view.totalConnections}</span>
        <span>Ø Beziehung: ${view.averageRelationshipScore.toFixed(1)}</span>
        <span>Feindlich: ${view.hostileConnections}</span>
        <span>Freundlich: ${view.friendlyConnections}</span>
        <span>Intim: ${view.intimateConnections}</span>
      </div>
      <div class="ego-nodes">${nodesHtml}</div>
    </div>
  `;
}