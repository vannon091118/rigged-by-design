/**
 * Matrix-Config: Faktoren, Untereinfluesse, Kontexte, Cross-Kanten und der
 * Main-Event-Pool. Die einzige Quelle der Gewichtungen ist
 * `influence-matrix.ts`; dieses Modul laedt und validiert sie fail-closed.
 */
import { RAW_INFLUENCE_MATRIX } from './influence-matrix';
import { buildInfluenceConfig } from './influence-schema';

export { FACTOR_IDS } from './influence-types';
export { validateInfluenceConfig } from './influence-schema';
export type { InfluenceConfig, InfluenceFactorId, InfluenceValues } from './influence-types';
export type { EventPoolConfig, EventPoolEntry } from './influence-event-pool';

/** Standardmatrix aus der versionierten JSON-Config. */
export const INFLUENCE_CONFIG = buildInfluenceConfig(RAW_INFLUENCE_MATRIX);
