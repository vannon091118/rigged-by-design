/**
 * Textbaustein-Pools: eine Regel, ein Ziel, keine zweite Content-Wahrheit.
 *
 * Die Pools sind die Slots des kontrollierten Vokabulars. Jeder Pool muss die
 * Mindestgroesse erreichen; das Gesamtziel 1500 ist Fortschritt, kein Freischein.
 * Solange ein Pool unter der Mindestgroesse liegt, fuellen neue Bausteine nur
 * dort - so schliesst Content Luecken, statt den groessten Pool weiter zu
 * fuellen. Sind alle Pools mindestens voll, darf jeder Pool wachsen; sonst
 * blockierte die erreichte Mindestgroesse jeden weiteren Commit und das Ziel
 * 1500 waere unerreichbar.
 */

/** Mindestgroesse je Pool (Slot). */
export const POOL_MINIMUM = 50;
/** Gesamtziel der Textbausteine. */
export const POOL_TARGET = 1500;
/** Ein Text gilt erst als gelesen, wenn er nicht nur Leerzeichen variiert. */
export const normalizeText = (text) => String(text ?? '')
  .toLocaleLowerCase('de')
  .replace(/[^a-z0-9äöüß]+/g, ' ')
  .trim();

/**
 * Pflegepfade: Doku, Inventur, Claims, Kontrollebene und Werkzeuge.
 *
 * Ein Commit, der ausschliesslich diese Pfade anfasst, aendert weder Spielcode
 * noch Content und braucht deshalb keinen neuen Textbaustein. Die Liste ist
 * bewusst eng und wird als Praefix geprueft: `content/`, `src/`, `public/`,
 * `index.html` und `package.json` sind nie Pflege. Es gilt alles-oder-nichts,
 * ein einziger Pfad ausserhalb der Liste hebt die Ausnahme auf.
 */
export const MAINTENANCE_PATHS = Object.freeze([
  'docs/',
  'AGENTS.md',
  'README.md',
  '.lane-claims/',
  '.github/',
  '.githooks/',
  'scripts/',
]);

/** True, wenn die Pfadliste nicht leer ist und jede Datei Pflege ist. */
export function isMaintenanceOnly(paths) {
  const files = [...new Set(paths ?? [])].filter(Boolean);
  if (files.length === 0) return false;
  return files.every((file) => MAINTENANCE_PATHS.some((entry) =>
    (entry.endsWith('/') ? file.startsWith(entry) : file === entry)));
}

/** Slots des Vokabulars, die einen Pool bilden. */
export function poolSlots(vocabulary) {
  return Object.keys(vocabulary?.slots ?? {}).sort();
}

/** Zaehlt Fragmente je Slot und sammelt normalisierte Texte. */
export function poolReport(fragments) {
  const counts = Object.fromEntries(poolSlotsFrom(fragments).map((slot) => [slot, 0]));
  const texts = new Map();
  const duplicates = [];
  for (const fragment of fragments) {
    counts[fragment.slot] = (counts[fragment.slot] ?? 0) + 1;
    const key = normalizeText(fragment.text);
    if (!key) continue;
    if (texts.has(key)) duplicates.push({ first: texts.get(key), second: fragment.contributionId });
    else texts.set(key, fragment.contributionId);
  }
  return { counts, total: fragments.length, duplicates };
}

function poolSlotsFrom(fragments) {
  return [...new Set(fragments.map((fragment) => fragment.slot))].sort();
}

/**
 * Prueft Mindestgroesse, Gesamtziel-Fortschritt und doppelte Texte.
 * `counts` kommt aus `poolReport`, `slots` aus dem Vokabular.
 */
export function poolIssues({ counts, slots, total, duplicates }, minimum = POOL_MINIMUM) {
  const issues = [];
  for (const slot of slots) {
    const count = counts[slot] ?? 0;
    if (count < minimum) issues.push(`Pool ${slot}: ${count}/${minimum} Bausteine`);
  }
  for (const duplicate of duplicates.slice(0, 8)) {
    issues.push(`Text doppelt: ${duplicate.first} und ${duplicate.second}`);
  }
  if (total > POOL_TARGET) issues.push(`Gesamtziel ${POOL_TARGET} ueberschritten: ${total}`);
  return issues;
}

/**
 * Luecken-Regel fuer einen Commit: neue Beitraege muessen in Pools liegen, die
 * vor dem Commit unter der Mindestgroesse waren, solange es solche Pools gibt.
 * `before` ist der Stand ohne die neuen Beitraege, `added` sind deren Slots.
 */
export function gapIssues({ before, added, minimum = POOL_MINIMUM }) {
  const issues = [];
  if (added.length === 0) {
    issues.push('Kein neuer Textbaustein im Commit; jeder Commit braucht mindestens einen verdrahteten Baustein');
    return issues;
  }
  const gaps = Object.entries(before).filter(([, count]) => count < minimum).map(([slot]) => slot);
  for (const entry of added) {
    if (gaps.length > 0 && !gaps.includes(entry.slot)) {
      issues.push(`Beitrag ${entry.contributionId} geht in ${entry.slot}; offen sind ${gaps.join(', ')}`);
    }
  }
  return issues;
}

/**
 * Schrumpf-Schutz: kein Commit darf Bausteine entfernen oder einen Pool
 * verkleinern. `deleted` sind geloeschte Beitragspfade, `before`/`after` die
 * Zaehlungen je Slot vor und nach dem Commit.
 */
export function shrinkIssues({ deleted = [], before, after }) {
  const issues = [];
  for (const path of deleted) issues.push(`Beitrag geloescht: ${path}; der Pool darf nicht schrumpfen`);
  for (const slot of Object.keys(before ?? {})) {
    const now = after?.[slot] ?? 0;
    if (now < (before[slot] ?? 0)) issues.push(`Pool ${slot}: ${now} nach ${before[slot]} - Pools duerfen nicht schrumpfen`);
  }
  return issues;
}
