/**
 * Board lesen mit zwei Wegen — ein Ergebnis.
 *
 * Arbeitsplaetze unterscheiden sich: manche haben eine angemeldete `gh`-CLI,
 * andere nur einen Git-Connector mit Token (`GH_TOKEN`/`GITHUB_TOKEN`). Beide
 * muessen denselben Claim-Verlauf lesen koennen, sonst blockiert das Gate
 * Arbeit, obwohl das Board erreichbar ist.
 *
 * Reihenfolge: `gh` zuerst (kennt Auth und Scopes), dann REST. Ist keiner der
 * beiden lesbar, bleibt der Zustand `unknown` — fail-closed, kein Raten.
 * Bewusst getrennt von `issue-claim.mjs`: dessen Parser bleibt unveraendert,
 * damit parallele Lanes an derselben Datei nicht kollidieren.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateIssueClaim, readIssueClaim } from './issue-claim.mjs';
import { rest } from './github-rest.mjs';
import { ROOT } from './report.mjs';

/** Ein Cache gilt nur kurz und nur fuer genau ein Issue. */
export const BOARD_CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const boardCachePath = (number, root = ROOT) =>
  join(root, '.verify-cache', 'board-cache', `${Number(number)}.json`);

/**
 * Letzter Weg, nur wenn gh und REST **nicht erreichbar** sind: ein zuvor aus
 * GitHub gelesener Schnappschuss. Antwortet das Remote (Issue fehlt, closed,
 * fremder Claim), wird der Cache nie befragt — das bleibt fail-closed.
 */
function claimViaCache({ number, agent, actors, now = Date.now(), staleHours }) {
  const path = boardCachePath(number);
  if (!existsSync(path)) return null;
  try {
    const cached = JSON.parse(readFileSync(path, 'utf8'));
    const fetchedAt = Date.parse(String(cached.fetchedAt ?? ''));
    if (!Number.isFinite(fetchedAt) || now - fetchedAt > BOARD_CACHE_MAX_AGE_MS) return null;
    if (Number(cached.number) !== Number(number) || !Array.isArray(cached.comments)) return null;
    return {
      checked: true,
      number,
      state: String(cached.state ?? '').toUpperCase(),
      labels: labelsOf(cached),
      comments: cached.comments,
      ...evaluateIssueClaim({ comments: cached.comments, agent, now, staleHours, actors }),
      source: 'cache',
      cachedAt: cached.fetchedAt,
    };
  } catch {
    return null;
  }
}

function labelsOf(issue) {
  return (issue?.labels ?? [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

/** Ein Issue-Verlauf ueber den Token-Connector, in gh-Form. */
function claimViaRest({ number, agent, actors, now, staleHours }) {
  const result = rest('issue-view', { number });
  if (!result.ok || !result.data) return null;
  const issue = result.data;
  const comments = Array.isArray(issue.comments) ? issue.comments : [];
  return {
    checked: true,
    number,
    state: String(issue.state ?? '').toUpperCase(),
    labels: labelsOf(issue),
    comments,
    ...evaluateIssueClaim({ comments, agent, now, staleHours, actors }),
    source: 'rest',
  };
}

/**
 * Claim-Lage eines Issues, unabhaengig vom Lesepfad.
 * @param {{ number?: number|null, agent?: string, actors?: object, cwd?: string,
 *           now?: number, staleHours?: number }} input
 */
export function readIssueClaimAny({ number, agent = '', actors = {}, cwd, now, staleHours } = {}) {
  const primary = readIssueClaim({ number, agent, cwd, now, staleHours, actors });
  if (primary.checked) return { ...primary, source: 'gh' };
  const fallback = number ? claimViaRest({ number, agent, actors, now, staleHours }) : null;
  if (fallback) return fallback;
  // gh und REST sind nicht erreichbar. Ein frischer, aus GitHub gelesener
  // Schnappschuss entscheidet deterministisch; fehlt er, bleibt der Fehler.
  const cached = number ? claimViaCache({ number, agent, actors, now, staleHours }) : null;
  return cached ?? primary;
}
