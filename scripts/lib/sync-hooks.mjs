/**
 * Jeder Sync-Befehl fragt den Hook-Stand live bei GitHub ab.
 *
 * `hookStatus()` liest ueber `rest('hooks')` den echten Repo-Zustand; hier
 * entsteht daraus genau eine Zeile, die jeder Sync-Befehl ausgibt. Kein
 * Cache, kein Snapshot: wer synchronisiert, sieht den Stand, der bei GitHub
 * gerade gilt — oder den Grund, warum er nicht abfragbar ist.
 *
 * Die Zeile nennt auch die Authentifizierung: `authentifiziert via GH_TOKEN`
 * heisst, die Antwort kam mit Token (und damit mit dem Scope des Tokens);
 * `anonym` heisst, GitHub hat ohne Token geantwortet. Der Tokenwert selbst
 * wird nie ausgegeben.
 */
import { hookStatus } from './webhook-status.mjs';

/** Eine Zeile fuer den Sync-Lauf; `status` ist fuer Tests injizierbar. */
export function liveHookLine({ status = null } = {}) {
  const state = status ?? hookStatus({});
  const via = state.authenticated ? `authentifiziert via ${state.tokenSource ?? 'Token'}` : 'anonym';
  if (!state.ok && state.error) {
    return `hooks: live nicht abfragbar (${state.error}, ${via})${state.step ? ` · ${state.step}` : ''}`;
  }
  const events = state.events.length > 0 ? state.events.join(',') : 'keine';
  if (!state.ok && state.active === 0) {
    return `hooks: live 0 aktiv, ${via} · keine Hooks${state.step ? `; ${state.step}` : ''}`;
  }
  const url = state.url ? ` · ${state.url}` : '';
  if (!state.ok) {
    return `hooks: live ${state.active} aktiv, Events ${events}, ${via}${url}${state.step ? `; ${state.step}` : ''}`;
  }
  return `hooks: live ${state.active} aktiv, Events ${events}, ${via}${url}`;
}

/** Schreibt die Zeile und gibt sie zurueck (ein Aufruf, eine Wahrheit). */
export function reportLiveHooks({ status = null, log = console.log } = {}) {
  const line = liveHookLine({ status });
  log(line);
  return line;
}
