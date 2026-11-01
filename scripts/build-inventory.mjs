#!/usr/bin/env node
/**
 * Erzeugt die vollstaendige Dateiliste fuer docs/INVENTORY.md.
 *
 * Wahrheit ist `git ls-files`: jede getrackte Datei bekommt genau eine Zeile,
 * jeder Ordner eine Kopfzeile mit Anzahl. Text wird gelesen (Zeilen, erster
 * Kommentar), Binaerdateien werden an Signatur und Groesse geprueft.
 * Der Block zwischen den Markern ist deterministisch; die Zeit steht im Marker.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { plan } from './lib/escalation.mjs';
import { ROOT } from './lib/report.mjs';

const START = '<!-- inventory:start -->';
const END = '<!-- inventory:end -->';
const TEXT = /\.(ts|tsx|mjs|js|css|md|json|yml|yaml|sh|html|svg)$/;
const GENERATED = new Set(['package-lock.json', 'src/render/assets/manifest.json', 'docs/TEST-CATALOG.md']);
const RISKY = /^\s*(\/\/|\/\*|\*|#)\s*(TODO|FIXME|HACK|XXX|PLACEHOLDER)\b/m;

const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\n');
const dirs = [...new Set(tracked.map((file) => dirname(file)))].sort();

function purposeOf(file, text) {
  if (file.endsWith('.md')) {
    const heading = text.split(/\r?\n/).find((line) => line.startsWith('# '));
    return heading ? heading.slice(2).trim() : 'Markdown-Dokument';
  }
  for (const raw of text.split(/\r?\n/).slice(0, 14)) {
    const line = raw
      .trim()
      .replace(/^\/\*\*?/, '')
      .replace(/^\*\/?/, '')
      .replace(/^\/\//, '')
      .replace(/^#/, '')
      .replace(/\*\/$/, '')
      .trim();
    if (!line || line.startsWith('@') || line.startsWith('!')) continue;
    return line.slice(0, 110);
  }
  return 'Quelldatei ohne Kopfkommentar';
}

function describe(file) {
  const size = statSync(join(ROOT, file)).size;
  const buffer = readFileSync(join(ROOT, file));
  if (!TEXT.test(file) && buffer.includes(0)) {
    if (buffer.subarray(0, 4).toString('hex') === '89504e47') {
      return { purpose: 'PNG-Textur', status: `geprueft: PNG ${buffer.readUInt32BE(16)}x${buffer.readUInt32BE(20)}, ${size} B` };
    }
    if (buffer.subarray(0, 4).toString('ascii') === 'OggS') {
      return { purpose: 'OGG/Opus-Audio', status: `geprueft: OGG, ${size} B` };
    }
    return { purpose: 'Binaerdatei', status: `geprueft: Signatur, ${size} B` };
  }
  const text = buffer.toString('utf8');
  const lines = text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
  return {
    purpose: purposeOf(file, text),
    status: GENERATED.has(file) ? `generiert, ${lines} Zeilen` : `gelesen: ${lines} Zeilen`,
    risky: !file.endsWith('.md') && RISKY.test(text),
  };
}

const rows = [];
const risky = [];
for (const file of tracked) {
  const info = describe(file);
  rows.push(`- \`${file}\` — ${info.purpose} — ${info.status}`);
  if (info.risky) risky.push(file);
}

const areas = new Map();
for (const file of tracked) {
  const area = file.includes('/') ? file.slice(0, file.indexOf('/')) : '(Wurzel)';
  areas.set(area, (areas.get(area) ?? 0) + 1);
}

const findings = risky.length
  ? risky.map((file) => `- \`${file}\`: Marker fuer offene Arbeit gefunden (${plan('struktur offene arbeit').level}).`)
  : ['- Keine Marker fuer offene Arbeit in getrackten Textdateien.'];

const block = [
  START,
  '',
  '### 18.1 Abdeckung',
  '',
  '| Feld | Wert |',
  '| --- | --- |',
  `| Getrackte Dateien | ${tracked.length} |`,
  `| Gelistete Dateien | ${rows.length} |`,
  `| Getrackte Ordner | ${dirs.length} |`,
  `| Bereiche | ${[...areas.entries()].map(([area, count]) => `${area} (${count})`).join(', ')} |`,
  '',
  'Regel: jede Zeile entspricht genau einem Pfad aus `git ls-files`; es gibt keine Sammelzeile und keine Ausnahme. `verify:docs` vergleicht den Block mit `git ls-files` und wird rot, sobald eine Datei fehlt oder ein Pfad nicht mehr getrackt ist.',
  '',
  '### 18.2 Ordner',
  '',
  ...dirs.map((dir) => `- \`${dir}/\` — ${tracked.filter((file) => dirname(file) === dir).length} Datei(en)`),
  '',
  '### 18.3 Dateien',
  '',
  ...rows,
  '',
  '### 18.4 Mechanische Auffaelligkeiten',
  '',
  ...findings,
  '',
  END,
].join('\n');

const inventoryPath = join(ROOT, 'docs', 'INVENTORY.md');
const inventory = readFileSync(inventoryPath, 'utf8');
const start = inventory.indexOf(START);
const end = inventory.indexOf(END);
const anchor = inventory.indexOf('## Fortsetzungs-Log');
const section = `## 18. Vollstaendige Dateiliste (maschinell erzeugt)\n\nDer Block ist deterministisch: eine Zeile je Pfad aus \`git ls-files\`, ein Eintrag je Ordner. Der Generator liest Textdateien und prueft Binaersignaturen; \`verify:docs\` vergleicht den Block mit dem Index.\n\n${block}\n\n`;
const next = start >= 0 && end > start
  ? `${inventory.slice(0, start)}${block}${inventory.slice(end + END.length)}`
  : anchor >= 0
    ? `${inventory.slice(0, anchor)}${section}${inventory.slice(anchor)}`
    : `${inventory.trimEnd()}\n\n${section}`;
writeFileSync(inventoryPath, next);
console.log(`inventory:build: ${rows.length}/${tracked.length} Dateien, ${dirs.length} Ordner, ${risky.length} Auffaelligkeit(en)`);
