/** Repariert, was ohne Regelverstoss reparierbar ist; Blocker bleiben Blocker. */
import { issue, type TransferIssue } from './issues';

const SAVE_VERSIONS = new Set([5, 6, 7, 8]);

function number(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Prueft die Nutzlast, ergaenzt fehlende Pflichtfelder und meldet jede Reparatur. */
export function repairPayload(payload: unknown): { payload: Record<string, unknown>; issues: readonly TransferIssue[]; repairs: number } {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return { payload: {}, issues: [issue('FATAL', 'payload', 'Nutzlast ist kein Objekt.')], repairs: 0 };
  }
  const source = payload as Record<string, unknown>;
  const repaired: Record<string, unknown> = { ...source };
  const issues: TransferIssue[] = [];
  let repairs = 0;
  if (!SAVE_VERSIONS.has(number(source.version, 0))) issues.push(issue('FATAL', 'version', 'Unbekannte Save-Version.'));
  if (typeof source.template !== 'string') issues.push(issue('FATAL', 'template', 'Vorlage fehlt.'));
  if (!Array.isArray(source.guests) || !Array.isArray(source.furniture)) {
    issues.push(issue('FATAL', 'world', 'Gaeste oder Moebel fehlen.'));
  }
  if (!Array.isArray(source.entries)) {
    repaired.entries = [];
    repairs += 1;
    issues.push(issue('REPAIR', 'entries', 'Ledger-Zeilen fehlten und wurden als leer ergaenzt.'));
  }
  if (!Number.isFinite(source.prngState)) {
    repaired.prngState = 1;
    repairs += 1;
    issues.push(issue('REPAIR', 'prngState', 'Zufallsstand war ungueltig und wurde zurueckgesetzt.'));
  }
  for (const key of ['tick', 'day', 'nextGuestId'] as const) {
    if (!Number.isFinite(source[key])) {
      repaired[key] = 0;
      repairs += 1;
      issues.push(issue('REPAIR', key, `${key} war ungueltig und wurde auf 0 gesetzt.`));
    }
  }
  return { payload: repaired, issues, repairs };
}
