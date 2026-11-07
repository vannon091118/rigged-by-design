#!/usr/bin/env node
/**
 * Gate: Textbaustein-Pools und die Pflicht pro Commit.
 *
 * Ohne `--commit` prueft der Lauf Mindestgroesse je Pool, doppelte Texte und
 * den Fortschritt zum Ziel. Mit `--commit` (Pre-Commit-Hook) muss der Commit
 * zusaetzlich mindestens einen neuen, im Manifest registrierten Beitrag
 * enthalten, und dieser muss eine Luecke schliessen.
 *
 * Ausnahme: ein Commit, dessen gestagte Dateien ausschliesslich Pflegepfade
 * (Doku, Inventur, Claims, Kontrollebene, Werkzeuge) anfassen, braucht keinen
 * neuen Baustein. Die Grenze steht in `MAINTENANCE_PATHS`; sie ist
 * alles-oder-nichts und schliesst `content/`, `src/`, `public/` und
 * `package.json` aus. Pool-Regeln gelten auch dort.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  gapIssues,
  isMaintenanceOnly,
  POOL_MINIMUM,
  POOL_TARGET,
  poolIssues,
  poolReport,
  poolSlots,
} from './lib/narrative-blocks.mjs';
import { loadNarrativeContent } from './lib/narrative-content.mjs';
import { ROOT } from './lib/report.mjs';

const commitMode = process.argv.includes('--commit');
const content = loadNarrativeContent(ROOT);
if (!content.ok) {
  for (const problem of content.issues.slice(0, 12)) console.error(`[narrative-blocks] ${problem.path}: ${problem.message}`);
  console.error(`[narrative-blocks] Narrative-Content ungueltig (${content.issues.length} Befunde)`);
  process.exit(1);
}

const fragments = content.compiled.fragments;
const report = poolReport(fragments);
const slots = poolSlots(content.vocabulary);
const issues = poolIssues({ ...report, slots });

if (commitMode) {
  const staged = execFileSync('git', ['diff', '--cached', '--name-only'], {
    cwd: ROOT,
    encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);
  if (isMaintenanceOnly(staged)) {
    console.log('[narrative-blocks] Pflege-Commit (nur Doku/Inventur/Tooling): Baustein-Pflicht entfaellt, Pool-Regeln gelten weiter');
  } else {
    const addedPaths = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=A', '--', 'content/narrative/contributions'], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim().split('\n').filter(Boolean);
    const added = [];
    for (const path of addedPaths) {
      const data = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
      const registered = (content.manifest?.turns ?? []).some((entry) => entry.contributionId === data.contributionId);
      if (!registered) issues.push(`Neuer Beitrag ${data.contributionId} ist nicht im Turn-Manifest registriert`);
      const wired = fragments.some((fragment) => fragment.contributionId === data.contributionId);
      if (!wired) issues.push(`Neuer Beitrag ${data.contributionId} ist nicht in der Registry verdrahtet`);
      added.push({ contributionId: data.contributionId, slot: data.slot });
    }
    const before = { ...report.counts };
    for (const entry of added) before[entry.slot] = Math.max(0, (before[entry.slot] ?? 0) - 1);
    issues.push(...gapIssues({ before, added }));
  }
}

const smallest = slots.map((slot) => `${slot} ${report.counts[slot] ?? 0}`).join(', ');
console.log(`[narrative-blocks] ${report.total}/${POOL_TARGET} Bausteine; Minimum ${POOL_MINIMUM}; ${smallest}`);
if (issues.length > 0) {
  for (const problem of issues) console.error(`[narrative-blocks] ${problem}`);
  console.error(`[narrative-blocks] ${issues.length} Verstoss/Verstoesse`);
  process.exit(1);
}
console.log('[narrative-blocks] PASS');
