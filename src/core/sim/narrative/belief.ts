/**
 * Glaubwuerdigkeit als Mechanik: Wer teilt (Charisma, Intelligenz, Traits) und
 * wer glaubt (Herkunft, Misstrauen, Widerspruch). Jede Entscheidung traegt ihre
 * Gruende mit Kode und Gewicht; derselbe Seed ergibt dieselbe Antwort. Kein
 * Faktor zaehlt doppelt: die Konfidenz kommt aus der bestehenden Kette, die
 * Glaubenspruefung addiert nur, was dort noch nicht steckt.
 */
import { Prng } from '../../rng/prng';
import { traitEffect, type NpcProfile } from '../city-traits';
import { KNOWLEDGE_CONFIG, sourceWeightOf, type KnowledgeConfig } from './knowledge-config';
import type { ActorRef, ExchangeReason, KnowledgeEntry, KnowledgeExchange } from './knowledge-types';
import type { RelationshipEdge } from './types';
import { NARRATIVE_LIMITS } from './types';

const THRESHOLD = 0.3;
const round = (value: number): number => Math.round(value * 10000) / 10000;
const reason = (code: string, delta: number, detail: string): ExchangeReason => ({ code, delta: round(delta), detail });

/** Konfidenz nach Quellenart, Distanz und Beziehung - genau der Wert der Kette. */
export function projectedConfidence(
  config: KnowledgeConfig,
  entry: KnowledgeEntry,
  edge: RelationshipEdge | null,
  distance: number,
): number {
  const kind = entry.sourceKind === 'ERLEBT' ? 'GEHOERT' : entry.sourceKind;
  return entry.confidence * sourceWeightOf(config, kind, edge) * (1 - config.distance.confidenceDecay * distance);
}

interface ShareIntent {
  readonly shared: boolean;
  readonly reasons: readonly ExchangeReason[];
  readonly willingness: number;
  readonly gain: number;
  readonly gainNeeded: number;
}

/**
 * Weitergabe-Absicht: Charisma macht redselig, hohe Intelligenz verlangt einen
 * erkennbaren Gewinn. Traits verschieben beide Seiten; der Wurf ist seedfest.
 */
export function shareIntent(input: {
  readonly speaker: NpcProfile;
  readonly receiver: NpcProfile | null;
  readonly entry: KnowledgeEntry;
  readonly trust: number;
  readonly seed: number;
}): ShareIntent {
  const { speaker, receiver, entry } = input;
  const talk = speaker.charisma / 10;
  const strategy = speaker.intellect / 10;
  const shareTrait = traitEffect(speaker.traits, 'share');
  const overshare = traitEffect(speaker.traits, 'overshare');
  const gainTrait = traitEffect(speaker.traits, 'gain');
  const receiverValue = receiver ? (receiver.charisma + receiver.intellect) / 20 : 0.4;
  const reciprocity = Math.max(-1, Math.min(1, input.trust / 10));
  const noise = (new Prng(input.seed + 7).nextFloat() - 0.5) * 0.08;
  const willingness = 0.3 + talk * 0.4 + shareTrait * 0.18 + overshare * 0.08
    - strategy * 0.1 + receiverValue * 0.05 + noise;
  const gainNeeded = 0.18 + strategy * 0.3 + gainTrait * 0.12 - overshare * 0.1;
  const gain = 0.1 + receiverValue * 0.22 + Math.max(0, reciprocity) * 0.04
    + (entry.sentiment > 0 ? 0.02 : 0) + noise;

  const reasons: ExchangeReason[] = [];
  const add = (code: string, delta: number, detail: string): void => {
    if (Math.abs(delta) >= 0.0001) reasons.push(reason(code, delta, detail));
  };
  add('CHARISMA_REDESELIGKEIT', talk * 0.4, `Charisma ${speaker.charisma}`);
  add('TRAIT_TEILEN', shareTrait * 0.18, `Traits ${shareTrait.toFixed(2)}`);
  add('TRAIT_UEBERMITTEILUNG', overshare * 0.08, `Uebermitteilung ${overshare.toFixed(2)}`);
  add('INT_FILTER', -strategy * 0.1, `Intelligenz ${speaker.intellect}`);
  add('EMPFANGSWERT', receiverValue * 0.05, `Empfaengerwert ${receiverValue.toFixed(2)}`);
  add('STREUUNG_ABSICHT', noise, 'seedfester Wurf');

  const strategic = strategy >= 0.6;
  const gainOk = gain >= gainNeeded;
  const willingOk = willingness >= 0.5;
  if (strategic) add('INT_GEWINNPRUEFUNG', gain - gainNeeded, `Gewinn ${gain.toFixed(2)} vs ${gainNeeded.toFixed(2)}`);
  const shared = strategic ? willingOk && gainOk : willingOk;
  reasons.push(reason(
    shared ? 'WEITERGABE' : 'KEINE_WEITERGABE',
    shared ? 0 : -1,
    shared ? `bereit (${willingness.toFixed(2)})`
      : strategic && !gainOk ? `kein Gewinn (${gain.toFixed(2)} < ${gainNeeded.toFixed(2)})`
        : `nicht bereit (${willingness.toFixed(2)} < 0.50)`,
  ));
  return { shared, reasons, willingness: round(willingness), gain: round(gain), gainNeeded: round(gainNeeded) };
}

interface BeliefVerdict {
  readonly accepted: boolean;
  readonly score: number;
  readonly threshold: number;
  readonly reasons: readonly ExchangeReason[];
}

/** Glaubenspruefung: Ketten-Konfidenz plus Faktoren, die dort noch nicht stecken. */
export function evaluateBelief(input: {
  readonly entry: KnowledgeEntry;
  readonly speaker: NpcProfile;
  readonly receiver: NpcProfile;
  readonly edge: RelationshipEdge | null;
  readonly contradiction: KnowledgeEntry | null;
  readonly seed: number;
  readonly config?: KnowledgeConfig;
}): BeliefVerdict {
  const config = input.config ?? KNOWLEDGE_CONFIG;
  const distance = input.entry.distance + 1;
  const base = projectedConfidence(config, input.entry, input.edge, distance);
  const reasons: ExchangeReason[] = [];
  let score = base;
  const add = (code: string, delta: number, detail: string): void => {
    if (Math.abs(delta) < 0.0001) return;
    score += delta;
    reasons.push(reason(code, delta, detail));
  };
  const edgeText = input.edge ? `Vertrauen ${input.edge.trust}, Konflikt ${input.edge.conflict}` : 'keine Beziehung';
  reasons.push(reason('KONFIDENZ_HERKUNFT', base, `${input.entry.sourceKind} aus Distanz ${distance}, ${edgeText}`));
  add('TRAIT_GLAUBWUERDIGKEIT', traitEffect(input.speaker.traits, 'credibility') * 0.12,
    `Glaubwuerdigkeit ${traitEffect(input.speaker.traits, 'credibility').toFixed(2)}`);
  add('CHARISMA_WIRKUNG', (input.speaker.charisma - 5) * 0.012, `Charisma ${input.speaker.charisma}`);
  add('TRAIT_MISSTRAUEN', -traitEffect(input.receiver.traits, 'skepticism') * 0.15,
    `Skepsis ${traitEffect(input.receiver.traits, 'skepticism').toFixed(2)}`);
  add('INT_PRUEFUNG', -Math.max(0, input.receiver.intellect - 5) * 0.018, `Intelligenz ${input.receiver.intellect}`);
  if (input.contradiction) add('WIDERSPRUCH', -0.15, `gegenlaeufiger Eintrag ${input.contradiction.id}`);
  add('STREUUNG_GLAUBE', (new Prng(input.seed + 1).nextFloat() - 0.5) * 0.08, 'seedfester Wurf');
  const rounded = round(score);
  return { accepted: rounded >= THRESHOLD, score: rounded, threshold: THRESHOLD, reasons };
}

/** Ein bekannter Gegen-Eintrag macht die neue Kunde unglaubwuerdig. */
export function contradictionFor(
  world: { narrative: { knowledge: readonly KnowledgeEntry[] } },
  receiver: ActorRef,
  entry: KnowledgeEntry,
): KnowledgeEntry | null {
  return world.narrative.knowledge.find((known) => known.actor === receiver
    && known.factId === entry.factId && known.id !== entry.id
    && Math.abs(known.sentiment) >= 0.4
    && Math.sign(known.sentiment) !== Math.sign(entry.sentiment)) ?? null;
}

interface ExchangeInput {
  readonly from: ActorRef;
  readonly to: ActorRef;
  readonly factId: number;
  readonly tick: number;
  readonly seed: number;
  readonly shared: boolean;
  readonly accepted: boolean | null;
  readonly score: number;
  readonly threshold: number;
  readonly reasons: readonly ExchangeReason[];
  readonly entryId: number | null;
}

/** Schreibt die Begruendung in den begrenzten Austausch-Log; sie ueberlebt den Save. */
export function recordExchange(
  world: { narrative: { exchanges: KnowledgeExchange[]; exchangeSeq: number } },
  input: ExchangeInput,
): KnowledgeExchange {
  const made: KnowledgeExchange = {
    id: world.narrative.exchangeSeq, tick: input.tick, seed: input.seed,
    from: input.from, to: input.to, factId: input.factId,
    shared: input.shared, accepted: input.accepted,
    score: round(input.score), threshold: round(input.threshold),
    reasons: input.reasons.slice(0, 24), entryId: input.entryId,
  };
  world.narrative.exchangeSeq += 1;
  world.narrative.exchanges.push(made);
  const overflow = world.narrative.exchanges.length - NARRATIVE_LIMITS.exchanges;
  if (overflow > 0) world.narrative.exchanges.splice(0, overflow);
  return made;
}

const nameOf = (world: { visitors: readonly { id: number; name: string }[] }, actor: ActorRef): string => {
  const match = /^visitor:(\d+)$/.exec(actor);
  if (!match) return actor;
  return world.visitors.find((visitor) => visitor.id === Number(match[1]))?.name ?? actor;
};

/** Erklaerung in einem Satz; nennt Schwelle und die tragenden Gruende. */
export function explainExchange(
  world: { visitors: readonly { id: number; name: string }[] },
  exchange: KnowledgeExchange,
): string {
  const from = nameOf(world, exchange.from);
  const to = nameOf(world, exchange.to);
  if (!exchange.shared) {
    const block = exchange.reasons.find((entry) => entry.code === 'KEINE_WEITERGABE');
    return `${from} behaelt die Kunde fuer sich: ${block?.detail ?? 'keine Weitergabe'}.`;
  }
  const negatives = exchange.reasons
    .filter((entry) => entry.delta < 0 && entry.code !== 'KONFIDENZ_HERKUNFT')
    .map((entry) => `${entry.code} ${entry.delta.toFixed(2)}`);
  const verdict = exchange.accepted ? 'glaubt' : 'glaubt nicht';
  return `${to} ${verdict} ${from}: Konfidenz ${exchange.score.toFixed(2)} `
    + `${exchange.accepted ? '>=' : '<'} Schwelle ${exchange.threshold.toFixed(2)}`
    + `${negatives.length > 0 ? `; Gruende: ${negatives.join(', ')}` : ''}.`;
}
