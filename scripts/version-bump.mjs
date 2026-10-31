#!/usr/bin/env node
/**
 * Versionsnummer des Turns: wird vor `verify` gebumpt, damit der gepushte Baum
 * bereits die Version traegt, die der Release-Workflow nur noch taggt.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('..', import.meta.url));

/** Patch-Version um eins hoch; alles andere an der Version ist ein Fehler. */
export function nextPatch(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Ungueltige Version in package.json: ${version}`);
  }
  const [major, minor, patch] = parts;
  return `${major}.${minor}.${patch + 1}`;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));
const writeJson = (file, data) => writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);

/**
 * Bumpt die Patch-Version in `package.json` und an beiden Stellen der Lockfile.
 * Die Lockfile muss mit, sonst bricht `npm ci` in der CI an der Versionsdifferenz ab.
 */
export function bumpPatch(root = ROOT) {
  const pkgPath = join(root, 'package.json');
  const pkg = readJson(pkgPath);
  if (typeof pkg.version !== 'string') throw new Error('package.json hat keine version');
  const version = nextPatch(pkg.version);
  pkg.version = version;
  writeJson(pkgPath, pkg);
  try {
    const lock = readJson(join(root, 'package-lock.json'));
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    writeJson(join(root, 'package-lock.json'), lock);
  } catch {
    // Ohne Lockfile bleibt es beim Bump der package.json.
  }
  return version;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const pkg = readJson(join(ROOT, 'package.json'));
  if (process.argv.includes('--dry-run')) {
    console.log(`version-bump: ${pkg.version} -> ${nextPatch(pkg.version)}`);
  } else {
    console.log(`version-bump: ${pkg.version} -> ${bumpPatch()}`);
  }
}
