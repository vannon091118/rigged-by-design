/**
 * Arbeitsbaum-Aenderungen als explizite Liste.
 *
 * Der Fix-Modus ist der einzige Pfad, der Dateien schreibt. Er muss deshalb
 * jede Aenderung nennen, die er hinterlaesst -- auch Loeschungen. Stilles
 * Aufraeumen waere sonst von einem gruenen Lauf nicht zu unterscheiden.
 */

/** Parst `git status --porcelain` (Zeilen- oder NUL-getrennt) in Pfad -> Statuscode. */
export function parsePorcelain(text) {
  const state = new Map();
  if (!text) return state;
  const rows = text.includes('\0') ? text.split('\0') : text.split(/\r?\n/);
  for (const raw of rows) {
    if (!raw.trim()) continue;
    const code = raw.slice(0, 2);
    const rest = raw.slice(3).trim();
    // Umbenennungen tragen das Ziel hinter dem Pfeil; nur der neue Pfad zaehlt.
    const path = rest.includes(' -> ') ? rest.slice(rest.indexOf(' -> ') + 4).trim() : rest;
    if (!path) continue;
    state.set(path, code.trim() === '' ? '??' : code.replace(/\s+/g, ''));
  }
  return state;
}

/** Vorher/Nachher vergleichen: Neuanlage, Aenderung und Loeschung getrennt. */
export function diffTree(before, after) {
  const prev = typeof before === 'string' ? parsePorcelain(before) : (before ?? new Map());
  const next = typeof after === 'string' ? parsePorcelain(after) : (after ?? new Map());
  const added = [];
  const modified = [];
  const deleted = [];
  for (const [path, code] of next) {
    const old = prev.get(path);
    // Eine Loeschung zaehlt nur, wenn sie in diesem Lauf entstanden ist; ein
    // vorher schon geloeschter Pfad wird niemandem neu zugeschrieben.
    if (code.includes('D')) {
      if (old !== code) deleted.push(path);
      continue;
    }
    if (old === undefined || old.includes('D')) added.push(path);
    else if (old !== code) modified.push(path);
  }
  return { added: added.sort(), modified: modified.sort(), deleted: deleted.sort() };
}

/** Eine Zeile pro Aenderung; ein leerer Rueckgabewert heisst: nichts geschrieben. */
export function describeChanges(changes) {
  const lines = [];
  for (const path of changes.added) lines.push(`+ neu: ${path}`);
  for (const path of changes.modified) lines.push(`~ geaendert: ${path}`);
  for (const path of changes.deleted) lines.push(`- geloescht: ${path}`);
  return lines;
}
