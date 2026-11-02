#!/usr/bin/env node
/**
 * Tree-Gate: jede Datei liegt in ihrem Ordner, jede Schicht importiert nur nach innen.
 *
 * Regeln stehen hier als Tabelle, damit ein neuer Ordner genau einen Eintrag
 * braucht. Geprueft wird der Arbeitsbaum, nicht die History.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, resolve, sep } from 'node:path';
import { fail, ROOT, walk } from './lib/report.mjs';
import { AREAS } from './lib/subsystems.mjs';

const ROOT_FILES = new Set([
  'package.json', 'pnpm-lock.yaml', 'index.html', 'README.md', 'AGENTS.md', 'LICENSE',
]);
const SRC_ROOT = new Set(['main.tsx', 'App.tsx', 'vite-env.d.ts']);

/** Ordnerregeln stehen in scripts/lib/subsystems.mjs; hier wird nur geprueft. */
const CORE_FORBIDDEN = [/^react$/, /^react-dom/, /^pixi\.js$/, /^@testing-library/];

const norm = (file) => file.split(sep).join('/');
const filesUnder = (dir) => (existsSync(join(ROOT, dir)) ? walk(join(ROOT, dir), () => true).map(norm) : []);

const violations = [];
const flag = (path, message) => violations.push({ path, message });

for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isFile() || entry.name.startsWith('.')) continue;
  if (ROOT_FILES.has(entry.name)) continue;
  if (/\.(md|ts|tsx|mjs|js|json|css)$/.test(entry.name)) {
    flag(entry.name, 'Datei gehoert nicht in die Wurzel (nur README.md und AGENTS.md).');
  }
}

for (const entry of readdirSync(join(ROOT, 'src'), { withFileTypes: true })) {
  if (entry.isFile() && !SRC_ROOT.has(entry.name)) flag(`src/${entry.name}`, 'src/ traegt nur main.tsx, App.tsx und vite-env.d.ts.');
}

for (const area of AREAS) {
  for (const file of filesUnder(area.dir)) {
    const ext = extname(file);
    if (!area.ext.includes(ext)) {
      flag(relative(ROOT, file), `${ext || 'ohne Endung'} ist hier nicht erlaubt: ${area.note}.`);
      continue;
    }
    if (area.dir === 'src/render' && ext === '.json' && !file.includes('/src/render/assets/')) {
      flag(relative(ROOT, file), 'JSON in render nur unter src/render/assets/.');
    }
  }
}

for (const file of filesUnder('src')) {
  const name = relative(ROOT, file);
  if (/\.test\.tsx?$/.test(file) && !file.includes('/__tests__/')) {
    flag(name, 'Testdatei liegt nicht in __tests__/.');
  }
}

for (const file of filesUnder('src/core')) {
  if (file.includes('/__tests__/')) continue;
  const text = readFileSync(file, 'utf8');
  for (const match of text.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    const specifier = match[1];
    if (CORE_FORBIDDEN.some((rule) => rule.test(specifier))) {
      flag(relative(ROOT, file), `Core importiert Browser-Abhaengigkeit "${specifier}".`);
      continue;
    }
    if (!specifier.startsWith('.')) continue;
    const target = resolve(file, '..', specifier);
    if (!norm(target).includes('/src/core/')) {
      flag(relative(ROOT, file), `Core importiert ausserhalb von src/core: "${specifier}".`);
    }
  }
}

for (const file of filesUnder('.github/workflows')) {
  if (!/\.ya?ml$/.test(file)) flag(relative(ROOT, file), 'Workflow ist keine YAML-Datei.');
}

/**
 * Wegwerf-Dateien sind kein Werkzeug: Analyse laeuft ueber `agent:context`,
 * Pruefung ueber `agent:verify`. Ein Ad-hoc-Skript im Baum macht das Gate rot,
 * damit es nicht zum Dauerzustand wird.
 */
const TEMP_NAME = /(^|[/\\])(tmp|temp|scratch|adhoc|oneoff|throwaway)[-_.]/i;
const TEMP_EXT = /\.(tmp|bak|orig|rej)$/i;
for (const dir of ['scripts', 'src', 'content', 'docs']) {
  for (const file of filesUnder(dir)) {
    const name = norm(relative(ROOT, file));
    if (TEMP_NAME.test(name) || TEMP_EXT.test(name)) {
      flag(name, 'Wegwerf-Datei: keine Ad-hoc-Skripte, nutze pnpm run agent:context bzw. pnpm run agent:verify.');
    }
  }
}

if (violations.length > 0) {
  violations.forEach((entry, index) => fail(index + 1, 'ERR-4019', entry.path, entry.message));
  console.error(`verify-tree: ${violations.length} Verstoss/Verstoesse`);
  process.exit(1);
}
console.log('verify-tree: PASS (Ordner, Endungen und Importrichtung)');
