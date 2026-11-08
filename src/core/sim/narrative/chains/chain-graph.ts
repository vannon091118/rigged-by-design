/** Reine Graphabfragen: Nachbarn, Erreichbarkeit, Zyklen und Zusammenfuehrungen. */
import type { ChainEdge, ChainNode, NarrativeChain } from './chain-types';

export function chainNode(chain: NarrativeChain, nodeId: string): ChainNode | null {
  return chain.nodes.find((node) => node.nodeId === nodeId) ?? null;
}

export function outgoingEdges(chain: NarrativeChain, nodeId: string): readonly ChainEdge[] {
  return chain.edges.filter((edge) => edge.from === nodeId)
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0)
      || left.edgeId.localeCompare(right.edgeId));
}

/** Erreichbarkeit ab dem Startknoten; ein nicht erreichbarer Knoten ist toter Content. */
export function reachableNodes(chain: NarrativeChain): ReadonlySet<string> {
  const seen = new Set<string>();
  const queue = [chain.start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const edge of outgoingEdges(chain, current)) queue.push(edge.to);
  }
  return seen;
}

/**
 * Liefert genau die Kanten, die auf einem Zyklus liegen. Ein Rueckwaertsbesuch
 * allein ist kein Fehler; erst eine Kante ohne `repeatable` macht den Graphen
 * unkontrollierbar und wird von der Schemapruefung abgelehnt.
 */
export function cycleEdgeIds(chain: NarrativeChain): readonly string[] {
  const state = new Map<string, 0 | 1 | 2>();
  const stack: ChainEdge[] = [];
  const cyclic = new Set<string>();
  const visit = (nodeId: string): void => {
    state.set(nodeId, 1);
    for (const edge of outgoingEdges(chain, nodeId)) {
      const target = state.get(edge.to) ?? 0;
      if (target === 1) {
        cyclic.add(edge.edgeId);
        const at = stack.findIndex((entry) => entry.from === edge.to);
        for (let index = Math.max(0, at); index < stack.length; index += 1) {
          cyclic.add(stack[index]!.edgeId);
        }
      } else if (target === 0) {
        stack.push(edge);
        visit(edge.to);
        stack.pop();
      }
    }
    state.set(nodeId, 2);
  };
  for (const node of chain.nodes) if ((state.get(node.nodeId) ?? 0) === 0) visit(node.nodeId);
  return [...cyclic].sort();
}

/** Knoten mit mehr als einem eingehenden Uebergang sind kontrollierte Zusammenfuehrungen. */
export function mergeNodeIds(chain: NarrativeChain): readonly string[] {
  const incoming = new Map<string, number>();
  for (const edge of chain.edges) incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  return chain.nodes.filter((node) => (incoming.get(node.nodeId) ?? 0) > 1)
    .map((node) => node.nodeId).sort();
}

/** Endknoten ohne `terminal` sind eine fehlende Folge; die Schemapruefung lehnt sie ab. */
export function deadEndNodeIds(chain: NarrativeChain): readonly string[] {
  return chain.nodes
    .filter((node) => !node.terminal && outgoingEdges(chain, node.nodeId).length === 0)
    .map((node) => node.nodeId).sort();
}
