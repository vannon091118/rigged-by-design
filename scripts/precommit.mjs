#!/usr/bin/env node
/**
 * Zentraler Pre-Commit-Runner.
 *
 * Der Ablauf steht nur hier, nicht in einer Shell-Kette. Reihenfolge:
 *   1. eigenen Claim stagen (nie anlegen, nie erweitern)
 *   2. Claim, Task-Vertrag und Testplatzierung pruefen
 *   3. Narrative-Quellen validieren
 *   4. deterministische Artefakte erzeugen und nur Generiertes stagen
 *   5. Narrative, Doku, LOC und Freeze gegen genau diesen Stand pruefen
 *
 * Ohne node_modules laufen alle Git-/Datei-Pruefungen und die Generator-
 * schritte weiter; nur die TypeScript-abhaengige Dependency-Matrix entfaellt.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { claimForBranch } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';

const node = process.execPath;
const script = (name) => join(ROOT, 'scripts', name);
const hasModules = existsSync(join(ROOT, 'node_modules'));

function git(args) {
  try {
    const output = execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return typeof output === 'string' ? output.trim() : '';
  } catch {
    return '';
  }
}

function run(name, args = [], env = {}) {
  console.log(`precommit: ${name}`);
  const result = spawnSync(node, [script(name), ...args], {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...env },
  });
  if (result.error) {
    console.error(`precommit: ${name} konnte nicht gestartet werden: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function stageIfChanged(path) {
  if (!existsSync(join(ROOT, path))) return;
  if (!git(['status', '--porcelain', '--', path])) return;
  git(['add', '--', path]);
  console.log(`precommit: gestaged ${path}`);
}

/** Nur der eigene, bereits existierende Claim darf in den Commit wandern. */
function stageOwnClaim() {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!branch || branch === 'main') return;
  const claim = claimForBranch(branch);
  if (!claim) return;
  const slug = claim.id
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  if (!slug) return;
  stageIfChanged(`.lane-claims/claims/${slug}.json`);
}

/** Gestagter Narrative-Inhalt muss exakt dem Arbeitsbaum entsprechen. */
function verifyNarrativeStaged() {
  const paths = git(['diff', '--cached', '--name-only', '--', 'content/narrative'])
    .split(/\r?\n/)
    .filter(Boolean);
  for (const path of paths) {
    const result = spawnSync('git', ['diff', '--quiet', '--', path], { cwd: ROOT });
    if (result.status !== 0) {
      console.error(
        `precommit: ${path} ist gestaged, aber im Arbeitsbaum veraendert (ERR-4022) - erst stagen oder Aenderung verwerfen`,
      );
      process.exit(1);
    }
  }
}

stageOwnClaim();
run('verify-lane-claims.mjs');
run('verify-task-contract.mjs', ['--staged']);
run('verify-test-placement.mjs', ['--staged']);
verifyNarrativeStaged();

if (hasModules) {
  run('sync-dependency-matrix.mjs');
  stageIfChanged('docs/DEPENDENCY-MATRIX.md');
}

// Ein Lauf erzeugt Testkatalog, Inventur, Marker, Registry und Roadmap.
// --catalog ist Teil dieses Laufs; der Hook ruft test-catalog nicht separat.
run('sync-generated.mjs', ['--staged', '--catalog']);

// Erst der Generator kompiliert die Registry; danach pruefen Content und
// Bausteinpflicht genau den Stand, der gestaged wurde.
run('verify-narrative-content.mjs');

// Der Claim wird nach dem Stagen der generierten Dateien erneut geprueft:
// kein Generator darf eine nicht gedeckte Datei in den Commit schieben.
run('verify-lane-claims.mjs');
run('verify-narrative-blocks.mjs', ['--commit', '--pr'], {
  BASE_REF: process.env.BASE_REF ?? 'origin/main',
});
run('verify-docs.mjs');
run('check-loc.mjs');
run('verify-governance-freeze.mjs');

console.log('precommit: PASS (Claims, Artefakte, Narrative, Doku, LOC und Freeze geprueft)');
