/**
 * Jeder Sync-Befehl fragt den Hook-Stand live bei GitHub ab.
 *
 * `hookStatus()` liest ueber `rest('hooks')` den echten Repo-Zustand; hier
 * entsteht daraus genau eine Zeile, die jeder Sync-Befehl ausgibt. Kein
 * Cache, kein Snapshot: wer synchronisiert, sieht den Stand, der bei GitHub
 * gerade gilt — oder den Grund, warum er nicht abfragbar ist.
 *
 * Die Zeile ist Ausgabe im 500-Token-Budget und ersetzt keine Entscheidung:
 * ein fehlender Hook ist ein Befund mit Anlegebefehl, kein stiller Fallback.
 */
import { hookStatus } from './webhook-status.mjs';

/** Eine Zeile fuer den Sync-Lauf; `status` ist fuer Tests injizierbar. */
export function liveHookLine({ status = null } = {}) {
  const state = status ?? hookStatus({});
  if (!state.ok && state.error) {
    return `hooks: live nicht abfragbar (${state.error})${state.step ? ` · ${state.step}` : ''}`;
  }
  const events = state.events.length > 0 ? state.events.join(',') : 'keine';
  if (!state.ok) {
    return `hooks: live ${state.active} aktiv, Events ${events}${state.step ? ` · ${state.step}` : ''}`;
  }
  return `hooks: live ${state.active} aktiv, Events ${events}${state.url ? ` · ${state.url}` : ''}`;
}

/** Schreibt die Zeile und gibt sie zurueck (ein Aufruf, eine Wahrheit). */
export function reportLiveHooks({ status = null, log = console.log } = {}) {
  const line = liveHookLine({ status });
  log(line);
  return line;
}
