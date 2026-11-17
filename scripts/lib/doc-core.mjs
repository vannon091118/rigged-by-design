/**
 * Der Doku-Kern: fuenf Pflichtdokus, ein Token-Budget, ein Cross-Check.
 *
 * Ein Dokument "verstehen" heisst: seinen `## Kern` lesen. Fuer vier Dokumente
 * ist sogar das ganze Dokument budgetiert; die Roadmap traegt unter dem Kern
 * ihre ausfuehrlichen Phasentabellen. Die Summe aller Kerne ist der vollstaendige
 * Ueberblick und bleibt weit unter 10.000 Token.
 *
 * Die Pruefung ist rein lesend und merge-stabil: der Kern darf weder Version
 * noch HEAD-SHA noch einen generierten Block enthalten. Damit erzeugt kein
 * Merge eine Doku-Aenderung, nur um die Pflichtdokus aktuell zu halten.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findCommand } from './command-surface.mjs';
import { GENERATED_FILES } from './generated-files.mjs';
import { ROOT } from './report.mjs';

/** Ein Token entspricht konservativ vier Zeichen; Deutsch liegt darunter. */
export const CHARS_PER_TOKEN = 4;
export const CORE_TOKEN_BUDGET = 500;
export const OVERVIEW_TOKEN_BUDGET = 10_000;

/** Die fuenf Pflichtdokus. `scope: document` budgetiert die ganze Datei. */
export const CORE_DOCS = Object.freeze([
  {
    path: 'AGENTS.md',
    title: 'Agentenvertrag',
    scope: 'document',
    sections: ['## Kern', '## Zehn unverhandelbare Regeln', '## Pitfalls', '## Referenzen'],
  },
  {
    path: 'docs/WORKFLOW.md',
    title: 'Workflow',
    scope: 'document',
    sections: ['## Kern', '## Ablauf', '## Abschluss', '## Referenzen'],
  },
  {
    path: 'docs/INDEX.md',
    title: 'Doku-Index',
    scope: 'document',
    sections: ['## Kern', '## Pflichtdokus', '## Referenzen', '## Ordner'],
  },
  {
    path: 'docs/ROADMAP.md',
    title: 'Roadmap',
    scope: 'kern',
    sections: ['## Kern', '## Major-Ziele', '## Minor-Ziele', '## Jetzt', '## Als Nächstes', '## Später'],
  },
  {
    path: 'docs/LAST-CHANGES.md',
    title: 'Last Changes',
    scope: 'document',
    sections: ['## Kern', '## Letzte Änderungen', '## Regeln'],
  },
]);

export const CORE_PATHS = Object.freeze(CORE_DOCS.map((doc) => doc.path));

/**
 * Die zwei Einstiege jenseits der Pflichtdokus: Tests und Governance.
 *
 * Der 10k-Vertrag ist ein Lesepfad, keine Ausgabegrenze. Wer diese sieben
 * Kerne gelesen hat, kann Auftrag, Testlinie und Claim-Vertrag sicher
 * einordnen; alles Weitere ist task-spezifische Tiefe auf Abruf.
 */
export const ENTRY_DOCS = Object.freeze([
  {
    path: 'docs/TESTING.md',
    title: 'Test-Kern',
    scope: 'kern',
    sections: ['## Kern'],
  },
  {
    path: 'docs/GOVERNANCE.md',
    title: 'Governance-Kern',
    scope: 'kern',
    sections: ['## Kern'],
  },
]);

export const READING_DOCS = Object.freeze([...CORE_DOCS, ...ENTRY_DOCS]);
export const READING_PATHS = Object.freeze(READING_DOCS.map((doc) => doc.path));

/** Der vollstaendige Pflicht-Lesepfad bleibt unter 10.000 Token. */
export const READING_TOKEN_BUDGET = OVERVIEW_TOKEN_BUDGET;

/** Deterministische Naeherung; die Zahl ist ein Budget, keine Messung am Tokenizer. */
export function estimateTokens(text) {
  return Math.ceil(String(text ?? '').replaceAll('\r\n', '\n').length / CHARS_PER_TOKEN);
}

/** Inhalt zwischen `## Kern` und der naechsten Ueberschrift. */
export function kernBlock(text) {
  const value = String(text ?? '').replaceAll('\r\n', '\n');
  const heading = /^## Kern\s*$/m.exec(value);
  if (!heading) return null;
  const rest = value.slice(heading.index + heading[0].length);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Der budgetierte Teil eines Dokuments: ganze Datei oder nur der Kern. */
export function budgetedText(doc, text) {
  return doc.scope === 'document' ? String(text ?? '') : kernBlock(text);
}

function readText(path, root) {
  try {
    return readFileSync(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

function trackedFiles(root) {
  try {
    return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' })
      .trim()
      .split('\n')
      .filter(Boolean);
  } catch {
    return [];
  }
}

function packageScripts(root) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
    return pkg?.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  } catch {
    return {};
  }
}

/** Volatiler Inhalt: Version, HEAD-SHA oder generierter Block im Kern. */
export function volatileFindings(text) {
  const findings = [];
  if (/\b0\.\d+\.\d+\b/.test(text)) findings.push('Versionsnummer');
  if (/\b[0-9a-f]{7,40}\b/.test(text)) findings.push('Commit-SHA');
  if (/<!--\s*(?:generated|inventory|test_catalog|rbd-doc:\s*v)/i.test(text)) findings.push('generierter Block');
  return findings;
}

/**
 * Jede im Kern genannte ausfuehrbare Quelle muss existieren. `rbd` ist die
 * primaere Oberflaeche: eine Route, die `command-surface.mjs` nicht kennt, ist
 * ein Befund; damit veraltet kein Dokument nach einer Umbenennung.
 */
export function commandFindings(text, { scripts = {}, fileExists = () => false } = {}) {
  const findings = [];
  for (const match of String(text).matchAll(/`pnpm run ([a-z][\w:-]+)/g)) {
    if (!Object.hasOwn(scripts, match[1])) findings.push(`pnpm run ${match[1]}`);
  }
  for (const match of String(text).matchAll(/`node (scripts\/[\w./-]+\.mjs)/g)) {
    if (!fileExists(match[1])) findings.push(`node ${match[1]}`);
  }
  for (const match of String(text).matchAll(/`(?:pnpm )?rbd ([a-z][\w-]*) ([a-z][\w-]*)`/g)) {
    if (!findCommand(match[1], match[2])) findings.push(`rbd ${match[1]} ${match[2]}`);
  }
  return findings;
}

/** Alle Abweichungen des Doku-Kerns; leer heisst gruen. */
export function docCoreProblems({ root = ROOT, coreDocs = CORE_DOCS } = {}) {
  const problems = [];
  const scripts = packageScripts(root);
  const fileExists = (path) => existsSync(join(root, path));
  let overview = 0;
  const texts = new Map();

  for (const doc of coreDocs) {
    const text = readText(doc.path, root);
    if (text === null) {
      problems.push(`${doc.path}: Pflichtdokument fehlt (${doc.title}).`);
      continue;
    }
    texts.set(doc.path, text);
    if (!text.includes('<!-- rbd-doc: managed -->')) problems.push(`${doc.path}: rbd-doc-Marker fehlt.`);
    for (const section of doc.sections) {
      if (!text.includes(section)) problems.push(`${doc.path}: Pflichtabschnitt "${section}" fehlt.`);
    }
    const kern = kernBlock(text);
    if (kern === null) {
      problems.push(`${doc.path}: "## Kern" fehlt.`);
      continue;
    }
    const budgeted = budgetedText(doc, text) ?? '';
    const tokens = estimateTokens(budgeted);
    overview += tokens;
    if (tokens > CORE_TOKEN_BUDGET) {
      problems.push(`${doc.path}: ${tokens} Token ueber Budget ${CORE_TOKEN_BUDGET} (${doc.scope}).`);
    }
    const volatile = volatileFindings(kern);
    if (volatile.length > 0) {
      problems.push(`${doc.path}: Kern nicht merge-stabil (${volatile.join(', ')}).`);
    }
    const commands = commandFindings(kern, { scripts, fileExists });
    if (commands.length > 0) {
      problems.push(`${doc.path}: Kern nennt unbekannte Quelle(n): ${commands.join(', ')}.`);
    }
  }

  // Die zwei Einstiege zaehlen zum vollstaendigen 10k-Lesepfad. Sie werden
  // nicht als Pflichtdoku gefuehrt, muessen aber denselben Kern-Vertrag
  // erfuellen: ein Dokument verstehen heisst seinen Kern lesen.
  for (const doc of READING_DOCS) {
    if (CORE_PATHS.includes(doc.path)) continue;
    const text = readText(doc.path, root);
    if (text === null) {
      problems.push(`${doc.path}: Einstieg fehlt (${doc.title}).`);
      continue;
    }
    if (!text.includes('<!-- rbd-doc: managed -->')) problems.push(`${doc.path}: rbd-doc-Marker fehlt.`);
    const kern = kernBlock(text);
    if (kern === null) {
      problems.push(`${doc.path}: "## Kern" fehlt.`);
      continue;
    }
    const tokens = estimateTokens(kern);
    overview += tokens;
    if (tokens > CORE_TOKEN_BUDGET) {
      problems.push(`${doc.path}: ${tokens} Token ueber Budget ${CORE_TOKEN_BUDGET} (kern).`);
    }
    const volatile = volatileFindings(kern);
    if (volatile.length > 0) problems.push(`${doc.path}: Kern nicht merge-stabil (${volatile.join(', ')}).`);
    const commands = commandFindings(kern, { scripts, fileExists });
    if (commands.length > 0) problems.push(`${doc.path}: Kern nennt unbekannte Quelle(n): ${commands.join(', ')}.`);
  }

  if (overview > READING_TOKEN_BUDGET) {
    problems.push(`Lesepfad: ${overview} Token ueber Gesamtbudget ${READING_TOKEN_BUDGET}.`);
  }
  const index = texts.get('docs/INDEX.md');
  if (index) {
    for (const doc of coreDocs) {
      const name = doc.path.split('/').pop();
      if (!index.includes(name)) problems.push(`docs/INDEX.md: Pflichtdoku ${doc.path} nicht verlinkt.`);
    }
  }
  problems.push(...referenceProblems({ root, index, tracked: trackedFiles(root) }));
  problems.push(...ownershipProblems({ root, index, tracked: trackedFiles(root) }));
  problems.push(...layerProblems({ index, tracked: trackedFiles(root) }));
  problems.push(...lastChangesProblems({ root, text: texts.get('docs/LAST-CHANGES.md') }));
  return problems;
}

/** Jede Referenzdoku ist von der Karte erreichbar; kein verwaistes Wissen. */
export function referenceProblems({ root = ROOT, index = null, tracked = trackedFiles(root) } = {}) {
  if (!index) return [];
  const problems = [];
  for (const path of tracked) {
    if (!path.startsWith('docs/') || !path.endsWith('.md')) continue;
    if (READING_PATHS.includes(path) || path === 'docs/INDEX.md') continue;
    // Der Vertragsindex fuehrt seine sieben Einzelvertraege selbst.
    if (path.startsWith('docs/contracts/') && path !== 'docs/contracts/README.md') continue;
    const name = path.split('/').pop();
    if (!index.includes(name)) problems.push(`docs/INDEX.md: Referenz ${path} nicht verlinkt.`);
  }
  return problems;
}

const CODEOWNER_ENTRY = /^\/([^/\s]+)\//gm;

/**
 * Die drei Schichten sind auch eine Ablageordnung, nicht nur Prosa.
 * `src/core/governance` ist die einzige Testbruecke: Tests und Vertrags-
 * flaeche, kein Spielcode. Sie steht deshalb unter Dev, obwohl der Pfad mit
 * `src/` beginnt.
 */
export const LAYERS = Object.freeze([
  {
    name: 'Spiel',
    paths: ['src/core', 'src/render', 'src/ui', 'src/store', 'src/Config', 'src/debug', 'src/styles', 'src/test', 'content', 'public'],
  },
  { name: 'Dev', paths: ['scripts', 'bin', 'packages', 'src/core/governance'] },
  {
    name: 'Governance',
    paths: ['AGENTS.md', 'docs', '.github', '.claude', '.githooks', '.cron', '.lane-claims', '.lanes', 'artifacts'],
  },
]);

/** Die Tiefen, fuer die CODEOWNERS einen eigenen Eintrag nennen muss. */
const DEEP_OWNED = Object.freeze([
  'src/core/governance',
  'src/core/sim',
  'src/render',
  'src/ui',
  'src/store',
  'src/Config',
  'src/debug',
  'src/styles',
  'src/test',
  'scripts/lib',
  'docs/contracts',
  'docs/evidence',
  '.github/ISSUE_TEMPLATE',
  '.claude/skills',
  '.lane-claims/claims',
  '.lane-claims/tasks',
]);

function sectionOf(text, heading) {
  const start = text.indexOf(heading);
  if (start < 0) return '';
  const rest = text.slice(start + heading.length);
  const next = /^##\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

/** Jede Schicht steht in der Karte und nennt ihre Pfade. */
export function layerProblems({ index = null, tracked = trackedFiles(ROOT) } = {}) {
  if (!index) return [];
  const section = sectionOf(index, '## Ordner');
  if (section === '') return ['docs/INDEX.md: Abschnitt "## Ordner" fehlt.'];
  const problems = [];
  for (const layer of LAYERS) {
    const line = section.split('\n').find((entry) => entry.includes(`**${layer.name}:**`));
    if (!line) {
      problems.push(`docs/INDEX.md: Schicht "${layer.name}" fehlt in "## Ordner".`);
      continue;
    }
    for (const path of layer.paths) {
      if (!line.includes(path)) problems.push(`docs/INDEX.md: ${path} fehlt in Schicht "${layer.name}".`);
    }
  }
  const all = new Set(LAYERS.flatMap((layer) => layer.paths));
  const roots = [...new Set(tracked.filter((path) => path.includes('/')).map((path) => path.split('/')[0]))];
  for (const dir of roots) {
    const covered = all.has(dir) || [...all].some((path) => path.startsWith(`${dir}/`));
    if (!covered && !section.includes(`\`${dir}/`)) {
      problems.push(`docs/INDEX.md: Wurzelordner ${dir}/ fehlt in "## Ordner".`);
    }
  }
  if (!section.includes('ohne `governance`')) {
    problems.push('docs/INDEX.md: Spiel-Schicht muss "src/core" ohne governance nennen.');
  }
  return problems;
}

/** Jeder getrackte Wurzelordner hat einen Eigentuemer und steht in der Karte. */
export function ownershipProblems({ root = ROOT, index = null, tracked = trackedFiles(root) } = {}) {
  const problems = [];
  const dirs = [...new Set(tracked.filter((path) => path.includes('/')).map((path) => path.split('/')[0]))].sort();
  let codeowners;
  try {
    codeowners = readFileSync(join(root, '.github', 'CODEOWNERS'), 'utf8');
  } catch {
    return ['.github/CODEOWNERS fehlt.'];
  }
  const owned = new Set([...codeowners.matchAll(CODEOWNER_ENTRY)].map((match) => match[1]));
  for (const dir of dirs) {
    if (!owned.has(dir)) problems.push(`.github/CODEOWNERS: Ordner /${dir}/ ohne Owner.`);
    if (index && !index.includes(`${dir}/`)) problems.push(`docs/INDEX.md: Ordner ${dir}/ fehlt in "## Ordner".`);
  }
  for (const dir of DEEP_OWNED) {
    const exists = tracked.some((path) => path === dir || path.startsWith(`${dir}/`)) || existsSync(join(root, dir));
    if (!exists) continue;
    const escaped = dir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (!new RegExp(`^/${escaped}/`, 'm').test(codeowners)) {
      problems.push(`.github/CODEOWNERS: Tiefenordner /${dir}/ ohne eigenen Owner.`);
    }
  }
  return problems;
}

const CHANGELOG_DATE = /\b(\d{4}-\d{2}-\d{2})\b/g;

/** Last Changes: 3-7 datierte Zeilen, neueste oben, nie aelter als das Changelog. */
export function lastChangesProblems({ root = ROOT, text = null } = {}) {
  const value = text ?? readText('docs/LAST-CHANGES.md', root);
  if (value === null) return ['docs/LAST-CHANGES.md fehlt.'];
  const start = value.indexOf('## Letzte Änderungen');
  if (start < 0) return [];
  const rest = value.slice(start + '## Letzte Änderungen'.length);
  const next = /^##\s+/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;
  const dates = [];
  for (const line of section.split('\n')) {
    if (!line.startsWith('|') || /^\|\s*-/.test(line)) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    const date = /^(\d{4}-\d{2}-\d{2})$/.exec(cells[0] ?? '');
    if (!date) continue;
    if (cells.length < 3 || cells[1] === '' || cells[2] === '') {
      return [`docs/LAST-CHANGES.md: Zeile ${date[1]} braucht Aenderung und Beleg.`];
    }
    dates.push(date[1]);
  }
  if (dates.length < 3 || dates.length > 7) {
    return [`docs/LAST-CHANGES.md: ${dates.length} Eintraege, erlaubt sind 3-7.`];
  }
  for (let index = 1; index < dates.length; index += 1) {
    if (dates[index] > dates[index - 1]) return ['docs/LAST-CHANGES.md: Eintraege nicht absteigend datiert.'];
  }
  const changelog = readText('docs/CHANGELOG.md', root) ?? '';
  const newest = [...changelog.matchAll(CHANGELOG_DATE)].map((match) => match[1]).sort().at(-1);
  if (newest && dates[0] < newest) {
    return [`docs/LAST-CHANGES.md: neuester Eintrag ${dates[0]} aelter als Changelog ${newest}.`];
  }
  return [];
}

/** Vollstaendige Messung fuer `scripts/doc-audit.mjs` und die Evidenz. */
export function auditDocs({ root = ROOT, coreDocs = CORE_DOCS } = {}) {
  const tracked = trackedFiles(root);
  const markdown = tracked.filter((path) => path.endsWith('.md'));
  const core = coreDocs.map((doc) => {
    const text = readText(doc.path, root) ?? '';
    const kern = kernBlock(text) ?? '';
    const budgeted = budgetedText(doc, text) ?? '';
    return {
      path: doc.path,
      title: doc.title,
      scope: doc.scope,
      bytes: Buffer.byteLength(text),
      tokens: estimateTokens(budgeted),
      kernTokens: estimateTokens(kern),
      budget: CORE_TOKEN_BUDGET,
      ok: estimateTokens(budgeted) <= CORE_TOKEN_BUDGET,
    };
  });
  const reading = READING_DOCS.map((doc) => {
    const text = readText(doc.path, root) ?? '';
    const budgeted = budgetedText(doc, text) ?? '';
    return {
      path: doc.path,
      title: doc.title,
      scope: doc.scope,
      bytes: Buffer.byteLength(text),
      tokens: estimateTokens(budgeted),
      budget: CORE_TOKEN_BUDGET,
      ok: estimateTokens(budgeted) <= CORE_TOKEN_BUDGET,
    };
  });
  const reference = markdown
    .filter((path) => !READING_PATHS.includes(path))
    .map((path) => {
      const text = readText(path, root) ?? '';
      return {
        path,
        bytes: Buffer.byteLength(text),
        tokens: estimateTokens(text),
        generated: Object.hasOwn(GENERATED_FILES, path),
      };
    })
    .sort((left, right) => right.tokens - left.tokens);
  const problems = docCoreProblems({ root, coreDocs });
  return {
    core,
    reading,
    reference,
    overviewTokens: reading.reduce((sum, doc) => sum + doc.tokens, 0),
    overviewBudget: READING_TOKEN_BUDGET,
    coreBudget: CORE_TOKEN_BUDGET,
    totals: {
      markdownFiles: markdown.length,
      markdownTokens: reference.reduce((sum, doc) => sum + doc.tokens, 0),
    },
    problems,
  };
}
