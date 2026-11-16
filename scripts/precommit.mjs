#!/usr/bin/env node
/**
 * Zentraler Pre-Commit-Runner.
 *
 * Der Ablauf steht nur hier, nicht in einer Shell-Kette. Reihenfolge:
 *   1. eigenen Claim stagen (nie anlegen, nie erweitern)
 *   2. Claim, Task-Vertrag und Testplatzierung pruefen
 *   3. Narrative-Quellen validieren
 *   4. deterministische Artefakte erzeugen und nur Generiertes stagen
 *   5. Narrative, Doku und LOC gegen genau diesen Stand pruefen
 *
 * Ohne node_modules laufen alle Git-/Datei-Pruefungen und die Generator-
 * schritte weiter; nur die TypeScript-abhaengige Dependency-Matrix entfaellt.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { claimForBranch } from './lib/lane-claims.mjs';
import { ROOT } from './lib/report.mjs';
import { logsEnabled } from './lib/compact.mjs';
import { captureConsole } from './lib/compact.mjs';

const node = process.execPath;
const script = (name) => join(ROOT, 'scripts', name);
const hasModules = existsSync(join(ROOT, 'node_modules'));
// Der Hook bleibt unter 500 Token; jeder Schritt schreibt sein eigenes Log.
captureConsole({ label: 'precommit' });

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
  const withLog = logsEnabled();
  const log = join(ROOT, '.verify-cache', 'output', `precommit-${name.replace(/\.mjs$/, '')}.log`);
  const result = spawnSync(node, [script(name), ...args], {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
    env: { ...process.env, ...env },
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  if (result.error) {
    console.error(`precommit: ${name} konnte nicht gestartet werden: ${result.error.message}`);
    process.exit(1);
  }
  if (result.status !== 0) {
    // Nur rote Schritte bekommen ein Log, und nur mit --log; der Error Code
    // steht als erste Zeile, auch wenn der Schritt selbst keinen nennt.
    if (withLog && output.trim() !== '') {
      mkdirSync(dirname(log), { recursive: true });
      const code = /(ERR-\d{4})/.exec(output)?.[1] ?? 'ERR-4019';
      writeFileSync(log, `[${code}] precommit ${name} fehlgeschlagen\n${output}`, 'utf8');
    }
    const tail = output.trim().split('\n').slice(-8).join('\n');
    console.error(`precommit: ${name}: ROT${withLog ? ` (Log: ${log})` : ''}${tail ? `\n${tail}` : ''}`);
    process.exit(result.status ?? 1);
  }
  console.log(`precommit: ${name}: ok`);
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
run('verify-output-budget.mjs');
run('verify-contracts.mjs');
run('verify-task-contract.mjs', ['--staged']);
// Closeout-Hygiene: offener Claim + belegtes geschlossenes Issue ist ein
// Befund. Unbekannte Status bleiben sichtbar, blockieren aber nicht.
run('claim-hygiene.mjs', ['--check']);
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

console.log('precommit: PASS (Claims, Artefakte, Narrative, Doku und LOC geprueft)');
