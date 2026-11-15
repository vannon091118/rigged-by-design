/**
 * Anker-Gate fuer interne Markdown-Links (#860).
 *
 * GitHub erzeugt den Anker einer Ueberschrift aus ihrem Text: Code-Spans und
 * HTML fallen weg, Satzzeichen ebenso, Leerzeichen werden zu `-`, doppelte
 * Ueberschriften bekommen `-1`, `-2`. Ein Link auf `#mission-profil-maintainer`
 * zeigt deshalb ins Leere, wenn die Ueberschrift `Mission-Profil `maintainer`
 * (global)` heisst — genau dieser Fehler blieb bis zum Review unentdeckt.
 *
 * Hier stehen nur reine Funktionen: kein Dateisystem, kein Netz. Der Loader
 * liegt in `scripts/verify-docs.mjs`, damit die Regeln testbar bleiben.
 */

/** Eine Zeile, die einen Code-Fence oeffnet oder schliesst. */
const FENCE = /^\s*(?:```|~~~)/;

/** Ueberschrift mit optionaler Abschluss-Raute. */
const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;

/** Markdown-Link `[text](ziel "titel")`; Ziel ohne Leerzeichen. */
const LINK = /\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/** Anker einer Ueberschrift, in der Form, die GitHub im `href` erzeugt. */
export function slugifyHeading(text) {
  return String(text ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/`/g, '')
    .toLowerCase()
    .trim()
    // GitHub entfernt Satzzeichen, ohne die Luecke zu schliessen: aus
    // `Board-Status & Review-Status` wird `board-status--review-status`.
    .replace(/[^\p{L}\p{N} _-]/gu, '')
    .replace(/ /g, '-');
}

/** Alle Anker eines Dokuments; Duplikate werden wie bei GitHub durchnummeriert. */
export function collectAnchors(markdown) {
  const anchors = new Set();
  const seen = new Map();
  let fenced = false;
  for (const line of String(markdown ?? '').split('\n')) {
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    const match = HEADING.exec(line);
    if (!match) continue;
    const base = slugifyHeading(match[2]);
    if (!base) continue;
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

/** Interne Links eines Dokuments mit Zeilennummer; Code-Fences bleiben aussen vor. */
export function extractInternalLinks(markdown) {
  const links = [];
  let fenced = false;
  const lines = String(markdown ?? '').split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (FENCE.test(line)) {
      fenced = !fenced;
      continue;
    }
    if (fenced) continue;
    LINK.lastIndex = 0;
    let match = LINK.exec(line);
    while (match) {
      links.push({ target: match[1], line: index + 1 });
      match = LINK.exec(line);
    }
  }
  return links;
}

/** Externer Link, reiner Bildpfad oder Nicht-Markdown-Ziel: nicht unser Fall. */
export function parseLinkTarget(target) {
  const value = String(target ?? '').trim();
  if (!value) return null;
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value)) return null;
  if (value.startsWith('#')) return { path: '', anchor: value.slice(1) || null };
  const hash = value.indexOf('#');
  const path = hash >= 0 ? value.slice(0, hash) : value;
  const anchor = hash >= 0 ? value.slice(hash + 1) : '';
  if (!/\.md$/i.test(path)) return null;
  return { path, anchor: anchor || null };
}

/** Pfad relativ zur Wurzel, POSIX-getrennt, ohne `./` und ohne Doppel-Slashes. */
function normalizePath(path) {
  const parts = [];
  for (const part of String(path).replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** Verzeichnis eines Dokumentpfads, POSIX. */
function dirOf(path) {
  const index = String(path).lastIndexOf('/');
  return index < 0 ? '' : String(path).slice(0, index);
}

/**
 * Prueft alle internen Links einer Dokumentliste.
 *
 * @param {readonly {path: string, text: string}[]} documents Pfade relativ zur Wurzel.
 * @returns {string[]} Befunde in der Form `pfad:zeile ...`.
 */
export function checkDocAnchors(documents = []) {
  const loaded = new Map();
  for (const document of documents) loaded.set(normalizePath(document.path), document);
  const anchorCache = new Map();
  const anchorsOf = (path) => {
    if (!anchorCache.has(path)) anchorCache.set(path, collectAnchors(loaded.get(path)?.text ?? ''));
    return anchorCache.get(path);
  };
  const problems = [];
  for (const document of documents) {
    const path = normalizePath(document.path);
    for (const link of extractInternalLinks(document.text)) {
      const parsed = parseLinkTarget(link.target);
      if (!parsed) continue;
      const target = parsed.path
        ? normalizePath(`${dirOf(path)}/${parsed.path}`)
        : path;
      if (!loaded.has(target)) {
        problems.push(`${path}:${link.line} Linkziel fehlt: ${link.target}`);
        continue;
      }
      if (!parsed.anchor) continue;
      const anchor = decodeURIComponent(parsed.anchor).toLowerCase();
      if (!anchorsOf(target).has(anchor)) {
        problems.push(`${path}:${link.line} Anker fehlt in ${target}: #${parsed.anchor}`);
      }
    }
  }
  return problems;
}
