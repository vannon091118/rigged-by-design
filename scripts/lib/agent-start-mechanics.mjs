/**
 * Mechanik-Scan: was ist verdrahtet, was ist nur aus Tests/Doku bekannt, was
 * hat gar keinen Aufrufer? Nur der letzte Fall blockiert.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

const FLOW_ENTRIES = [
  { id: 'board-live', rule: 'Reihenfolge und Claim-Lage kommen aus GitHub, nicht aus lokalen Dateien', artifact: 'scripts/lib/github-rest.mjs' },
  { id: 'claim-gate', rule: 'ein Issue hat genau einen Halter; fremder Claim blockiert den Start', artifact: 'scripts/lib/issue-claim.mjs' },
  { id: 'actor-policy', rule: 'nur verifizierte Autoren aendern Board-Zustand', artifact: '.lane-claims/actors.json' },
];
const CONDITIONAL = new Map([
  ['install-webhook.mjs', 'klassischer Webhook braucht eine erreichbare Empfaenger-URL; ohne Empfaenger erzeugt pnpm run board:overview die Uebersicht lokal'],
]);
const IGNORE = new Set(['github-rest-fetch.mjs', 'agent-start.mjs']);

export function scanMechanics() {
  let scripts;
  try {
    scripts = readdirSync(join(ROOT, 'scripts')).filter((name) => name.endsWith('.mjs')).sort();
  } catch {
    return { wired: [], orphan: [], unused: [], entries: [] };
  }
  const npm = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).scripts ?? {};
  const references = new Map();
  const add = (file, source) => {
    if (!references.has(file)) references.set(file, []);
    if (!references.get(file).includes(source)) references.get(file).push(source);
  };
  for (const [name, command] of Object.entries(npm)) {
    for (const file of scripts) if (String(command).includes(`scripts/${file}`)) add(file, `npm:${name}`);
  }
  const workflowDir = join(ROOT, '.github', 'workflows');
  if (existsSync(workflowDir)) {
    for (const name of readdirSync(workflowDir).filter((entry) => entry.endsWith('.yml'))) {
      const text = readFileSync(join(workflowDir, name), 'utf8');
      for (const file of scripts) if (text.includes(`scripts/${file}`)) add(file, `workflow:${name}`);
    }
  }
  const hookDir = join(ROOT, '.githooks');
  if (existsSync(hookDir)) {
    for (const name of readdirSync(hookDir)) {
      const text = readFileSync(join(hookDir, name), 'utf8');
      for (const file of scripts) if (text.includes(`scripts/${file}`)) add(file, `hook:${name}`);
    }
  }
  const knownText = [];
  const readTree = (directory) => {
    const full = join(ROOT, directory);
    if (!existsSync(full)) return;
    for (const entry of readdirSync(full, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const path = `${directory}/${entry.name}`;
      if (entry.isDirectory()) readTree(path);
      else if (/\.(md|ts|tsx|mjs)$/.test(entry.name)) {
        const text = readFileSync(join(ROOT, path), 'utf8');
        if (text.includes('scripts/')) knownText.push(text);
      }
    }
  };
  readTree('src');
  readTree('docs');
  if (existsSync(join(ROOT, 'AGENTS.md'))) knownText.push(readFileSync(join(ROOT, 'AGENTS.md'), 'utf8'));
  if (existsSync(join(ROOT, 'README.md'))) knownText.push(readFileSync(join(ROOT, 'README.md'), 'utf8'));
  const knownHay = knownText.join('\n');

  const calledBy = new Map();
  for (const file of scripts) {
    if (IGNORE.has(file)) continue;
    const text = readFileSync(join(ROOT, 'scripts', file), 'utf8');
    for (const other of scripts) {
      if (other === file) continue;
      if (text.includes(`'${other}'`) || text.includes(`"${other}"`) || text.includes(`./${other}`) || text.includes(`scripts/${other}`)) {
        if (!calledBy.has(other)) calledBy.set(other, []);
        calledBy.get(other).push(file);
      }
    }
  }
  const orphan = [];
  const unused = [];
  const wired = [];
  for (const file of scripts) {
    if (IGNORE.has(file)) continue;
    const sources = references.get(file) ?? [];
    if (sources.length > 0) wired.push({ file, sources });
    else if (CONDITIONAL.has(file)) wired.push({ file, sources: ['conditional'], note: CONDITIONAL.get(file) });
    else if ((calledBy.get(file) ?? []).some((caller) => (references.get(caller) ?? []).length > 0)) {
      wired.push({ file, sources: (calledBy.get(file) ?? []).map((caller) => `called-by:${caller}`) });
    } else if (knownHay.includes(`scripts/${file}`)) {
      unused.push({ file, note: 'nur aus Tests/Doku bekannt: wird nie ausgefuehrt — einbinden oder entfernen' });
    } else orphan.push({ file, note: 'niemand referenziert es' });
  }
  return { wired, unused, orphan, entries: FLOW_ENTRIES };
}
