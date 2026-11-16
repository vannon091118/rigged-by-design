/**
 * `gh` nur feststellen, nie nachladen.
 *
 * FREEZE-0: Startskripte laden keine ungeprüften Binärdateien aus dem Netz.
 * Fehlt die CLI, nennt der Aufrufer den Installationsweg; der Start scheitert
 * nicht daran, weil eine fehlende `gh` kein Projekt-Blocker ist.
 */
import { execFileSync } from 'node:child_process';

export const GH_INSTALL_URL = 'https://cli.github.com';

/** Der Name, unter dem `gh` gesucht wird. */
export function ghBinary() {
  return process.env.RBD_GH_BIN || 'gh';
}

/** Ist `gh` da? Reine Lese-Probe mit Timeout. */
export function ghStatus() {
  try {
    const version = execFileSync(ghBinary(), ['--version'], {
      encoding: 'utf8',
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n')[0];
    return { present: true, version, path: ghBinary() };
  } catch {
    return { present: false, version: null, path: null };
  }
}

/**
 * Kontext fuer den naechsten Schritt. Kein Download, kein Schreibzugriff:
 * `install` ist immer ein Hinweis, nie eine ausgefuehrte Aktion.
 */
export function ensureGh() {
  const status = ghStatus();
  return {
    ...status,
    attempted: false,
    install: status.present
      ? null
      : { ok: false, skipped: true, reason: 'kein automatischer Download (FREEZE-0)', url: GH_INSTALL_URL },
  };
}
