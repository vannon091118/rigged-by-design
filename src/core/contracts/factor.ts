/**
 * Contract: factor v1.0
 * Factor-IDs, Kontext und Contribution-Trace.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Explizit ohne Raum- oder Objektrollen: ein Factor beschreibt weder wo noch
 * welches Objekt, sondern nur welchen Beitrag mit welchem Kontext und welcher
 * Trace. Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type FactorId = string;

/** String-zu-String-Kontext eines Factors. */
export type FactorContext = Record<string, string>;

/** Unveränderliche Spur von Beitrags-IDs. */
export type ContributionTrace = readonly string[];

/** Ein benannter Factor mit Kontext und Contribution-Trace. */
export interface Factor {
  readonly id: FactorId;
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
): Factor {
  createFactorId(id);
  return {
    id,
    context,
    contributions,
  };
}

/** Prüft, ob ein Factor die Invarianten erfüllt. */
export function validateFactor(factor: Factor): boolean {
  if (!factor || typeof factor.id !== 'string' || !factor.id) return false;
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
