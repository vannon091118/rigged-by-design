/**
 * Eine Wahrheit fuer die Pflichtsektionen einer Commit-Nachricht.
 *
 * `verify-commit-msg` prueft damit Commit, Datei, PR-Body und Push-Bereich.
 * `merge-commit-message` baut damit den Text, den ein Squash-Merge als
 * `commit_message` tragen muss. Beide lesen dieselben Ueberschriften und
 * dieselbe Inhaltsregel: es gibt keinen zweiten, weicheren Massstab.
 *
 * Fehlt eine Sektion, entsteht keine Nachricht - der Bauer ist keine Umgehung,
 * sondern der Weg, auf dem der PR-Body unveraendert zum Commit-Body wird.
 */
export const SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);

const FORBIDDEN = /Co-authored-by:|Generated with|\bFreebuff\b|\bCodebuff\b|\bClaude\b|\bAnthropic\b|\bOpenAI\b|\bCursor\b|Signed-off-by:|\[(?:Codebuff|Freebuff)\]/i;
// Eine Pflichtsektion ist eine Ueberschrift im Body, kein Titel. Genau dieses
// Muster stand mehrfach als Commit-Subject in der Historie und passierte das
// Gate, weil Titel-Laenge und Sektionen fuer sich korrekt waren.
const MARKDOWN_SUBJECT = /^#{1,6}\s/;

/** Alle Verstoesse eines Textes; `pr` prueft nur die Trailer-Regel. */
export function messageViolations(text, { pr = false } = {}) {
  const found = [];
  const trailer = FORBIDDEN.exec(String(text ?? ''));
  if (trailer) found.push({ code: 'ERR-4005', message: `verbotener Drittanbieter-Trailer: ${trailer[0]}` });
  if (pr) return found;
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim());
  if (!lines[0] || lines[0].length < 8) found.push({ code: 'ERR-4006', message: 'deutscher Update-Titel fehlt' });
  else if (MARKDOWN_SUBJECT.test(lines[0])) {
    found.push({ code: 'ERR-4006', message: 'Titel ist eine Markdown-Ueberschrift statt einer Aussage' });
  }
  let previous = -1;
  for (const section of SECTIONS) {
    const at = lines.indexOf(section);
    if (at < 0) {
      found.push({ code: 'ERR-4006', message: `Pflichtsektion fehlt: ${section}` });
      continue;
    }
    if (at < previous) found.push({ code: 'ERR-4006', message: `Sektion in falscher Reihenfolge: ${section}` });
    previous = at;
    const next = lines.findIndex((line, position) => position > at && line.startsWith('### '));
    const body = lines.slice(at + 1, next < 0 ? undefined : next).filter((line) => line.startsWith('- '));
    if (body.length === 0 || body.every((line) => line.length < 8)) {
      found.push({ code: 'ERR-4006', message: `Sektion ohne echten Inhalt: ${section}` });
    }
  }
  return found;
}

/**
 * Squash-Nachricht aus Titel und PR-Body: Titelzeile, Leerzeile, Body.
 *
 * Der Body bleibt woertlich; angehaengt wird nichts. Ist er nicht konform,
 * gibt es keine Nachricht (`ok: false`) - der Aufrufer merged dann nicht.
 */
export function squashMessage({ title = '', body = '' } = {}) {
  const subject = String(title ?? '').replace(/\r?\n/g, ' ').trim();
  const text = String(body ?? '').replace(/\r\n/g, '\n').trim();
  // Geprueft wird die fertige Nachricht, nicht der Body allein: dessen erste
  // Zeile ist eine Pflichtsektion und waere als Titel falsch bewertet.
  const violations = messageViolations(`${subject}\n\n${text}`);
  if (violations.length > 0) return { ok: false, message: '', violations };
  return { ok: true, message: `${subject}\n\n${text}`, violations: [] };
}
