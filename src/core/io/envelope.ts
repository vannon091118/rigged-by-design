/** Umschlag fuer Spielstand-Exporte: Art, Format, Pruefsumme, Nutzlast. */
import { issue, type TransferIssue } from './issues';

const TRANSFER_KIND = 'rbd-save';
const TRANSFER_FORMAT = 1;

export interface TransferEnvelope {
  readonly kind: string;
  readonly format: number;
  readonly savedAt: string;
  readonly checksum: string;
  readonly payload: unknown;
}

/** FNV-1a, 32 Bit: erkennt abgeschnittene oder veraenderte Exporte ohne Krypto-Abhaengigkeit. */
function checksum(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildEnvelope(payload: unknown, savedAt: string): TransferEnvelope {
  return {
    kind: TRANSFER_KIND,
    format: TRANSFER_FORMAT,
    savedAt,
    checksum: checksum(JSON.stringify(payload)),
    payload,
  };
}

/** Liest nur den Umschlag; die Nutzlast prueft und repariert repairPayload. */
export function parseEnvelope(raw: string): { envelope: TransferEnvelope | null; issues: readonly TransferIssue[] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { envelope: null, issues: [issue('FATAL', 'json', 'Kein gueltiges JSON.')] };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { envelope: null, issues: [issue('FATAL', 'json', 'Export ist kein Objekt.')] };
  }
  const candidate = parsed as Partial<TransferEnvelope>;
  if (candidate.kind !== TRANSFER_KIND) {
    return { envelope: null, issues: [issue('FATAL', 'kind', 'Fremdes Format: kein Spielstand-Export.')] };
  }
  if (typeof candidate.format !== 'number' || candidate.format > TRANSFER_FORMAT) {
    return { envelope: null, issues: [issue('FATAL', 'format', 'Format stammt aus einer neueren Version.')] };
  }
  if (typeof candidate.checksum !== 'string' || candidate.checksum !== checksum(JSON.stringify(candidate.payload))) {
    return { envelope: null, issues: [issue('FATAL', 'checksum', 'Pruefsumme passt nicht zur Nutzlast.')] };
  }
  return {
    envelope: {
      kind: TRANSFER_KIND,
      format: candidate.format,
      savedAt: typeof candidate.savedAt === 'string' ? candidate.savedAt : '',
      checksum: candidate.checksum,
      payload: candidate.payload,
    },
    issues: [],
  };
}
