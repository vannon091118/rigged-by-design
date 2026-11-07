/**
 * Textbaustein-Pools: eine Regel, ein Ziel, keine zweite Content-Wahrheit.
 *
 * Die Pools sind die Slots des kontrollierten Vokabulars. Jeder Pool muss die
 * Mindestgroesse erreichen; das Gesamtziel 1500 ist Fortschritt, kein Freischein.
 * Neue Bausteine duerfen nur in Pools unter der Mindestgroesse wandern, damit
 * Content Luecken schliesst statt den groessten Pool weiter zu fuellen.
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
 * vor dem Commit unter der Mindestgroesse waren. `before` ist der Stand ohne
 * die neuen Beitraege, `added` sind deren Slots.
 */
export function gapIssues({ before, added, minimum = POOL_MINIMUM }) {
  const issues = [];
  if (added.length === 0) {
    issues.push('Kein neuer Textbaustein im Commit; jeder Commit braucht mindestens einen verdrahteten Baustein');
    return issues;
  }
  for (const entry of added) {
    const prior = before[entry.slot] ?? 0;
    if (prior >= minimum) {
      issues.push(`Beitrag ${entry.contributionId} fuellt ${entry.slot} (${prior}/${minimum}) statt einer Luecke`);
    }
  }
  return issues;
}
