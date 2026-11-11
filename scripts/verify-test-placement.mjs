#!/usr/bin/env node
/**
 * Neue Testdateien muessen beim Ziel liegen.
 *
 * Der Testkopf nennt mit `@test-target` die gepruefte Datei. Fuer neue oder
 * verschobene Tests gilt:
 *   src/a/b/c.ts  ->  src/a/b/__tests__/
 * Tests fuer scripts/, .github/ und content/ bleiben zentral unter
 * src/core/governance/__tests__/. Bestehende Legacy-Tests werden nicht
 * umgezogen; geprueft wird nur, was neu hinzukommt oder verschoben wird.
 *
 * Aufruf:
 *   node scripts/verify-test-placement.mjs            # neuer Diff gegen origin/main
 *   node scripts/verify-test-placement.mjs --staged   # nur der Index (Pre-Commit)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { ROOT } from './lib/report.mjs';

const staged = process.argv.includes('--staged');
const base = process.env.BASE_REF ?? 'origin/main';
const TEST_FILE = /\.(test|bench)\.tsx?$/;

const git = (args) => {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
};

/** `git diff --name-status` liefert bei Rename/Copy old und new; nur new zaehlt. */
function changedTestPaths(output) {
  const paths = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const [status, ...parts] = line.split('\t');
    if (!status || parts.length === 0) continue;
    if (status.startsWith('A') || status.startsWith('R') || status.startsWith('C')) {
      const path = parts.at(-1);
      if (path && TEST_FILE.test(path)) paths.push(path);
    }
  }
  return paths;
}

function diffPaths() {
  if (staged) {
    return changedTestPaths(
      git(['diff', '--cached', '--name-status', '--find-renames', '--diff-filter=ACMR']),
    );
  }
  const worktree = git([
    'diff',
    '--name-status',
    '--find-renames',
    '--diff-filter=ACMR',
    base,
  ]);
  const untracked = git(['ls-files', '--others', '--exclude-standard'])
    .split(/\r?\n/)
    .filter((path) => path && TEST_FILE.test(path));
  return [...new Set([...changedTestPaths(worktree), ...untracked])];
}

function targetOf(path) {
  let text;
  try {
    text = readFileSync(join(ROOT, path), 'utf8');
  } catch {
    return null;
  }
  return /@test-target:\s*([^\s|*]+)/.exec(text)?.[1] ?? null;
}

function expectedDirectory(target) {
  const normalized = target.replaceAll('\\', '/');
  if (normalized.startsWith('src/')) return `${dirname(normalized)}/__tests__`;
  if (
    normalized.startsWith('scripts/') ||
    normalized.startsWith('.github/') ||
    normalized.startsWith('content/')
  ) {
    return 'src/core/governance/__tests__';
  }
  return null;
}

const files = [...new Set(diffPaths())].sort();
const failures = [];
let checked = 0;

for (const file of files) {
  const target = targetOf(file);
  if (!target) continue;
  const expected = expectedDirectory(target);
  if (!expected) continue;
  checked += 1;
  if (file === expected || file.startsWith(`${expected}/`)) continue;
  failures.push(
    `${file}: Ziel ${target} erwartet den Spiegelpfad ${expected}/ (ERR-4019)`,
  );
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`[ERR-4019] verify-test-placement: ${failure}`);
  console.error(`verify-test-placement: ${failures.length} Verstoss/Verstoesse`);
  process.exit(1);
}

console.log(`verify-test-placement: PASS (${checked} neue/verschobene Testdatei(en))`);
