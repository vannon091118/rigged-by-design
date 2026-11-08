/**
 * Contract: factor v1.1
 * Factor-IDs, Kategorie, Grundgewicht, Untereinflüsse, Kontext und Trace.
 *
 * Additiv gegenueber v1.0: `category`, `baseWeight` und `children` sind
 * Pflichtfelder des Laufzeit-Faktors, `createFactor` setzt fuer alte Aufrufer
 * neutrale Defaults. Der Factor beschreibt weiterhin weder Raum noch Objekt,
 * sondern welchen Beitrag er mit welchem Kontext und welcher Trace traegt.
 * Die Exporte werden von der Influence-Matrix und den Contract-Tests genutzt.
 * @dead-code-exception: Contract-Stub, Exporte werden von spaeteren Lanes importiert.
 */

export type FactorId = string;

/** String-zu-String-Kontext eines Factors. */
export type FactorContext = Record<string, string>;

/** Unveränderliche Spur von Beitrags-IDs. */
export type ContributionTrace = readonly string[];

/** Untereinfluss eines Factors: eigene ID, Kategorie, Grundgewicht und Anteil. */
export interface FactorChild {
  readonly id: string;
  readonly category: string;
  /** Globaler Multiplikator des Untereinflusses (0..1). */
  readonly baseWeight: number;
  /** Anteil am Oberfaktor (-1..1); negativ ist eine Gegenwirkung. */
  readonly weight: number;
}

/** Optionale Metadaten; alte Aufrufer bleiben gueltig. */
export interface FactorOptions {
  readonly category?: string;
  readonly baseWeight?: number;
  readonly children?: readonly FactorChild[];
}

/** Ein benannter Factor mit Kategorie, Grundgewicht, Kindern, Kontext und Trace. */
export interface Factor {
  readonly id: FactorId;
  readonly category: string;
  readonly baseWeight: number;
  readonly children: readonly FactorChild[];
  readonly context: FactorContext;
  readonly contributions: ContributionTrace;
}

/** Erstellt eine validierte Factor-ID. Wirft bei leerer ID. */
export function createFactorId(id: FactorId): FactorId {
  if (!id || typeof id !== 'string') {
    throw new Error('factor: Factor-ID darf nicht leer sein');
  }
  return id;
}

/** Erstellt einen neuen Factor. Wirft bei ungültiger ID. */
export function createFactor(
  id: FactorId,
  context: FactorContext,
  contributions: ContributionTrace,
  options: FactorOptions = {},
): Factor {
  createFactorId(id);
  return {
    id,
    category: options.category ?? 'ALLGEMEIN',
    baseWeight: options.baseWeight ?? 1,
    children: options.children ?? [],
    context,
    contributions,
  };
}

const finiteInRange = (value: unknown, min: number, max: number): boolean =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

/** Prüft, ob ein Factor die Invarianten erfüllt. */
export function validateFactor(factor: Factor): boolean {
  if (!factor || typeof factor.id !== 'string' || !factor.id) return false;
  if (typeof factor.category !== 'string' || !factor.category.trim()) return false;
  if (!finiteInRange(factor.baseWeight, 0, 1)) return false;
  if (!Array.isArray(factor.children)) return false;
  const childIds = new Set<string>();
  for (const child of factor.children) {
    if (!child || typeof child.id !== 'string' || !child.id || childIds.has(child.id)) return false;
    if (typeof child.category !== 'string' || !child.category.trim()) return false;
    if (!finiteInRange(child.baseWeight, 0, 1)) return false;
    if (!finiteInRange(child.weight, -1, 1)) return false;
    childIds.add(child.id);
  }
  if (!factor.context || typeof factor.context !== 'object') return false;
  for (const [key, value] of Object.entries(factor.context)) {
    if (typeof key !== 'string' || typeof value !== 'string') return false;
  }
  if (!Array.isArray(factor.contributions)) return false;
  for (const entry of factor.contributions) {
    if (typeof entry !== 'string') return false;
  }
  return true;
}
