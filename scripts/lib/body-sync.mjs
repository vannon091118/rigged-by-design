/**
 * Gemeinsame Wahrheit fuer Commit- und PR-Bodies.
 *
 * Zwei Regeln tragen alles andere:
 *
 * 1. Vorhandene Inhalte sind geschuetzt. Automatik lebt ausschliesslich
 *    zwischen `AUTO_START` und `AUTO_END`; alles ausserhalb bleibt unveraendert.
 *    Laesst sich die Markerlage nicht sicher bestimmen (doppelt oder
 *    unbalanciert), schreibt niemand: `mergeAutomation()` liefert `ok: false`.
 * 2. Der Diff ist die Wahrheit. Beschreibungen entstehen aus
 *    `git diff --name-status basis...head`, nicht aus Commit-Titeln. Fehlt der
 *    Diff, sagt der Text das - er erfindet keine Wirkung.
 *
 * `turn-push`, `lift-commit-body` und `promote` nutzen dieselbe Logik, damit es
 * keine zweite Wahrheit ueber Body, Marker und Sektionen gibt.
 */

export const AUTO_START = '<!-- rbd:auto-body:start -->';
export const AUTO_END = '<!-- rbd:auto-body:end -->';

/** Genau diese Ueberschriften prueft `verify-commit-msg` auf Zeilengleichheit. */
export const REQUIRED_SECTIONS = Object.freeze([
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
]);

const STATUS_LABELS = Object.freeze({
  A: 'neu',
  M: 'geändert',
  D: 'gelöscht',
  R: 'umbenannt',
  C: 'kopiert',
  T: 'Typ geändert',
});

const GROUP_LABELS = Object.freeze({
  runtime: 'Runtime',
  tests: 'Tests',
  content: 'Inhalt/Assets',
  docs: 'Doku',
  governance: 'Governance/CI',
  tooling: 'Werkzeuge',
  version: 'Version',
});

/** Reihenfolge der Gruppen ist die Reihenfolge im Text: Arbeit vor Doku. */
const GROUPS = Object.freeze(Object.keys(GROUP_LABELS));

const VERSION_PATH = /^(?:package\.json|pnpm-lock\.yaml)$/;
const TEST_PATH = /(?:^|\/)__tests__\/|\.test\.tsx?$|\.bench\.ts$/;
const RUNTIME_PATH = /^src\//;
const CONTENT_PATH = /^(?:content|public)\//;
const GOVERNANCE_PATH = /^(?:AGENTS\.md|\.github\/|\.githooks\/|\.lane-claims\/|\.mailmap$|CODEOWNERS$)/;
const DOCS_PATH = /^(?:README\.md|docs\/)/;
const TOOLING_PATH = /^scripts\//;

/**
 * `git diff --name-status` zerlegen. Umbenennungen tragen zwei Pfade; der
 * letzte ist der heutige, der erste bleibt als Herkunft erhalten.
 */
export function parseNameStatus(text) {
  const entries = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const parts = line.split('\t').map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const status = String(parts[0] ?? '')[0];
    if (!status || !(status in STATUS_LABELS)) continue;
    entries.push({ status, from: parts.length > 2 ? parts[1] : null, path: parts[parts.length - 1] });
  }
  return entries;
}

/** Pfade nach Zustaendigkeit; Tests gewinnen gegen Runtime, Doku bleibt getrennt. */
export function classifyPaths(entries) {
  const groups = Object.fromEntries(GROUPS.map((key) => [key, []]));
  groups.uncertain = [];
  for (const entry of entries) {
    const path = entry.path;
    if (VERSION_PATH.test(path)) groups.version.push(entry);
    else if (TEST_PATH.test(path)) groups.tests.push(entry);
    else if (RUNTIME_PATH.test(path)) groups.runtime.push(entry);
    else if (CONTENT_PATH.test(path)) groups.content.push(entry);
    else if (GOVERNANCE_PATH.test(path)) groups.governance.push(entry);
    else if (DOCS_PATH.test(path)) groups.docs.push(entry);
    else if (TOOLING_PATH.test(path)) groups.tooling.push(entry);
    else groups.uncertain.push(entry);
  }
  return groups;
}

/** Echte Codeaenderung: dafuer braucht es inhaltliche Notes statt einer Vorlage. */
export function hasCodeChanges(groups) {
  return ['runtime', 'tests', 'content', 'tooling'].some((key) => (groups[key] ?? []).length > 0);
}

/** Faktenzeilen je Gruppe. Keine Zeile behauptet eine Wirkung, die nicht im Diff steht. */
export function describeDiff(entries, options = {}) {
  const groups = options.groups ?? classifyPaths(entries);
  const lines = [];
  for (const key of GROUPS) {
    const list = groups[key] ?? [];
    if (list.length === 0) continue;
    const named = list
      .slice(0, 10)
      .map((entry) => `${entry.path} (${STATUS_LABELS[entry.status] ?? 'geändert'}${entry.from ? `, vorher ${entry.from}` : ''})`);
    const rest = list.length > 10 ? `, +${list.length - 10} weitere` : '';
    lines.push(`${GROUP_LABELS[key]}: ${named.join(', ')}${rest}`);
  }
  if ((groups.uncertain ?? []).length > 0) {
    lines.push(`Nicht zugeordnet: ${groups.uncertain.map((entry) => entry.path).join(', ')}`);
  }
  if (lines.length === 0) lines.push('Kein Dateipfad im Diff; daraus folgt keine Aussage.');
  return lines;
}

/** Kurzzeile fuer Kopf und Plan: Anzahl und Statusverteilung. */
export function diffSummary(entries) {
  const counts = new Map();
  for (const entry of entries) counts.set(entry.status, (counts.get(entry.status) ?? 0) + 1);
  const parts = [...counts.entries()].map(([status, count]) => `${STATUS_LABELS[status] ?? status} ${count}`);
  return `${entries.length} Datei(en)${parts.length > 0 ? `: ${parts.join(', ')}` : ''}`;
}

const indexesOf = (source, needle) => {
  const found = [];
  let at = source.indexOf(needle);
  while (at >= 0) {
    found.push(at);
    at = source.indexOf(needle, at + needle.length);
  }
  return found;
};

/**
 * Body in "ausserhalb" und "eigener Bereich" zerlegen. `absent` heisst: es gibt
 * noch keinen Automationsbereich. `invalid` heisst: die Lage ist nicht sicher
 * aufloesbar, also wird nicht geschrieben.
 */
export function splitAutomation(text) {
  const source = String(text ?? '');
  const starts = indexesOf(source, AUTO_START);
  const ends = indexesOf(source, AUTO_END);
  if (starts.length === 0 && ends.length === 0) {
    return { state: 'absent', outside: source, inner: '', reason: null };
  }
  if (starts.length !== 1 || ends.length !== 1) {
    return {
      state: 'invalid',
      outside: source,
      inner: '',
      reason: `Marker doppelt oder unbalanciert (start ${starts.length}, end ${ends.length})`,
    };
  }
  const [start] = starts;
  const [end] = ends;
  if (start > end) {
    return { state: 'invalid', outside: source, inner: '', reason: 'Endmarker steht vor dem Startmarker' };
  }
  return {
    state: 'present',
    outside: `${source.slice(0, start)}${source.slice(end + AUTO_END.length)}`,
    inner: source.slice(start + AUTO_START.length, end),
    reason: null,
  };
}

/**
 * Automationsbereich setzen oder ersetzen. Gibt den vollstaendigen neuen Body
 * zurueck; `changed: false` heisst, der Inhalt war schon identisch. Bei
 * unklarer Markerlage oder Markern im Nutztext wird nichts geliefert.
 */
export function mergeAutomation(existing, inner) {
  const source = String(existing ?? '');
  const payload = String(inner ?? '').replace(/\r\n/g, '\n').trim();
  if (!payload) return { ok: false, body: '', changed: false, reason: 'leerer Automationsbereich' };
  if (payload.includes(AUTO_START) || payload.includes(AUTO_END)) {
    return { ok: false, body: '', changed: false, reason: 'Automatiktext enthaelt eigene Marker' };
  }
  const parts = splitAutomation(source);
  if (parts.state === 'invalid') return { ok: false, body: '', changed: false, reason: parts.reason };
  if (parts.state === 'present') {
    const start = source.indexOf(AUTO_START);
    const end = source.indexOf(AUTO_END);
    const body = `${source.slice(0, start + AUTO_START.length)}\n${payload}\n${source.slice(end)}`;
    return { ok: true, body, changed: parts.inner.trim() !== payload, reason: null };
  }
  const block = `${AUTO_START}\n${payload}\n${AUTO_END}`;
  const base = source.replace(/\s+$/, '');
  return { ok: true, body: base ? `${base}\n\n${block}\n` : `${block}\n`, changed: true, reason: null };
}

/** Fehlende Pflichtsektionen im menschlichen Text; exakte Zeile, wie das Gate. */
export function missingSections(text) {
  const lines = String(text ?? '').split(/\r?\n/).map((line) => line.trim());
  return REQUIRED_SECTIONS.filter((section) => !lines.includes(section));
}

/** Notes gelten nur, wenn sie nicht leer sind und kein Platzhalter dasteht. */
const PLACEHOLDER = /^(?:[-*]\s*)?(?:todo|tbd|offen|x{3}|platzhalter|n\/a|\.\.\.)$/i;

export function evaluateNotes(text) {
  const content = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 8 && !line.startsWith('#') && !PLACEHOLDER.test(line.replace(/^[-*]\s*/, '')));
  return {
    ok: content.length > 0,
    reason: content.length > 0 ? null : 'Notes ohne inhaltliche Aussage (leer oder Platzhalter)',
    content,
  };
}

const cleanLine = (line) => line.replace(/^[-*]\s+/, '').trim();

/**
 * Inhalt des Automationsbereichs.
 *
 * `outside` ist der menschliche Text ausserhalb: fehlt dort eine Pflichtsektion,
 * ergaenzt die Automatik genau diese. Vorhandene Sektionen werden nie
 * wiederholt und nie ueberschrieben. Commit-Text erscheint nur als Zitat,
 * ausdruecklich als menschliche Aussage und nicht als Diff-Beweis.
 */
export function describeAutomation({ entries = [], outside = '', commitText = '', head = '', base = '' } = {}) {
  const groups = classifyPaths(entries);
  const facts = describeDiff(entries, { groups });
  const missing = new Set(missingSections(outside));
  const lines = [
    `**Automatischer Abgleich** — aus dem vollständigen Diff${base && head ? ` (${base.slice(0, 7)} → ${head.slice(0, 7)})` : ''}: ${diffSummary(entries)}.`,
    'Alles ausserhalb dieses Bereichs bleibt unveraendert; nur hier schreibt die Automatik.',
    '',
  ];
  const section = (title, bullets) => {
    lines.push(title, ...bullets.map((line) => `- ${line}`), '');
  };

  const changes = [...facts];
  if (!hasCodeChanges(groups)) {
    changes.unshift('Keine Runtime-, Test- oder Inhaltsaenderung im Diff: nur Doku, Governance oder Version.');
  }
  if (missing.has(REQUIRED_SECTIONS[0])) {
    section(REQUIRED_SECTIONS[0], changes);
  } else {
    lines.push('**Diff-Fakten:**', ...changes.map((line) => `- ${line}`), '');
  }

  if (missing.has(REQUIRED_SECTIONS[1])) {
    const claims = String(commitText ?? '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('### '))
      .slice(0, 8)
      .map(cleanLine);
    const technical = [
      hasCodeChanges(groups)
        ? 'Grundlage ist der vollstaendige Diff von der Basis bis zum Head; Commit-Titel sind kein Beweis.'
        : 'Der Diff traegt keine Runtime- oder Testaenderung; eine technische Wirkung ist damit nicht belegt.',
      claims.length > 0
        ? `Aus dem Commit-Body (menschlicher Text, nicht gegen den Diff geprueft): ${claims.join(' | ')}`
        : 'Keine Commit-Notes vorhanden: es werden bewusst keine technischen Aussagen ergaenzt.',
    ];
    section(REQUIRED_SECTIONS[1], technical);
  }

  if (missing.has(REQUIRED_SECTIONS[2])) {
    section(REQUIRED_SECTIONS[2], [
      'Offene Punkte stehen im PR-Text und in docs/ROADMAP.md; die Automatik erfindet keinen Ausblick.',
    ]);
  }

  return lines.join('\n').trim();
}
