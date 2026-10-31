#!/usr/bin/env node
/** Inhalts-Hash-Cache: identischer Arbeitsbaum -> gruenes Gate wird nicht erneut gerechnet. */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

const CACHE_DIR = join(ROOT, 'node_modules', '.cache', 'rbd-verify');
const entry = (name) => join(CACHE_DIR, `${name}.json`);

function fingerprint() {
  const files = execFileSync('git', ['ls-files', '-z', '-co', '--exclude-standard'], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  }).split('\0').filter(Boolean).sort();
  const hash = createHash('sha256');
  hash.update(`${process.version}\0`);
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
  if (process.env.RBD_VERIFY_NO_CACHE === '1' || !existsSync(entry(name))) return false;
  try {
    return JSON.parse(readFileSync(entry(name), 'utf8')).key === key;
  } catch {
    return false;
  }
}

export function markCached(name, key) {
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(entry(name), JSON.stringify({ key, at: new Date().toISOString() }));
}

export function dropCached(name) {
  rmSync(entry(name), { force: true });
}
