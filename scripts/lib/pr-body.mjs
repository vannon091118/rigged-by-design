/**
 * PR-Body: die drei Pflichtsektionen werden im Plan-Job geprueft, nicht als
 * Issue im Watcher. Ein fehlender Body ist damit ein Gate-Fehler am PR und
 * erzeugt keine zweite Issue-Wahrheit.
 */
export const PR_BODY_SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);

/** Fehlende oder leere Pflichtsektionen; reine Ueberschriften zaehlen nicht. */
export function checkPrBody(body) {
  const lines = String(body ?? '').split(/\r?\n/);
  const missing = [];
  const empty = [];
  let previous = -1;
  for (const section of PR_BODY_SECTIONS) {
    const at = lines.indexOf(section);
    if (at < 0) {
      missing.push(section);
      continue;
    }
    if (at < previous) empty.push(`${section} (falsche Reihenfolge)`);
    previous = at;
    const next = lines.findIndex((line, position) => position > at && line.startsWith('### '));
    const content = lines.slice(at + 1, next < 0 ? undefined : next).filter((line) => line.startsWith('- '));
    if (content.length === 0 || content.every((line) => line.length < 8)) {
      empty.push(`${section} (kein echter Inhalt)`);
    }
  }
  return { ok: missing.length === 0 && empty.length === 0, missing, empty };
}
