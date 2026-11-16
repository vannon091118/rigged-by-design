/**
 * Eine Aufloesungsstelle fuer das GitHub-Token.
 *
 * Eine frische Umgebung soll ohne Nutzeraktion funktionieren. Deshalb wird das
 * Token in genau dieser Reihenfolge gesucht — und nirgends sonst:
 *
 *   1. `GH_TOKEN`                     Projekt-/Repository-Secret, Cloud-Agent
 *   2. `GITHUB_TOKEN`                 in CI-Umgebungen automatisch vorhanden
 *   3. `gh auth token`                lokal nach `gh auth login`
 *   4. `git credential fill`          vorhandener Git-Credential-Helper
 *
 * Es wird nichts geschrieben, nichts zwischengespeichert und nichts geloggt:
 * diese Datei gibt das Token nur an den Aufrufer zurueck, der es in einen
 * Authorization-Header legt. Kein zweiter Zustand, keine Config-Datei.
 *
 * Fehlt jede Quelle, bleibt `ok: false` — fail-closed, kein Raten.
 */
import { execFileSync, spawnSync } from 'node:child_process';

/** Kurz halten: eine fehlende Quelle darf den Start nicht blockieren. */
const PROBE_TIMEOUT_MS = 4000;

function fromEnvironment(env) {
  if (env.GH_TOKEN) return { token: env.GH_TOKEN, source: 'GH_TOKEN' };
  if (env.GITHUB_TOKEN) return { token: env.GITHUB_TOKEN, source: 'GITHUB_TOKEN' };
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
  for (const probe of [env, null, null, null]) {
    if (probe === null) break;
    const found = fromEnvironment(probe);
    if (found) return { ok: true, ...found };
  }
  for (const [name, probe] of [['gh auth token', fromGhCli], ['git-credential-helper', fromCredentialHelper]]) {
    const found = probe();
    if (found) return { ok: true, ...found };
  }
  return { ok: false, token: '', source: null, tried: ['GH_TOKEN', 'GITHUB_TOKEN', 'gh auth token', 'git-credential-helper'] };
}

/** Der eine Befehl, der eine fehlende Quelle aufloest. */
export const TOKEN_FIX_COMMAND = 'gh auth login';
