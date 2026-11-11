/**
 * Staging-Umfang: `git add -A` ist nur zulaessig, wenn jede Aenderung im
 * eigenen Claim liegt. Fremde Arbeit eines parallelen Agenten wird nicht
 * mitgenommen, sondern als Befund gemeldet.
 *
 * Die Pfadlogik kommt aus `lane-claims.mjs`; hier steht nur die Entscheidung,
 * welche geaenderten Pfade der Claim fuehrt. Eine zweite Allowlist-Auslegung
 * waere eine zweite Wahrheit.
 */
import { allowsPath, isTaskContractPath, MECHANICAL_FILES } from './lane-claims.mjs';
import { classifyWip, summarizeTakeover } from './takeover.mjs';

/**
 * Arbeitsdateien des Turns, die nie Inhalt des Commits sind.
 *
 * Die mechanischen Dateien stehen hier, weil `turn:finish` sie ohnehin stagt:
 * der Versions-Bump schreibt `package.json` und die Lockfile-Zeile, die
 * Inventur folgt den Generatoren. Ohne die Ausnahme meldet der zweite Lauf
 * `pnpm-lock.yaml` als fremde Arbeit und die Lane kommt nie zum Push, obwohl
 * nur die Versionszeile offen ist. Inhaltliche Aenderungen an denselben Dateien
 * bleiben gesperrt, weil `verify-lane-claims` sie als Meta-Dateien prueft.
 */
export const TURN_EXEMPT = Object.freeze(['.turn-notes.md', ...MECHANICAL_FILES]);

const normalize = (raw) => String(raw ?? '').replaceAll('\\', '/').trim();

/**
 * Teilt die geaenderten Pfade in erlaubt und fremd und klassifiziert jeden
 * Pfad als Takeover (kompatibel, unvollstaendig, korrupt). `ok` bleibt die
 * Staging-Wahrheit: nur Claim-Pfade werden gestaged. `takeover` sagt, was der
 * naechste Agent uebernehmen muss - fremd ist dort kein Besitzanspruch mehr.
 *
 * @param {{ changed: readonly string[], allowlist: readonly string[], exempt?: readonly string[], claims?: readonly object[], branch?: string, freezeUnlocked?: boolean }} input
 * @returns {{ allowed: string[], foreign: string[], ok: boolean, takeover: object }}
 */
export function scopeChanges({
  changed,
  allowlist,
  exempt = TURN_EXEMPT,
  claims = [],
  branch = '',
  freezeUnlocked = false,
}) {
  const allowed = [];
  const foreign = [];
  const entries = [];
  for (const raw of changed) {
    const file = normalize(raw);
    if (!file || exempt.includes(file)) continue;
    // Der Task-Vertrag ist Lane-Werkzeug; er braucht keinen Allowlist-Eintrag.
    if (isTaskContractPath(file) || allowsPath(allowlist, file)) allowed.push(file);
    else foreign.push(file);
    entries.push(classifyWip({ path: file, allowlist, claims, branch, freezeUnlocked }));
  }
  return { allowed, foreign, ok: foreign.length === 0, takeover: summarizeTakeover(entries) };
}

/**
 * Explizit uebergebene Pfade werden genauso streng geprueft wie geaenderte:
 * Sie muessen im Claim liegen. Zusaetzlich fallen absolute Pfade und `..`
 * heraus - ein Staging-Befehl darf den Arbeitsbaum nicht verlassen.
 */
export function explicitScope({ paths, allowlist, exempt = TURN_EXEMPT }) {
  const allowed = [];
  const foreign = [];
  for (const raw of paths ?? []) {
    const file = normalize(raw);
    if (!file || exempt.includes(file)) continue;
    const unsafe = file.startsWith('/')
      || /^[a-zA-Z]:\//.test(file)
      || file.split('/').includes('..');
    if (unsafe || (!isTaskContractPath(file) && !allowsPath(allowlist, file))) foreign.push(file);
    else allowed.push(file);
  }
  return { allowed: [...new Set(allowed)], foreign: [...new Set(foreign)], ok: foreign.length === 0 };
}
