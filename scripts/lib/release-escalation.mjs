/**
 * Eskalationsleiter fuer Umgebungsprobleme im Release.
 *
 * Ein Workflow-Token darf je nach Repository-Einstellung nur lesen. Statt mit
 * einer nackten 403 abzubrechen, steigt der Lauf eine Stufe hoeher: transiente
 * Fehler werden wiederholt, ein hinterlegtes Release-Token uebernimmt, und erst
 * wenn keine Stufe mehr traegt, endet der Lauf mit einer Anleitung statt mit
 * einem Rauschen im Log.
 */

export const LEVELS = Object.freeze(['WORKFLOW_TOKEN', 'RELEASE_TOKEN', 'BLOCKED']);
export const MAX_RETRIES = 3;

const TRANSIENT = /(HTTP 5\d\d|HTTP 429|rate limit|timeout|timed out|ECONNRESET|ETIMEDOUT|socket hang up|temporarily unavailable)/i;
const PERMISSION = /(HTTP 403|HTTP 401|permission|forbidden|Resource not accessible|write access|admin rights|not authorized)/i;
const EXISTS = /(already exists|HTTP 422|Reference already exists|Validation Failed)/i;

export function classifyFailure(message) {
  const text = String(message ?? '');
  if (EXISTS.test(text)) return 'EXISTS';
  if (PERMISSION.test(text)) return 'PERMISSION';
  if (TRANSIENT.test(text)) return 'TRANSIENT';
  return 'UNKNOWN';
}

/**
 * Naechste Stufe. `DONE` heisst: das Ziel existiert schon. Liefert die Funktion
 * dieselbe Stufe zurueck, ist ein Wiederholungsversuch sinnvoll.
 */
export function escalate(level, kind, { hasElevatedToken = false } = {}) {
  if (kind === 'EXISTS') return 'DONE';
  if (kind === 'TRANSIENT' || kind === 'UNKNOWN') return level;
  if (level === 'WORKFLOW_TOKEN' && hasElevatedToken) return 'RELEASE_TOKEN';
  return 'BLOCKED';
}

/** Das Token der jeweiligen Stufe; leer heisst: diese Stufe ist nicht verfuegbar. */
export function tokenFor(level, env) {
  if (level === 'RELEASE_TOKEN') return env.RELEASE_TOKEN ?? '';
  if (level === 'WORKFLOW_TOKEN') return env.GITHUB_TOKEN ?? '';
  return '';
}

/** Klartext fuer den Abbruch: was fehlt, wo es steht, was danach hilft. */
export function blockedReason(kind) {
  if (kind === 'PERMISSION') {
    return 'Der Workflow-Token darf im Repository nicht schreiben. Entweder Settings -> Actions -> General '
      + '-> Workflow permissions auf "Read and write" stellen oder ein Repository-Secret RELEASE_TOKEN '
      + 'mit contents:write hinterlegen; danach den Lauf wiederholen.';
  }
  if (kind === 'TRANSIENT' || kind === 'UNKNOWN') {
    return `Das Release liess sich nach ${MAX_RETRIES} Versuchen nicht erstellen (Netzwerk oder API). `
      + 'Letzte Meldung steht im Job-Summary; Lauf wiederholen, sobald GitHub erreichbar ist.';
  }
  return 'Tag und Release konnten nicht erstellt werden; Ursache steht im Job-Summary.';
}
