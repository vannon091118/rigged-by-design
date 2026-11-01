#!/usr/bin/env node
/**
 * Redundanz-Gate: eine Wahrheit pro Sache.
 *
 * Geprueft werden byte-identische Quelldateien, doppelte pnpm-Kommandos und
 * doppelt eingetragene Fehlercodes. Inhaltliche Naehe bewertet niemand
 * mechanisch; hier zaehlt nur, was eindeutig doppelt ist.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import { fail, ROOT, walk } from './lib/report.mjs';

const CODE = /\.(ts|tsx|mjs|js|css|md)$/;
/** Bewusste Aliasnamen: gleicher Aufruf, zwei Namen, keine zweite Wahrheit. */
const ALIASES = new Set(['test|test:ci', 'verify|verify:quick']);

const files = [
  ...walk(`${ROOT}/src`, (file) => CODE.test(file)),
  ...walk(`${ROOT}/scripts`, (file) => CODE.test(file)),
  ...walk(`${ROOT}/docs`, (file) => /\.(md|css)$/.test(file)),
  `${ROOT}/AGENTS.md`,
  `${ROOT}/README.md`,
];
const groups = new Map();
for (const file of files) {
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex');
  if (!groups.has(hash)) groups.set(hash, []);
  groups.get(hash).push(relative(ROOT, file));
}

let problems = 0;
for (const copies of groups.values()) {
  if (copies.length < 2) continue;
  problems += 1;
  fail(problems, 'ERR-4020', copies[0], `byte-identisch mit ${copies.slice(1).join(', ')}; eine Kopie entfernen.`);
}

const scripts = JSON.parse(readFileSync(`${ROOT}/package.json`, 'utf8')).scripts ?? {};
const byCommand = new Map();
for (const [name, command] of Object.entries(scripts)) {
  if (!byCommand.has(command)) byCommand.set(command, []);
  byCommand.get(command).push(name);
}
for (const [command, names] of byCommand) {
  if (names.length < 2) continue;
  if (ALIASES.has([...names].sort().join('|'))) continue;
  problems += 1;
  fail(problems, 'ERR-4020', 'package.json', `doppeltes Kommando fuer ${names.join(', ')}: ${command}`);
}

const catalog = readFileSync(`${ROOT}/docs/ERROR_CATALOG.md`, 'utf8');
const codes = [...catalog.matchAll(/\|\s*(ERR-\d{4})\s*\|/g)].map((match) => match[1]);
const seen = new Set();
for (const code of codes) {
  if (seen.has(code)) {
    problems += 1;
    fail(problems, 'ERR-4020', 'docs/ERROR_CATALOG.md', `${code} ist mehrfach eingetragen.`);
  }
  seen.add(code);
}

if (problems > 0) {
  console.error(`verify-redundancy: ${problems} Redundanz/Redundanzen`);
  process.exit(1);
}
console.log(`verify-redundancy: PASS (${files.length} Dateien, ${Object.keys(scripts).length} Skripte, ${codes.length} Codes)`);
