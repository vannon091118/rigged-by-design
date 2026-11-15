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
import { evaluateIssueClaim, readIssueClaim } from './issue-claim.mjs';
import { rest } from './github-rest.mjs';

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
  // Ohne zweiten Pfad bleibt der erste Fehler stehen: er nennt den Grund.
  return fallback ?? primary;
}
