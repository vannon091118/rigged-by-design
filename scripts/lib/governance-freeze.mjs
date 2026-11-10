/**
 * Governance-Freeze: die Steuerungsebene ist gesperrt, bis das Spiel steht.
 *
 * Der Freeze ist kein Kommentar in der Doku, sondern eine Pfadliste mit einer
 * Freigabe: jede inhaltliche Aenderung an `.github/`, `.githooks/`, `scripts/`,
 * `.lane-claims/` oder an den Governance-Vertraegen braucht eine Freigabe, die
 * nur mit PIN entsteht (`scripts/freeze-unlock.mjs`). Ohne Freigabe blockiert
 * der Pre-Commit-Hook lokal, und der Plan-Job in CI bleibt rot; den Befund
 * traegt ein BLOCKED-Issue. Der Branch wird nie geloescht.
 *
 * Zwei Grenzen sind bewusst:
 * - Mechanische Marker (`<!-- rbd-doc: ... -->`, Versionszeile) zaehlen nicht
 *   als Governance-Aenderung. Sonst wuerde jeder `docs:sync`-Lauf den Freeze
 *   ausloesen und die Sperre waere nur noch Rauschen.
 * - Der PIN steht nicht im Klartext im Repo, sondern nur als scrypt-Commitment.
 *   Das ist eine Sperre gegen versehentliche oder tooling-freie Aenderungen,
 *   kein kryptografisches Geheimnis: wer den Repo-Inhalt lesen und rechnen
 *   darf, kann ein vierstelliges Commitment offline pruefen. Wer echte
 *   Geheimhaltung braucht, legt den PIN zusaetzlich als Repository-Secret ab.
 *
 * Alles, was das Spiel voranbringt (`src/`, `content/`, `public/`), bleibt frei.
 */
import { execFileSync } from 'node:child_process';
import { createHash, scryptSync, timingSafeEqual } from 'node:crypto';
import { ROOT } from './report.mjs';

export const FREEZE = Object.freeze({
  active: true,
  since: '0.3.184',
  milestone: 'Stadt und Core-Loop stehen, mindestens § Progression-Zweige sind vollstaendig',
  errorCode: 'ERR-4030',
  corruption: 'Verdacht auf unautorisierte Korruption',
});

/** Pfade, die der Freeze schuetzt. Verzeichnisse enden mit `/`. */
export const GOVERNANCE_PATHS = Object.freeze([
  '.github/',
  '.githooks/',
  '.lane-claims/',
  'scripts/',
  'AGENTS.md',
  'docs/ARCHITECTURE.md',
  'docs/CI.md',
  'docs/GOVERNANCE.md',
  'docs/INDEX.md',
  'docs/WORKFLOW.md',
  'docs/capabilities.json',
  'docs/contracts/',
]);

/** Die Freigabe liegt als Datei im Commit, damit CI sie ohne PIN pruefen kann. */
export const FREEZE_UNLOCK_FILE = '.lane-claims/freeze-unlock.json';

/**
 * Lane-Werkzeug statt Steuerung: Claim-Dateien und die Freigabe beschreiben,
 * wer was tun darf, und aendern keine Gate-, Hook- oder Vertragslogik. Sie
 * zaehlen deshalb nicht als Governance-Aenderung - sonst braeuchte jede Lane
 * eine PIN-Freigabe fuer ihren eigenen Claim, und die Freigabe kollidierte mit
 * jedem anderen Claim, der `.lane-claims/` fuehrt.
 */
export const CLAIM_TOOLING_PATHS = Object.freeze(['.lane-claims/claims/', FREEZE_UNLOCK_FILE]);

/** True, wenn der Pfad Lane-Werkzeug ist (Claim-Datei oder Freigabe). */
export function isClaimTooling(file) {
  const path = String(file ?? '').replaceAll('\\', '/');
  return CLAIM_TOOLING_PATHS.some((entry) => (entry.endsWith('/') ? path.startsWith(entry) : path === entry));
}

const PIN_SALT = 'rbd-freeze-v1';
const PIN_KEYLEN = 32;
const PIN_OPTIONS = Object.freeze({ N: 16384, r: 8, p: 1 });

/** scrypt-Commitment des PIN. Kein Klartext, kein Rueckschluss durch Lesen. */
export const PIN_COMMITMENT = 'f68acea3a0cf786538f19fa2b08600ac23307ae760628c0d899c0a99b5af2003';

/**
 * Zeilen, die als mechanischer Pfad gelten: Doku-Marker und Versionszeile.
 * Dieselbe Auslegung nutzt der Commit-Gate-Fallback in `verify-lane-claims`.
 */
export const MARKER_LINE = /^[+-]\s*$|^[+-]\s*<!--\s*rbd-doc:.*-->\s*$|^[+-]\s*<!--\s*\/?rtk-instructions.*-->\s*$|^[+-]\s*"version":\s*".*",?\s*$/;

export function isMarkerLine(line) {
  return MARKER_LINE.test(String(line ?? ''));
}

/** True, wenn der Pfad unter dem Freeze steht. */
export function isGovernancePath(file) {
  const path = String(file ?? '').replaceAll('\\', '/');
  return GOVERNANCE_PATHS.some((entry) =>
    entry.endsWith('/') ? path === entry.slice(0, -1) || path.startsWith(entry) : path === entry,
  );
}

/**
 * Die Basis, gegen die der Freeze prueft: der Punkt, an dem die Lane von `main`
 * abzweigt. Lokal und in CI muessen dieselbe Basis sehen, sonst pruefen zwei
 * Gates zwei verschiedene Diffs - genau daran war der erste Freeze-Lauf rot
 * (lokal nur der letzte Commit, in CI die ganze Lane).
 *
 * Ein frisch gepushter Branch hat kein `before`; GitHub liefert dann den
 * Null-SHA. Deshalb ist die Merge-Basis der Normalfall und HEAD nur der
 * Rueckfall, wenn `main` lokal fehlt.
 */
export function laneBase(head = 'HEAD') {
  const git = (args) => {
    try {
      return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    } catch {
      return '';
    }
  };
  return (
    git(['merge-base', 'origin/main', head]) || git(['merge-base', 'main', head]) || git(['rev-parse', '--verify', head]) || ''
  );
}
/**
 * Die gesperrten Pfade einer Dateiliste, sortiert und ohne Doppelte. Die
 * Freigabe-Datei selbst zaehlt nicht: sie kann sich nicht mitfreigeben.
 */
export function governanceChanges(files) {
  return [...new Set((files ?? []).map((file) => String(file ?? '').replaceAll('\\', '/')))]
    .filter((file) => isGovernancePath(file) && !isClaimTooling(file))
    .sort();
}

/** True, wenn der PIN zum Commitment passt; Vergleich ohne Zeitleck. */
export function pinMatches(pin) {
  const candidate = scryptSync(String(pin ?? ''), PIN_SALT, PIN_KEYLEN, PIN_OPTIONS);
  const expected = Buffer.from(PIN_COMMITMENT, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

/** Token einer Freigabe: an Basis und Pfadliste gebunden, nicht wiederverwendbar. */
export function unlockToken({ base, paths }) {
  return createHash('sha256')
    .update(`rbd-freeze-unlock-v1|${base}|${[...paths].sort().join('\n')}|${PIN_COMMITMENT}`)
    .digest('hex');
}

/** Der Datensatz, den `freeze-unlock.mjs` schreibt. */
export function unlockRecord({ base, paths }) {
  const sorted = [...paths].sort();
  return {
    version: 1,
    base,
    paths: sorted,
    token: unlockToken({ base, paths: sorted }),
    note: 'Freigabe durch PIN-Eingabe; der PIN selbst steht nicht in dieser Datei.',
  };
}

/**
 * Prueft eine Freigabe gegen Basis und tatsaechliche Aenderung.
 *
 * Jede tatsaechlich geaenderte Steuerdatei muss in der Freigabe stehen; eine
 * andere Basis, ein fehlender Pfad oder ein fremder Token gilt nicht als
 * Freigabe. Zusaetzlich genannte Pfade sind erlaubt: die Generatoren im Hook
 * schreiben nach der Freigabe weitere Steuerdateien, und ein Gate, das daran
 * scheitert, blockiert Arbeit statt Korruption.
 */
export function verifyUnlockRecord(record, { base, paths }) {
  if (!record || typeof record !== 'object') return { ok: false, why: 'keine Freigabe-Datei' };
  if (record.version !== 1) return { ok: false, why: `unbekannte Freigabe-Version ${String(record.version)}` };
  if (!base || record.base !== base) return { ok: false, why: 'Freigabe gilt fuer eine andere Basis' };
  const expected = governanceChanges(paths);
  const recorded = Array.isArray(record.paths) ? [...record.paths].map(String).sort() : [];
  const missing = expected.filter((file) => !recorded.includes(file));
  if (missing.length > 0) {
    return { ok: false, why: `Freigabe deckt die Aenderung nicht (fehlt: ${missing.join(', ')})` };
  }
  const expectedToken = Buffer.from(unlockToken({ base, paths: recorded }), 'hex');
  const actual = Buffer.from(String(record.token ?? ''), 'hex');
  if (actual.length !== expectedToken.length || !timingSafeEqual(actual, expectedToken)) {
    return { ok: false, why: 'Freigabe-Token passt nicht' };
  }
  return { ok: true };
}
