/**
 * Issue-Scope: ein Label, ein Body-Vertrag, eine Entscheidung.
 *
 * Ein rotes Gate blockiert nur, was es wirklich betrifft: `main` global, eine
 * Lane nur sich selbst, eine Dependency nur ihre Dependents. Ein Issue ohne
 * Scope ist eine Warnung, `remote-ci` blockiert nie. Dieselbe Auslegung lesen
 * `pretask` (Startblocker) und `auto-resolve` (Eskalation); hier steht sie
 * einmal.
 */

export const SCOPE_MAIN = 'scope:main';
export const LEGACY_SCOPE_GLOBAL = 'scope:global';
export const LANE_PREFIX = 'scope:lane/';
export const LANE_COLON_PREFIX = 'scope:lane:';
export const LEGACY_LANE_PREFIX = 'lane:';
export const DEPENDENCY_PREFIX = 'scope:dependency:';

export const FINGERPRINT_MARKER = /<!--\s*(fp:[^>]+?)\s*-->/i;
export const REPAIR_MARKER = /<!--\s*repair:\s*([0-9a-f]{40})\s*-->/i;
export const AUTOFIX_MARKER = /<!--\s*autofix:\s*([0-9a-f]{40})\s*-->/i;

/** Labels als reine Namen; GitHub liefert je nach Endpoint Objekte oder Strings. */
export function labelNames(issue) {
  const labels = Array.isArray(issue) ? issue : (issue?.labels ?? []);
  return labels
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

/**
 * Das Scope-Label eines Branches. `lane/governance/ci` wird zu
 * `scope:lane/governance/ci`; der Branch laesst sich daraus eindeutig
 * rekonstruieren, ohne eine zweite Schreibweise zu erfinden.
 */
export function scopeLabel(branch) {
  const value = String(branch ?? '').trim();
  if (!value) return null;
  if (value === 'main') return SCOPE_MAIN;
  return `${LANE_PREFIX}${value.replace(/^lane\//, '')}`;
}

/** Liest das Scope aus den Labels; unbekannte Issues haben `kind: none`. */
export function scopeOf(issue) {
  const names = labelNames(issue);
  if (names.includes(SCOPE_MAIN) || names.includes(LEGACY_SCOPE_GLOBAL)) {
    return { kind: 'main', lane: null };
  }
  const dependency = names.find((name) => name.startsWith(DEPENDENCY_PREFIX) || name.startsWith('dependency:'));
  if (dependency) {
    return { kind: 'dependency', lane: dependency.replace(/^scope:dependency:|^dependency:/, '') };
  }
  const lane = names.find((name) => name.startsWith(LANE_PREFIX));
  if (lane) {
    const rest = lane.slice(LANE_PREFIX.length);
    return { kind: 'lane', lane: rest.startsWith('lane/') ? rest : `lane/${rest}` };
  }
  // Historische Schreibweise mit Doppelpunkt bleibt lesbar.
  const colon = names.find((name) => name.startsWith(LANE_COLON_PREFIX));
  if (colon) return { kind: 'lane', lane: colon.slice(LANE_COLON_PREFIX.length) };
  const legacy = names.find((name) => name.startsWith(LEGACY_LANE_PREFIX));
  if (legacy) return { kind: 'lane', lane: legacy.slice(LEGACY_LANE_PREFIX.length) };
  return { kind: 'none', lane: null };
}

/** Lane-Gleichheit in beide Richtungen: `lane/a` deckt `lane/a/b`, nicht `lane/ab`. */
export function laneMatches(scopeLane, target) {
  const left = String(scopeLane ?? '').replace(/\/+$/, '');
  const right = String(target ?? '').replace(/\/+$/, '');
  if (!left || !right) return false;
  return left === right || right.startsWith(`${left}/`) || left.startsWith(`${right}/`);
}

/** Liest die Pflichtfelder aus einem Issue-Body; fehlende Felder sind `null`. */
export function parseIssueBody(body) {
  const text = String(body ?? '');
  const field = (name) => {
    const match = new RegExp('\\*\\*' + name + ':\\*\\*\\s*`?([^`\\n]+)`?').exec(text);
    return match?.[1]?.trim() ?? null;
  };
  return {
    branch: field('Branch'),
    headSha: field('Head-SHA'),
    gate: field('Gate'),
    code: field('Code'),
    fingerprint: FINGERPRINT_MARKER.exec(text)?.[1] ?? null,
    repair: REPAIR_MARKER.exec(text)?.[1] ?? null,
    autofix: AUTOFIX_MARKER.exec(text)?.[1] ?? null,
  };
}

/**
 * Die eine Scope-Entscheidung fuer `pretask`.
 *
 * `remote-ci` und ein bereits im HEAD liegender Repair sind Warnungen, ein
 * fehlender Scope ebenfalls. `scope:main` blockiert global; die eigene Lane und
 * eine deklarierte Dependency blockieren nur diese Lane.
 */
export function classifyIssue(issue, options = {}) {
  const labels = labelNames(issue);
  const scope = scopeOf(issue);
  const repairSha = REPAIR_MARKER.exec(String(issue?.body ?? ''))?.[1] ?? null;
  const base = { scope, repairSha };
  if (labels.includes('remote-ci')) {
    return { ...base, disposition: 'warning', reason: 'remote-ci' };
  }
  if (repairSha && options.isAncestor?.(repairSha)) {
    return { ...base, disposition: 'warning', reason: 'repair-already-in-head' };
  }
  if (scope.kind === 'none') {
    return { ...base, disposition: 'warning', reason: 'no-scope' };
  }
  if (scope.kind === 'main') {
    return { ...base, disposition: 'blocker', reason: 'scope-main' };
  }
  if (scope.kind === 'lane' && options.branch && laneMatches(scope.lane, options.branch)) {
    return { ...base, disposition: 'blocker', reason: 'scope-lane' };
  }
  if (
    scope.kind === 'dependency'
    && (options.dependencies ?? []).some((dependency) => laneMatches(scope.lane, dependency))
  ) {
    return { ...base, disposition: 'blocker', reason: 'scope-dependency' };
  }
  return { ...base, disposition: 'warning', reason: 'other-scope' };
}

const FOLLOW_UP_APPROACH = Object.freeze({
  'ERR-4017': 'Doku-Marker und Inventur automatisch nachziehen; danach das Doku-Gate erneut ausfuehren.',
  'ERR-0911': 'Den automatischen Abgleich wiederholen und nur die gemeldete Abweichung nachziehen.',
  'ERR-4003': 'Import-, Re-Export- und Namespace-Ketten vollstaendig verfolgen; betroffene Aufrufer reparieren statt den Export nur zu entfernen.',
  'ERR-4020': 'Beide Quellen vergleichen, das bessere Verhalten zusammenfuehren und eine gemeinsame Wahrheit behalten.',
  'ERR-4012': 'Hot-Zone-Datei modularisieren oder eine LOC-Erhoehung als ASK_USER mit Begruendung beantragen.',
  'ERR-4026': 'Den roten Testpfad reproduzieren, die Ursache beheben und den betroffenen Lauf wiederholen.',
  'ERR-4008': 'Den Basisabgleich wiederholen und die Lane ohne Force-Push auf den aktuellen Stand bringen.',
  'ERR-4019': 'Den Claim- oder Scope-Konflikt aufloesen, bevor neue Arbeit beginnt.',
  'ERR-4006': 'Die Commit- oder Body-Pflichtangaben ergaenzen und den Abschluss erneut ausfuehren.',
});

const FOLLOW_UP_DIFFICULTY = Object.freeze({
  'ERR-4017': 'niedrig',
  'ERR-0911': 'niedrig',
  'ERR-4006': 'niedrig',
  'ERR-4003': 'mittel',
  'ERR-4020': 'mittel',
  'ERR-4026': 'mittel',
  'ERR-4008': 'mittel',
  'ERR-4019': 'mittel',
  'ERR-4012': 'hoch',
  'ERR-4030': 'hoch',
  'ERR-1001': 'hoch',
  'ERR-1002': 'hoch',
  'ERR-1003': 'hoch',
  'ERR-5001': 'hoch',
});

/**
 * Macht aus offenen Scope-Blockern eine kurze, nachvollziehbare Folgetask-Liste.
 * Die Ausgabe ist absichtlich ohne Gate-Jargon: Problem, Kurzbeschreibung,
 * Loesungsansatz und Schwierigkeitsgrad. Technische Codes bleiben nur als
 * Zuordnung im Datensatz erhalten.
 */
export function buildFollowUp(issues = []) {
  const problems = (Array.isArray(issues) ? issues : [])
    .filter((issue) => issue?.disposition === 'blocker')
    .sort((a, b) => Number(a.number ?? 0) - Number(b.number ?? 0))
    .map((issue, index) => {
      const rawTitle = String(issue.title ?? 'Gate-Befund');
      const code = /(ERR-\d{4})/.exec(String(issue.body ?? ''))?.[1]
        ?? /(ERR-\d{4})/.exec(rawTitle)?.[1]
        ?? 'ERR-0000';
      const summary = rawTitle
        .replace(/^\[ERR-\d{4}\]\s*/, '')
        .replace(/^CI Gate rot:\s*/i, '')
        .trim() || 'Gate-Befund';
      return {
        position: index + 1,
        issue: issue.number ?? null,
        number: issue.number ? `#${issue.number}` : null,
        title: `Problem ${index + 1}. ${summary}`,
        summary,
        approach: FOLLOW_UP_APPROACH[code] ?? 'Befund reproduzieren, Ursache beheben und den betroffenen Gate-Lauf wiederholen.',
        difficulty: FOLLOW_UP_DIFFICULTY[code] ?? 'mittel',
        code,
        url: issue.url ?? null,
      };
    });
  const required = problems.length > 0;
  return {
    required,
    headline: required
      ? 'Deine Anfrage muss als Folgetask beginnen, weil der Projekt-Scope zuerst diese Probleme verlangt.'
      : null,
    problems,
  };
}

/** Fingerprint = Fehlercode + erste Fehlerzeile. */
export function fingerprintOf(code, line) {
  return `fp:${code}:${String(line ?? '').trim().slice(0, 160)}`;
}

/**
 * Der Body eines Gate-Issues. Branch, Head-SHA, Gate, Code, Fingerprint und
 * Repair-Marker sind Pflicht: ohne sie kann weder der Sweep schliessen noch ein
 * Agent den Befund eindeutig zuordnen.
 */
export function issueBody({
  branch,
  headSha,
  gate,
  code,
  fingerprint,
  state = null,
  runUrl = '',
  report = '',
  repair = null,
  autofix = null,
}) {
  const lines = [
    '## CI Gate rot',
    '',
    `**Branch:** \`${branch || '-'}\`  `,
    `**Head-SHA:** \`${headSha || '-'}\`  `,
    `**Gate:** \`${gate || 'unbekannt'}\`  `,
    `**Code:** \`${code || 'ERR-0000'}\`  `,
    `**Fingerprint:** \`${fingerprint}\`  `,
    `**Repair-Marker:** ${repair ? `\`${repair}\`` : 'keiner'}  `,
    ...(state ? [`**Zustand:** \`${state}\`  `] : []),
    ...(runUrl ? [`**CI Run:** <${runUrl}>`] : []),
    '',
    '## Befund',
    '',
    '```',
    report || 'Kein Befund im Gate-Log gefunden.',
    '```',
    '',
    '## Regeln',
    '',
    '- Ein `scope:main`-Issue blockiert global; ein Lane-Issue nur die eigene Lane und ihre Dependents.',
    '- `remote-ci` blockiert nie: Lauf wiederholen, kein Gate-Issue.',
    '- Reparatur nur fuer mechanische Doku-/Generat-Pfade; Produktcode bleibt beim Agenten.',
    '',
    `<!-- ${fingerprint} -->`,
  ];
  if (repair) lines.push(repair);
  if (autofix) lines.push(autofix);
  return `${lines.join('\n')}\n`;
}
