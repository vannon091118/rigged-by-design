/**
 * Eine Aufloesungsstelle fuer das GitHub-Token.
 *
 * Eine frische Umgebung soll ohne Nutzeraktion funktionieren. Deshalb wird das
 * Token in genau dieser Reihenfolge gesucht — und nirgends sonst:
 *
 *   1. Environment-Token            `GH_TOKEN`, `GITHUB_TOKEN`, `githubPAT`,
 *                                   `GITHUB_PAT`, `GH_PAT`, `RBD_GH_TOKEN`
 *   2. `gh auth token`              bereits angemeldete `gh`-CLI
 *   3. `git credential fill`        vorhandener Git-Credential-Helper
 *
 * Es wird nichts geschrieben, nichts zwischengespeichert und nichts geloggt:
 * diese Datei gibt das Token nur an den Aufrufer zurueck, der es in einen
 * Authorization-Header legt. Kein zweiter Zustand, keine Config-Datei.
 *
 * Fehlt jede Quelle, bleibt `ok: false` — fail-closed, kein Raten. Der
 * Loesungsbefehl nennt dann die Variable, nicht einen interaktiven Login.
 */
import { execFileSync, spawnSync } from 'node:child_process';

/** Kurz halten: eine fehlende Quelle darf den Start nicht blockieren. */
const PROBE_TIMEOUT_MS = 4000;

/**
 * Alle Environment-Namen, unter denen ein Connector- oder Session-Token
 * ankommen kann. Die Reihenfolge ist Vertrag: `GH_TOKEN` gewinnt.
 */
export const ENV_TOKEN_NAMES = Object.freeze([
  'GH_TOKEN',
  'GITHUB_TOKEN',
  'githubPAT',
  'GITHUB_PAT',
  'GH_PAT',
  'RBD_GH_TOKEN',
]);

function fromEnvironment(env) {
  for (const name of ENV_TOKEN_NAMES) {
    if (env[name]) return { token: env[name], source: name };
  }
  return null;
}

function fromGhCli() {
  try {
    const token = execFileSync(process.env.RBD_GH_BIN || 'gh', ['auth', 'token'], {
      encoding: 'utf8',
      timeout: PROBE_TIMEOUT_MS,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return token ? { token, source: 'gh auth token' } : null;
  } catch {
    return null;
  }
}

function fromCredentialHelper() {
  const result = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    timeout: PROBE_TIMEOUT_MS,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  if (result.status !== 0) return null;
  const match = /^password=(.+)$/m.exec(result.stdout ?? '');
  const token = match?.[1]?.trim();
  return token ? { token, source: 'git-credential-helper' } : null;
}

/** Die Reihenfolge ist Vertrag; `tried` macht einen Fehlschlag diagnostizierbar. */
export function resolveGithubToken({ env = process.env } = {}) {
  const fromEnv = fromEnvironment(env);
  if (fromEnv) return { ok: true, ...fromEnv };
  for (const [name, probe] of [['gh auth token', fromGhCli], ['git-credential-helper', fromCredentialHelper]]) {
    const found = probe();
    if (found) return { ok: true, ...found };
  }
  return {
    ok: false,
    token: '',
    source: null,
    tried: [...ENV_TOKEN_NAMES, 'gh auth token', 'git-credential-helper'],
  };
}

/**
 * Der eine Befehl, der eine fehlende Quelle aufloest: die Variable nennen,
 * nicht einen interaktiven Login verlangen. `gh auth login` ist kein
 * Voraussetzungsschritt, weil derselbe Token-Pfad auch ohne CLI funktioniert.
 */
export const TOKEN_FIX_COMMAND = 'export GH_TOKEN=<token>';
