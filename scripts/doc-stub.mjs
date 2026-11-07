#!/usr/bin/env node
/**
 * Erzeugt die Pflichteintraege fuer eine Aenderung aus einem Titel.
 *
 * Schreibt Changelog-Zeile, Devtagebuch-Eintrag und Inventar-Logzeile mit
 * Datum, Version und Uhrzeit. Inhalte bleiben Platzhalter, bis der Agent sie
 * fuellt; der Marker wird anschliessend synchronisiert.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { syncDocs } from './lib/doc-sync.mjs';
import { fail, ROOT } from './lib/report.mjs';

const title = (process.argv.slice(2).find((arg) => !arg.startsWith('--')) ?? '').trim();
if (title.length < 8 || title.includes('\n')) {
  fail(1, 'ERR-4021', 'docs:stub', 'Titel fehlt oder ist kuerzer als 8 Zeichen.');
  process.exit(1);
}

const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
const now = new Date();
const day = now.toISOString().slice(0, 10);
const stamp = `${day} ${now.toISOString().slice(11, 16)} UTC`;

const read = (path) => readFileSync(join(ROOT, path), 'utf8');
const write = (path, text) => writeFileSync(join(ROOT, path), text);

const changelog = read('docs/CHANGELOG.md');
if (!changelog.includes(`- ${title}`)) {
  const marker = '### Technik';
  const at = changelog.indexOf(marker);
  const line = `- ${title}`;
  write(
    'docs/CHANGELOG.md',
    at >= 0
      ? `${changelog.slice(0, at + marker.length)}\n${line}${changelog.slice(at + marker.length)}`
      : `${changelog.trimEnd()}\n${line}\n`,
  );
}

const diary = read('docs/DEVTAGEBUCH.md');
const heading = `## ${day} - ${title}`;
if (!diary.includes(heading)) {
  const entry = `${heading}\n\n**Ziel.** ${title}\n\n**Umsetzung.** Offen.\n\n**Pruefungen.** Offen.\n\n**Offen.** Offen.\n\n`;
  const anchor = '## Regeln';
  const at = diary.indexOf(anchor);
  const insertAt = at >= 0 ? diary.indexOf('\n## ', at + anchor.length) : -1;
  write(
    'docs/DEVTAGEBUCH.md',
    insertAt >= 0 ? `${diary.slice(0, insertAt + 1)}${entry}${diary.slice(insertAt + 1)}` : `${diary.trimEnd()}\n\n${entry}`,
  );
}

const inventory = read('docs/INVENTORY.md');
const numbers = [...inventory.matchAll(/^\| T(\d+) \|/gm)].map((match) => Number(match[1]));
const next = (numbers.length > 0 ? Math.max(...numbers) : 0) + 1;
const row = `| T${next} | **${stamp}**: ${title}. |`;
const firstRow = inventory.search(/^\| T\d+ \|/m);
write(
  'docs/INVENTORY.md',
  firstRow >= 0 ? `${inventory.slice(0, firstRow)}${row}\n${inventory.slice(firstRow)}` : `${inventory.trimEnd()}\n${row}\n`,
);

const changed = syncDocs(version, stamp);
console.log(`docs:stub: Changelog, Devtagebuch und T${next} angelegt (v${version} | ${stamp})`);
if (changed.length > 0) console.log(`docs:stub: Marker aktualisiert: ${changed.join(', ')}`);
