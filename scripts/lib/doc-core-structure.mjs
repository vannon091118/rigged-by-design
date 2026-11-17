/**
 * Strukturpruefungen der Doku: Referenzen, drei Schichten, Owner-Hierarchie.
 * Liest nur; jede Abweichung ist ein Befund, kein Auto-Fix.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';
import { READING_PATHS, trackedFiles } from './doc-core-schema.mjs';

/** Jede Referenzdoku ist von der Karte erreichbar; kein verwaistes Wissen. */
export function referenceProblems({ index = null, tracked = trackedFiles(ROOT) } = {}) {
  if (!index) return [];
  const problems = [];
  for (const path of tracked) {
    if (!path.startsWith('docs/') || !path.endsWith('.md')) continue;
    if (READING_PATHS.includes(path) || path === 'docs/INDEX.md') continue;
    if (path.startsWith('docs/contracts/') && path !== 'docs/contracts/README.md') continue;
    const name = path.split('/').pop();
    if (!index.includes(name)) problems.push(`docs/INDEX.md: Referenz ${path} nicht verlinkt.`);
  }
  return problems;
}

/**
 * Die drei Schichten sind auch eine Ablageordnung, nicht nur Prosa.
 * `src/core/governance` ist die einzige Testbruecke: Tests und Vertrags-
 * flaeche, kein Spielcode. Sie steht deshalb unter Dev.
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
    if (!covered && !section.includes(`\`${dir}/\``)) {
      problems.push(`docs/INDEX.md: Wurzelordner ${dir}/ fehlt in "## Ordner".`);
    }
  }
  if (!section.includes('ohne `governance`')) {
    problems.push('docs/INDEX.md: Spiel-Schicht muss "src/core" ohne governance nennen.');
  }
  return problems;
}

const CODEOWNER_ENTRY = /^\/([^/\s]+)\//gm;

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
