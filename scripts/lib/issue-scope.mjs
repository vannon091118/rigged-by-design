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
