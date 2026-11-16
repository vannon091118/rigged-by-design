/**
 * Zwei Lesepfade fuer das Board: `gh` und Token-REST.
 *
 * Arbeitsplaetze unterscheiden sich: manche haben eine angemeldete
 * `gh`-CLI, andere nur einen Git-Connector mit Token (`GH_TOKEN` /
 * `GITHUB_TOKEN`). Ein Gate, das nur `gh` kennt, blockiert dann Arbeit, obwohl
 * das Board lesbar waere. Dieses Modul kapselt den zweiten Pfad, damit die
 * Aufrufer dieselbe Form bekommen wie von `gh --json`.
 *
 * Bevorzugt wird immer `gh` (kennt Auth und Scopes selbst); REST ist der
 * Fallback. Ohne Token bleibt der Zustand `unknown` — fail-closed, kein Raten.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveGithubToken } from './credentials.mjs';

const HELPER = fileURLToPath(new URL('./github-rest-fetch.mjs', import.meta.url));

/** Ein Token aus der einen Aufloesungsstelle (`credentials.mjs`). */
export function githubToken(env = process.env) {
  return resolveGithubToken({ env }).token;
}

/** Woher das Token kommt, ohne den Wert zu nennen. */
export function githubTokenSource(env = process.env) {
  const resolution = resolveGithubToken({ env });
  return resolution.ok ? resolution.source : null;
}

/** Ein REST-Aufruf, synchron ueber den Helferprozess. */
export function rest(kind, params = {}) {
  if (!githubToken()) return { ok: false, error: 'kein Token (GH_TOKEN oder GITHUB_TOKEN)' };
  const helper = process.env.RBD_REST_SCRIPT || HELPER;
  try {
    const output = execFileSync(process.execPath, [helper, kind, JSON.stringify(params)], {
      encoding: 'utf8',
      timeout: 20000,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, data: JSON.parse(output) };
  } catch (error) {
    const stderr = String(error?.stderr ?? '').trim().split('\n')[0];
    return { ok: false, error: stderr || (error instanceof Error ? error.message.split('\n')[0] : 'unbekannt') };
  }
}

/**
 * Uebersetzt die `gh`-Aufrufe des Gates in REST-Abfragen.
 * Unbekannte Aufrufe geben `null` zurueck; dann bleibt es beim `gh`-Ergebnis.
 */
export function restForGhArgs(args = []) {
  const list = Array.isArray(args) ? args.map(String) : [];
  if (list[0] === 'issue' && list[1] === 'view' && list[2]) {
    return { kind: 'issue-view', params: { number: Number(list[2]) } };
  }
  if (list[0] === 'issue' && list[1] === 'list') {
    const labelAt = list.indexOf('--label');
    const limitAt = list.indexOf('--limit');
    const stateAt = list.indexOf('--state');
    return {
      kind: 'issue-list',
      params: {
        label: labelAt >= 0 ? list[labelAt + 1] : undefined,
        limit: limitAt >= 0 ? Number(list[limitAt + 1]) : undefined,
        state: stateAt >= 0 ? list[stateAt + 1] : 'open',
      },
    };
  }
  if (list[0] === 'pr' && list[1] === 'view' && list[2]) {
    // Die Feldliste kommt kommagetrennt als ein Argument (`--json a,b,c`).
    const jsonAt = list.indexOf('--json');
    const fields = jsonAt >= 0 ? String(list[jsonAt + 1] ?? '') : '';
    const withComments = /(^|,)(comments|statusCheckRollup)(,|$)/.test(fields);
    return {
      kind: withComments ? 'ci-for-branch' : 'pull-for-branch',
      params: { branch: list[2] },
    };
  }
  return null;
}

/** Ein REST-Aufruf fuer einen `gh`-Aufruf; `null` wenn nicht uebersetzbar. */
export function restForGhCall(args, { attempts = 1 } = {}) {
  const mapped = restForGhArgs(args);
  if (!mapped) return null;
  let last = null;
  for (let attempt = 0; attempt < Math.max(1, attempts); attempt += 1) {
    last = rest(mapped.kind, mapped.params);
    if (last.ok) return last;
  }
  return last;
}
