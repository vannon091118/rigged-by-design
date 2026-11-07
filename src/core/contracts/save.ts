/**
 * Contract: save v1.0
 * Save-Envelope mit Versionierung, Migration-Registry und deterministischer
 * Roundtrip-Regel.
 *
 * Minimaler kompilierbarer Stub. Keine Vorimplementierung, keine zweite
 * State-Truth. Dieser Contract fixiert nur kleinste gemeinsame Invarianten.
 * Die Exporte werden von Contract-Consumer-Lanes genutzt (siehe lane/contracts/*).
 * @dead-code-exception: Contract-Stub, Exporte werden von späteren Lanes importiert.
 */

export type SaveVersion = number;
export type SaveId = string;

/** Eine verspeicherte Envelope: unveränderlich nach Erstellung. */
export interface SaveEnvelope {
  readonly version: SaveVersion;
  readonly id: SaveId;
  readonly timestamp: number;
  readonly data: unknown;
}

/** Erstellt eine neue Save-Envelope. Wirft bei ungültigen Werten. */
export function createSaveEnvelope(
  version: SaveVersion,
  id: SaveId,
  data: unknown,
): SaveEnvelope {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error('save: version muss eine positive sichere Ganzzahl sein');
  }
  if (!id || typeof id !== 'string') {
    throw new Error('save: id darf nicht leer sein und muss ein String sein');
  }
  if (data === undefined) {
    throw new Error('save: data darf nicht undefined sein');
  }
  return {
    version,
    id,
    timestamp: 0,
    data,
  };
}

/** Prüft, ob eine Save-Envelope die Invarianten erfüllt. */
export function validateSaveEnvelope(envelope: SaveEnvelope): boolean {
  if (!envelope || typeof envelope !== 'object') return false;
  if (!Number.isSafeInteger(envelope.version) || envelope.version < 1) return false;
  if (!envelope.id || typeof envelope.id !== 'string') return false;
  if (!Number.isSafeInteger(envelope.timestamp) || envelope.timestamp < 0) return false;
  if (envelope.data === undefined) return false;
  return true;
}
