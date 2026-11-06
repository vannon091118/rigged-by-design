/**
 * Versionierter Layout-Export und -Import. Das Dokument enthaelt nur den
 * Layout-Vertrag, keine Laufzeitfelder; der Import ist fail-closed und nutzt
 * dieselbe Pruefung wie ein Save.
 */
import type { LayoutState } from './layout-types';
import { parseLayout } from './layout-validate';

const LAYOUT_JSON_FORMAT = 'rbd-layout';
export const LAYOUT_JSON_VERSION = 1;

type LayoutImport =
  | { readonly ok: true; readonly layout: LayoutState }
  | { readonly ok: false; readonly issues: readonly string[] };

/** Deterministische Bytes: feste Schluesselreihenfolge, zwei Leerzeichen, keine Zeit. */
export function exportLayout(layout: LayoutState): string {
  return JSON.stringify({
    format: LAYOUT_JSON_FORMAT,
    version: LAYOUT_JSON_VERSION,
    layout: {
      size: layout.size,
      floor: [...layout.floor],
      zones: layout.zones.map((zone) => ({ ...zone })),
      edges: layout.edges.map((edge) => ({ ...edge })),
    },
  }, null, 2);
}

/** Fremde Formate, unbekannte Versionen und ungueltige Layouts kommen nie durch. */
export function importLayout(text: string): LayoutImport {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, issues: ['Layout ist kein gueltiges JSON.'] };
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return { ok: false, issues: ['Layout-Dokument ist kein Objekt.'] };
  }
  const document = raw as Record<string, unknown>;
  const issues: string[] = [];
  if (document.format !== LAYOUT_JSON_FORMAT) issues.push('Unbekanntes Layout-Format.');
  if (document.version !== LAYOUT_JSON_VERSION) issues.push(`Unbekannte Layout-Version: ${String(document.version)}.`);
  const allowed = new Set(['format', 'version', 'layout']);
  for (const key of Object.keys(document)) if (!allowed.has(key)) issues.push(`Fremdes Feld: ${key}.`);
  if (issues.length > 0) return { ok: false, issues };
  return parseLayout(document.layout);
}
