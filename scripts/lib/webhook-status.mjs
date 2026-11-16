/**
 * Ist-Stand der Repo-Webhooks, ohne Secret.
 *
 * Gelesen wird ueber denselben REST-Pfad wie das Board (`rest('hooks')`).
 * Zurueckkommen nur Felder, die kein Geheimnis enthalten: Anzahl, `active`,
 * Events, Ziel-URL, letzte Zustellung. Das Secret legt GitHub nie offen.
 */
import { githubTokenSource, rest } from './github-rest.mjs';

/** Die Events, die den einen Ablauf speisen. */
export const HOOK_EVENTS = Object.freeze(['issues', 'issue_comment', 'pull_request', 'pull_request_review']);

/** Der eine Befehl, der einen fehlenden Hook anlegt (Secret aus der Umgebung). */
export function hookInstallCommand() {
  return 'RBD_WEBHOOK_SECRET=<secret> node scripts/install-webhook.mjs --url <oeffentliche-https-url> --events ' +
    HOOK_EVENTS.join(',');
}

/** Der fehlende Berechtigungssatz, wie GitHub ihn nennt. */
export const HOOK_PERMISSION = 'administration: write (fine-grained PAT) bzw. admin:repo_hook (klassisch)';

/**
 * Parser fuer eine echte Hooks-Antwort — separat testbar, ohne Netz.
 * Erwartet die GitHub-Liste, wie `GET /repos/{owner}/{repo}/hooks` sie liefert.
 */
export function parseHooks(data) {
  return (Array.isArray(data) ? data : []).map((hook) => ({
    id: Number(hook.id ?? 0),
    active: Boolean(hook.active),
    events: Array.isArray(hook.events) ? hook.events.map(String) : [],
    url: String(hook?.config?.url ?? ''),
    lastResponse: hook?.last_response ? String(hook.last_response.status ?? '') : '',
  }));
}

/**
 * @returns {{ ok: boolean, reachable: boolean, authenticated: boolean, tokenSource: string|null,
 *             hooks: object[], active: number, events: string[], url: string,
 *             error?: string, step?: string }}
 */
export function hookStatus({ repo = '' } = {}) {
  const result = rest('hooks', repo ? { repo } : {});
  const tokenSource = githubTokenSource();
  if (!result.ok) {
    return {
      ok: false,
      reachable: false,
      authenticated: Boolean(tokenSource),
      tokenSource,
      hooks: [],
      active: 0,
      events: [],
      url: '',
      error: String(result.error ?? 'unbekannt'),
      step: `Hook anlegen braucht ${HOOK_PERMISSION}: ${hookInstallCommand()}`,
    };
  }
  const hooks = parseHooks(result.data);
  const active = hooks.filter((hook) => hook.active).length;
  const primary = hooks.find((hook) => hook.active) ?? hooks[0] ?? null;
  const covered = primary ? HOOK_EVENTS.filter((event) => primary.events.includes(event) || primary.events.includes('*')) : [];
  return {
    ok: active > 0 && covered.length === HOOK_EVENTS.length,
    reachable: true,
    authenticated: Boolean(tokenSource),
    tokenSource,
    hooks,
    active,
    events: covered,
    url: primary ? primary.url : '',
    step: active > 0 && covered.length === HOOK_EVENTS.length
      ? ''
      : `Hook fehlt oder ist inaktiv (${active} aktiv, Events ${covered.join(',') || 'keine'}); anlegen mit ${hookInstallCommand()} — braucht ${HOOK_PERMISSION}`,
  };
}
