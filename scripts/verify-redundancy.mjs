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
import { measureRedundancy, redundancyFindings } from './lib/redundancy-metrics.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-redundancy' });

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
  fail(problems, 'ERR-4020', copies[0], `byte-identisch mit ${copies.slice(1).join(', ')}; nicht nur entfernen: Verhalten vergleichen, die bessere Umsetzung ausschlachten und eine gemeinsame Wahrheit behalten.`);
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
  fail(problems, 'ERR-4020', 'package.json', `doppeltes Kommando fuer ${names.join(', ')}: ${command}; nicht nur loeschen: beide Wege vergleichen und den besseren gemeinsamen Pfad behalten.`);
}

const catalog = readFileSync(`${ROOT}/docs/ARCHITECTURE.md`, 'utf8');
const codes = [...catalog.matchAll(/^\|\s*(ERR-\d{4})\s*\|/gm)].map((match) => match[1]);
const seen = new Set();
for (const code of codes) {
  if (seen.has(code)) {
    problems += 1;
    fail(problems, 'ERR-4020', 'docs/ARCHITECTURE.md', `${code} ist mehrfach eingetragen.`);
  }
  seen.add(code);
}

// Die fuenf Kennzahlen des globalen Scans sind Obergrenzen, keine Momentaufnahme:
// Waisenquote, Anteil Fan-in <= 1, Entry-Points, Aliase und Doku-Bytes. Sie laufen
// im bestehenden Gate mit, damit Redundanz nicht nur dort auffaellt, wo zwei
// Dateien byte-identisch sind.
const metrics = measureRedundancy({ root: ROOT });
for (const finding of redundancyFindings(metrics)) {
  problems += 1;
  fail(problems, 'ERR-4020', 'Redundanz-Budget', `${finding.metric}: ${finding.value} (Limit ${finding.limit}); ${finding.hint}`);
}

if (problems > 0) {
  console.error(`verify-redundancy: ${problems} Redundanz/Redundanzen`);
  process.exit(1);
}
console.log(
  `verify-redundancy: PASS (${files.length} Dateien, ${Object.keys(scripts).length} Skripte, ${codes.length} Codes; `
  + `Waisen ${metrics.orphanRate} %, Fan-in<=1 ${metrics.fanInAtMostOneRate} %, ${metrics.entryPoints} Entry-Points, `
  + `${metrics.aliases} Aliase, ${metrics.docBytes} Doku-Bytes)`,
);
