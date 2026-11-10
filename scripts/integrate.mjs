#!/usr/bin/env node
/**
 * Integrationscontroller: eine Pruefung vor der CI, ein Reparaturpfad.
 *
 * Aufruf:
 *   node scripts/integrate.mjs --check [--fetch] [--json]
 *   node scripts/integrate.mjs --check --ci --no-fetch \
 *        --base=<sha> --head=<sha> --github-output=<datei>
 *   node scripts/integrate.mjs --apply [--push]
 *
 * `--check` ist schnell: `git fetch`, Claim-Gate optional, `git merge-tree` und
 * die Klassifikation der Konfliktpfade. Keine Suite, kein Build, keine 15
 * Minuten fuer einen Push.
 *
 * `--apply` rebased auf die Basis und regeneriert ausschliesslich generierte
 * Artefakte. Echte Quellcode-Konflikte brechen ab (`MANUAL_CONFLICT`), ohne
 * kreative Loesung. Ein Push passiert nur mit `--push` und dann ausschliesslich
 * per Fast-Forward: Der Controller schreibt nie umgeschriebene Historie. Nach
 * einem Rebase meldet er READY, und der Push per Hand bleibt die einzige Stelle
 * fuer einen Rebase-Push (AGENTS.md).
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { EXIT, INTEGRATION, integrationStatus } from './lib/integration.mjs';
import { ROOT } from './lib/report.mjs';

const args = process.argv.slice(2);
const has = (name) => args.includes(`--${name}`);
const arg = (name) => {
  const hit = args.find((value) => value.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const index = args.indexOf(`--${name}`);
  const next = index >= 0 ? args[index + 1] : undefined;
  return next && !next.startsWith('--') ? next : undefined;
};

const check = !has('apply');
const ci = has('ci');
const json = has('json');
const shouldFetch = has('fetch') || (!has('no-fetch') && !ci);
const base = arg('base') || 'origin/main';
const head = arg('head') || 'HEAD';
const outputFile = arg('github-output');
const push = has('push');

const run = (list, options = {}) =>
  execFileSync('git', list, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_EDITOR: 'true', ...(options.env ?? {}) },
  });

const tryRun = (list, options = {}) => {
  try {
    return { ok: true, out: run(list, options) };
  } catch (error) {
    return { ok: false, out: `${error?.stdout ?? ''}${error?.stderr ?? ''}` };
  }
};

if (shouldFetch) {
  const fetched = tryRun(['fetch', '--no-tags', 'origin', 'main']);
  if (!fetched.ok) {
    console.error('integrate: `git fetch origin main` fehlgeschlagen; Pruefung gegen den lokalen Stand.');
  }
}

const status = integrationStatus({ base, head, cwd: ROOT });

const emit = (lines) => {
  for (const line of lines) console.log(line);
};

const summary = {
  status: status.status,
  reason: status.reason,
  base,
  head,
  behind: status.behind,
  ahead: status.ahead,
  conflicts: status.conflicts,
  generated: status.generated,
  source: status.source,
};

if (outputFile) {
  appendFileSync(outputFile, `integration=${status.status}\n`);
  appendFileSync(outputFile, `integration_reason=${status.reason}\n`);
}

if (json) {
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
} else {
  emit([`integrate: ${status.status} — ${status.reason}`]);
  if (status.behind > 0) emit([`  hinter der Basis: ${status.behind} Commit(s)`]);
  if (status.generated.length > 0) {
    emit(['  generierte Konflikte (regenerierbar):', ...status.generated.map((file) => `    - ${file}`)]);
  }
  if (status.source.length > 0) {
    emit(['  Quellkonflikte (manuell):', ...status.source.map((file) => `    - ${file}`)]);
  }
}

if (ci) {
  if (status.status === INTEGRATION.REBASE_REQUIRED) {
    console.log('::warning::Integrationsstatus REBASE_REQUIRED: Branch aktualisieren, generierte Artefakte regenerieren.');
  }
  if (status.status === INTEGRATION.MANUAL_CONFLICT) {
    console.log('::warning::Integrationsstatus MANUAL_CONFLICT: Konflikt in Handdateien; keine automatische Reparatur.');
  }
}

if (check) {
  process.exit(EXIT[status.status] ?? EXIT.MANUAL_CONFLICT);
}

// Ab hier: --apply
if (status.status === INTEGRATION.READY) process.exit(0);
if (status.status === INTEGRATION.MANUAL_CONFLICT) {
  console.error('integrate: MANUAL_CONFLICT — echte Quellcode-Konflikte werden nicht automatisch geloest.');
  process.exit(EXIT.MANUAL_CONFLICT);
}

const branch = tryRun(['rev-parse', '--abbrev-ref', 'HEAD']).out.trim();
const dirty = tryRun(['status', '--porcelain']).out.trim();
if (dirty) {
  console.error('integrate: Arbeitsbaum ist nicht sauber; erst committen oder verwerfen.');
  process.exit(1);
}

const rebase = tryRun(['rebase', base]);
if (!rebase.ok) {
  const conflicted = tryRun(['diff', '--name-only', '--diff-filter=U']).out
    .split(/\r?\n/)
    .filter(Boolean);
  const sourceFiles = conflicted.filter((file) => !status.generated.includes(file));
  if (sourceFiles.length > 0) {
    tryRun(['rebase', '--abort']);
    console.error('integrate: MANUAL_CONFLICT — Rebase-Konflikt in Handdateien:');
    for (const file of sourceFiles) console.error(`  - ${file}`);
    process.exit(EXIT.MANUAL_CONFLICT);
  }
  // Nur generierte Artefakte: die Basis-Seite nehmen und danach aus den
  // Quellen neu erzeugen. Der Generator ist der Eigentuemer, nicht der Merge.
  for (const file of conflicted) {
    tryRun(['checkout', '--ours', '--', file]);
    tryRun(['add', '--', file]);
  }
  const continued = tryRun(['rebase', '--continue'], { env: { GIT_EDITOR: 'true' } });
  if (!continued.ok) {
    tryRun(['rebase', '--abort']);
    console.error('integrate: Rebase konnte auch nach der Regeneration nicht fortgesetzt werden; Zustand zurueckgesetzt.');
    process.exit(EXIT.MANUAL_CONFLICT);
  }
}

let regenerated;
try {
  execFileSync(process.execPath, [resolve(ROOT, 'scripts', 'sync-generated.mjs'), '--all'], {
    cwd: ROOT,
    stdio: ['ignore', 'inherit', 'inherit'],
  });
  regenerated = { ok: true };
} catch {
  regenerated = { ok: false };
}
if (!regenerated.ok) {
  console.error('integrate: Regeneration fehlgeschlagen; Commit bleibt unveraendert.');
  process.exit(1);
}

const changed = tryRun(['status', '--porcelain']).out.trim();
if (changed) {
  tryRun(['add', '--', 'docs/INVENTORY.md', 'docs/ROADMAP.md', 'content/narrative/registry', 'src/core/sim/narrative/composer']);
  const committed = tryRun(['commit', '--amend', '--no-edit'], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (!committed.ok) {
    console.error('integrate: Regeneration konnte nicht in den Commit uebernommen werden.');
    process.exit(1);
  }
}

if (push) {
  // Kein Force-Push aus Produktionsskripten (destructive-commands-Gate):
  // Nach einem Rebase ist kein Fast-Forward moeglich, dann meldet der
  // Controller READY und der Push per Hand uebernimmt.
  const pushed = tryRun(['push', 'origin', `HEAD:${branch}`], { stdio: ['ignore', 'inherit', 'inherit'] });
  if (!pushed.ok) {
    console.error(`integrate: Kein Fast-Forward auf ${branch} moeglich; Branch per Hand aktualisieren, dann READY.`);
    process.exit(1);
  }
}

console.log(`integrate: READY auf ${branch}${push ? ' (gepusht per Fast-Forward)' : ''}`);
process.exit(0);
