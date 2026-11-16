/**
 * Inhalts-Hash-Cache: identischer Arbeitsbaum -> gruenes Gate wird nicht erneut gerechnet.
 *
 * Der Fingerabdruck liest nicht mehr jede getrackte Datei durch Node, sondern
 * nutzt Git: HEAD, der binaere Diff gegen HEAD (enthaelt gestagte und unstaged
 * Aenderungen) und der Inhalt unversionierter Dateien. Das ist exakt fuer den
 * Pruefbaum und deutlich schneller als ein vollstaendiger Dateidurchlauf.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';
import { dropGate, readGates, writeGate } from './verify-state.mjs';

// Der Cache liegt ausserhalb von node_modules: pnpm install --frozen-lockfile
// zerstoert jedes Mal node_modules und damit jeden Gate-Cache, bevor die
// Pipeline ueberhaupt laeuft. Seit #1039 ist er ein Abschnitt in
// `.verify-cache/state.json`; den Pfad kennt nur `verify-state.mjs`.
const MAX_BUFFER = 128 * 1024 * 1024;

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_BUFFER,
    stdio: ['ignore', 'pipe', 'ignore'],
    ...options,
  });
}

/** Exakter Baumfingerabdruck in drei Git-Aufrufen statt N Dateilesevorgaengen. */
function fingerprint() {
  const hash = createHash('sha256');
  hash.update(`${process.version}\0`);
  try {
    hash.update(git(['rev-parse', 'HEAD']));
    // `--binary` erhaelt die exakte Aenderung; ohne `--binary` waere ein
    // geaenderter Binaerwert nur als "Binary files differ" sichtbar.
    hash.update('\0diff\0');
    hash.update(git(['diff', '--binary', '--no-color', 'HEAD']));
  } catch {
    // Kein HEAD (frisches Repo): lieber alle Dateien lesen als falsch cachen.
    return legacyFingerprint(hash);
  }
  hash.update('\0untracked\0');
  const untracked = git(['ls-files', '-o', '--exclude-standard', '-z']).split('\0').filter(Boolean).sort();
  for (const file of untracked) {
    hash.update(`${file}\0`);
    try {
      hash.update(readFileSync(join(ROOT, file)));
    } catch {
      hash.update('unlesbar');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

function legacyFingerprint(hash) {
  const files = git(['ls-files', '-z', '-co', '--exclude-standard']).split('\0').filter(Boolean).sort();
  for (const file of files) {
    hash.update(`${file}\0`);
    try {
      hash.update(readFileSync(join(ROOT, file)));
    } catch {
      hash.update('unlesbar');
    }
    hash.update('\0');
  }
  return hash.digest('hex');
}

let memo;
export function treeKey() {
  memo ??= fingerprint();
  return memo;
}

/** Nach dem Autofix hat sich der Baum geaendert: Hash neu berechnen. */
export function resetTreeKey() {
  memo = undefined;
}

export function isCached(name, key) {
  if (process.env.RBD_VERIFY_NO_CACHE === '1') return false;
  return readGates()[name]?.key === key;
}

export function markCached(name, key) {
  writeGate(name, { key, at: new Date().toISOString() });
}

export function dropCached(name) {
  dropGate(name);
}
