#!/usr/bin/env node
/**
 * Gate: Textbaustein-Pools und die Pflicht pro Commit.
 *
 * Ohne `--commit` prueft der Lauf Mindestgroesse je Pool, doppelte Texte und
 * den Fortschritt zum Ziel. Mit `--commit` (Pre-Commit-Hook) muss der Commit
 * zusaetzlich mindestens einen neuen, im Manifest registrierten Beitrag
 * enthalten, und dieser muss eine Luecke schliessen, solange es eine gibt.
 *
 * Ausnahme: ein Commit, dessen Dateien ausschliesslich Pflegepfade (Doku,
 * Inventur, Claims, Kontrollebene, Werkzeuge) anfassen, braucht keinen neuen
 * Baustein. Die Grenze steht in `MAINTENANCE_PATHS`; sie ist alles-oder-nichts
 * und schliesst `content/`, `src/`, `public/` und `package.json` aus.
 * Pool-Regeln gelten auch dort.
 *
 * Schrumpf-Schutz: ein Commit, der einen Beitrag loescht oder einen Pool
 * verkleinert, ist immer ein Verstoss - auch in einem Pflege-Commit.
 *
 * Ohne gestagte Dateien - etwa bei einer reinen Message-Korrektur per
 * `git commit --amend` - ist der Commit selbst das Pruefobjekt: die Dateiliste
 * kommt dann aus `HEAD` gegen seine Eltern. Sonst waere die Ausnahme fuer
 * genau den Fall unerreichbar, den das Commit-Gate verlangt.
 *
 * Mit `--pr` gilt die Pflicht fuer den gesamten Branch-Diff gegen `BASE_REF`
 * (Default `origin/main`). Ein Amend verliert dann seinen bereits vorhandenen
 * Baustein nicht, weil der Branch ihn weiterhin gegen die Basis hinzufuegt.
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
  shrinkIssues,
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
  const gitPaths = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' })
    .trim().split('\n').filter(Boolean);
  // `-m` liefert bei einem Merge die Vereinigung der Pfade gegen alle Eltern;
  // ohne HEAD (erster Commit) bleibt die Liste leer und die Pflicht greift.
  const commitPaths = (extra = []) => {
    try {
      return gitPaths(['diff-tree', '-r', '-m', '--no-commit-id', '--name-only', ...extra, 'HEAD']);
    } catch {
      return [];
    }
  };
  const staged = gitPaths(['diff', '--cached', '--name-only']);
  const prMode = process.argv.includes('--pr');
  const base = process.env.BASE_REF ?? 'origin/main';
  let changed;
  let deletedPaths;
  let addedPaths;
  let source;
  if (prMode) {
    try {
      changed = gitPaths(['diff', '--cached', '--name-only', base]);
      deletedPaths = gitPaths(['diff', '--cached', '--name-only', '--diff-filter=D', base])
        .filter((path) => path.startsWith('content/narrative/contributions/'));
      addedPaths = gitPaths(['diff', '--cached', '--name-only', '--diff-filter=A', base])
        .filter((path) => path.startsWith('content/narrative/contributions/'));
      source = `Branch-Diff ${base}..Index`;
    } catch {
      console.error(`[narrative-blocks] Basis '${base}' nicht lesbar; --pr braucht einen Basis-Ref`);
      process.exit(1);
    }
  } else {
    const fromCommit = staged.length === 0;
    changed = fromCommit ? commitPaths() : staged;
    deletedPaths = (fromCommit
      ? commitPaths(['--diff-filter=D'])
      : gitPaths(['diff', '--cached', '--name-only', '--diff-filter=D']))
      .filter((path) => path.startsWith('content/narrative/contributions/'));
    addedPaths = fromCommit
      ? commitPaths(['--diff-filter=A']).filter((path) => path.startsWith('content/narrative/contributions/'))
      : gitPaths(['diff', '--cached', '--name-only', '--diff-filter=A', '--', 'content/narrative/contributions']);
    source = fromCommit ? 'Dateiliste aus HEAD, nichts gestagt' : 'nur Doku/Inventur/Tooling';
  }
  const deletedReport = poolReport(fragments);
  issues.push(...shrinkIssues({ deleted: deletedPaths, before: deletedReport.counts, after: report.counts }));
  if (isMaintenanceOnly(changed)) {
    console.log(`[narrative-blocks] Pflege-Commit (${source}): Baustein-Pflicht entfaellt, Pool-Regeln gelten weiter`);
  } else {
    const added = [];
    for (const path of addedPaths) {
      const data = JSON.parse(readFileSync(join(ROOT, path), 'utf8'));
      const registered = (content.manifest?.turns ?? []).some((entry) => entry.contributionId === data.contributionId);
      if (!registered) issues.push(`Neuer Beitrag ${data.contributionId} ist nicht im Turn-Manifest registriert`);
      const wired = fragments.some((fragment) => fragment.contributionId === data.contributionId);
      if (!wired) issues.push(`Neuer Beitrag ${data.contributionId} ist nicht in der Registry verdrahtet`);
      added.push({ contributionId: data.contributionId, slot: data.slot });
    }
    // `--pr` prueft den gesamten Branch-Diff; normale Commits pruefen weiterhin
    // nur den gestagten Inhalt. Ein Amend mit gestagten Aenderungen findet
    // seinen bereits vorhandenen Baustein damit wieder.
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
