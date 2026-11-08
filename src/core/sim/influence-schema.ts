/**
 * Schema und fail-closed Validierung der Influence-Matrix. Die Gewichte liegen
 * in `influence-matrix.ts`; dieses Modul ist der einzige Validator des
 * Rohdokuments und prueft Faktor-Katalog, Untereinfluesse, Kontexte und Kanten.
 */
import { FACTOR_IDS, type InfluenceConfig, type InfluenceFactorId } from './influence-types';
import { validateEventPool, type EventPoolConfig } from './influence-event-pool';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readRecord = (value: unknown, label: string): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(`Einfluss-Matrix: ${label} fehlt oder ist kein Objekt.`);
  return value;
};

const readText = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Einfluss-Matrix: ${label} muss ein nicht-leerer Text sein.`);
  }
  return value;
};

const readNumber = (value: unknown, label: string): number => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`Einfluss-Matrix: ${label} ist keine endliche Zahl.`);
  }
  return value;
};

const readBounded = (value: unknown, label: string, min: number, max: number): number => {
  const number = readNumber(value, label);
  if (number < min || number > max) {
    throw new Error(`Einfluss-Matrix: ${label} muss in ${min}..${max} liegen.`);
  }
  return number;
};

/** Prueft die komplette Matrix fail-closed; jede Luecke ist ein Fehler. */
export function validateInfluenceConfig(config: InfluenceConfig): void {
  const root = readRecord(config, 'Config');
  if (root.version !== 1) throw new Error('Einfluss-Matrix: unbekannte Version.');
  const factors = readRecord(root.factors, 'factors');
  const expected = [...FACTOR_IDS].sort().join('|');
  if (Object.keys(factors).sort().join('|') !== expected) {
    throw new Error('Einfluss-Matrix: Faktor-Katalog ist unvollstaendig oder enthaelt unbekannte Faktoren.');
  }
  const baseWeights = new Map<InfluenceFactorId, number>();
  const childIds = new Set<string>();
  for (const id of FACTOR_IDS) {
    const factor = readRecord(factors[id], `Faktor ${id}`);
    if (factor.id !== id) throw new Error(`Einfluss-Matrix: Faktor ${id} traegt eine falsche ID.`);
    readText(factor.category, `Kategorie von ${id}`);
    baseWeights.set(id, readBounded(factor.baseWeight, `Grundgewicht von ${id}`, 0, 1));
    const range = readRecord(factor.range, `Wertebereich von ${id}`);
    const min = readNumber(range.min, `Minimum von ${id}`);
    const max = readNumber(range.max, `Maximum von ${id}`);
    if (max <= min) throw new Error(`Einfluss-Matrix: Faktor ${id} hat keinen gueltigen Wertebereich.`);
    if (!Array.isArray(factor.children)) {
      throw new Error(`Einfluss-Matrix: Faktor ${id} hat keine Untereinfluss-Liste.`);
    }
    for (const entry of factor.children) {
      const child = readRecord(entry, `Untereinfluss von ${id}`);
      const childId = readText(child.id, `ID eines Untereinflusses von ${id}`);
      if (childIds.has(childId) || FACTOR_IDS.includes(childId as InfluenceFactorId)) {
        throw new Error(`Einfluss-Matrix: Untereinfluss-ID ${childId} ist nicht eindeutig.`);
      }
      childIds.add(childId);
      readText(child.category, `Kategorie von ${childId}`);
      readBounded(child.baseWeight, `Grundgewicht von ${childId}`, 0, 1);
      readBounded(child.weight, `Anteil von ${childId}`, -1, 1);
      const source = readText(child.source, `Quelle von ${childId}`);
      if (!FACTOR_IDS.includes(source as InfluenceFactorId)) {
        throw new Error(`Einfluss-Matrix: Untereinfluss ${childId} liest unbekannte Quelle ${source}.`);
      }
    }
  }
  const contexts = readRecord(root.contexts, 'contexts');
  if (Object.keys(contexts).length === 0) throw new Error('Einfluss-Matrix: kein Kontext definiert.');
  for (const [name, entry] of Object.entries(contexts)) {
    const context = readRecord(entry, `Kontext ${name}`);
    readText(context.label, `Label von ${name}`);
    readBounded(context.threshold, `Schwelle von ${name}`, 0, 1);
    const weights = readRecord(context.weights, `Gewichte von ${name}`);
    for (const key of Object.keys(weights)) {
      if (!FACTOR_IDS.includes(key as InfluenceFactorId)) {
        throw new Error(`Einfluss-Matrix: Kontext ${name} gewichtet unbekannten Faktor ${key}.`);
      }
    }
    let sum = 0;
    let effective = 0;
    for (const id of FACTOR_IDS) {
      const weight = readBounded(weights[id], `Gewicht ${name}.${id}`, 0, 1);
      sum += weight;
      effective += weight * baseWeights.get(id)!;
    }
    if (sum <= 0) throw new Error(`Einfluss-Matrix: Kontext ${name} hat kein Gewicht.`);
    if (effective <= 0) throw new Error(`Einfluss-Matrix: Kontext ${name} hat kein wirksames Gewicht.`);
  }
  const defaultContext = readText(root.defaultContext, 'defaultContext');
  if (!Object.hasOwn(contexts, defaultContext)) {
    throw new Error(`Einfluss-Matrix: defaultContext ${defaultContext} ist unbekannt.`);
  }
  const furniture = readRecord(root.furnitureContexts, 'furnitureContexts');
  if (Object.keys(furniture).length === 0) throw new Error('Einfluss-Matrix: keine Moebel-Kontexte definiert.');
  for (const [kind, value] of Object.entries(furniture)) {
    const contextName = readText(value, `Kontext fuer Moebel ${kind}`);
    if (!Object.hasOwn(contexts, contextName)) {
      throw new Error(`Einfluss-Matrix: Moebel ${kind} zeigt auf unbekannten Kontext ${contextName}.`);
    }
  }
  if (!Array.isArray(root.cross)) throw new Error('Einfluss-Matrix: Cross-Kanten fehlen.');
  for (const entry of root.cross) {
    const edge = readRecord(entry, 'Cross-Kante');
    const from = readText(edge.from, 'Cross-Kante from');
    const to = readText(edge.to, 'Cross-Kante to');
    if (!FACTOR_IDS.includes(from as InfluenceFactorId) || !FACTOR_IDS.includes(to as InfluenceFactorId)) {
      throw new Error(`Einfluss-Matrix: Cross-Kante ${from}->${to} zeigt auf einen unbekannten Faktor.`);
    }
    readBounded(edge.weight, `Gewicht ${from}->${to}`, -1, 1);
    if (edge.contexts !== undefined) {
      if (!Array.isArray(edge.contexts) || edge.contexts.length === 0) {
        throw new Error(`Einfluss-Matrix: Cross-Kante ${from}->${to} hat keine gueltige Kontextliste.`);
      }
      for (const context of edge.contexts) {
        const name = readText(context, `Kontext von ${from}->${to}`);
        if (!Object.hasOwn(contexts, name)) {
          throw new Error(`Einfluss-Matrix: Cross-Kante ${from}->${to} nutzt unbekannten Kontext ${name}.`);
        }
      }
    }
  }
  validateEventPool(root.eventPool as EventPoolConfig, contexts);
}

/** Baut die typisierte Matrix aus dem JSON-Dokument; wirft bei jeder Abweichung. */
export function buildInfluenceConfig(raw: unknown): InfluenceConfig {
  const config = raw as InfluenceConfig;
  validateInfluenceConfig(config);
  return config;
}
