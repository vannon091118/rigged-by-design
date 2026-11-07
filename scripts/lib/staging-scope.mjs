/**
 * Staging-Umfang: `git add -A` ist nur zulaessig, wenn jede Aenderung im
 * eigenen Claim liegt. Fremde Arbeit eines parallelen Agenten wird nicht
 * mitgenommen, sondern als Befund gemeldet.
 *
 * Die Pfadlogik kommt aus `lane-claims.mjs`; hier steht nur die Entscheidung,
 * welche geaenderten Pfade der Claim fuehrt. Eine zweite Allowlist-Auslegung
 * waere eine zweite Wahrheit.
 */
import { allowsPath } from './lane-claims.mjs';

/** Arbeitsdateien des Turns, die nie Inhalt des Commits sind. */
export const TURN_EXEMPT = Object.freeze(['.turn-notes.md']);

const normalize = (raw) => String(raw ?? '').replaceAll('\\', '/').trim();

/**
 * Teilt die geaenderten Pfade in erlaubt und fremd.
 *
 * @param {{ changed: readonly string[], allowlist: readonly string[], exempt?: readonly string[] }} input
 * @returns {{ allowed: string[], foreign: string[], ok: boolean }}
 */
export function scopeChanges({ changed, allowlist, exempt = TURN_EXEMPT }) {
  const allowed = [];
  const foreign = [];
  for (const raw of changed) {
    const file = normalize(raw);
    if (!file || exempt.includes(file)) continue;
    if (allowsPath(allowlist, file)) allowed.push(file);
    else foreign.push(file);
  }
  return { allowed, foreign, ok: foreign.length === 0 };
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
    if (unsafe || !allowsPath(allowlist, file)) foreign.push(file);
    else allowed.push(file);
  }
  return { allowed: [...new Set(allowed)], foreign: [...new Set(foreign)], ok: foreign.length === 0 };
}
