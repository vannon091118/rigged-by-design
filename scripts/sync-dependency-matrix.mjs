#!/usr/bin/env node
/**
 * ERR-0911: erzeugt die Live-Dependency-Matrix in docs/ARCHITECTURE.md aus
 * package.json und echten Imports. Keine Begruendung = Fail-Closed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fail, ROOT, walk } from './lib/report.mjs';
import { moduleSpecifiers, parse } from './lib/ts-ast.mjs';

const JUSTIFICATIONS = {
  'pixi.js': ['Runtime', 'WebGL/Canvas-Renderer fuer Floor, Figuren, Sticker und Spiele; kein DOM-Rendering im Spielfeld.'],
  react: ['UI', 'Deklarative HUD-, Popup- und Panel-Oberflaeche mit einem Store-Snapshot.'],
  'react-dom': ['UI', 'Mountet die React-Oberflaeche in den Browser.'],
  vite: ['Build', 'Dev-Server und Production-Bundler; liefert die Modul- und CSS-Pipeline.'],
  vitest: ['Test', 'Deterministische Unit- und Monte-Carlo-Beweise fuer Ledger, Spiele und Simulation.'],
  typescript: ['Build', 'Strikte Typpruefung mit noUncheckedIndexedAccess und ungenutzten Symbolen.'],
  '@vitejs/plugin-react': ['Build', 'React-19-JSX-Transform und Fast Refresh fuer Vite.'],
  '@types/react': ['Typen', 'Typpaket fuer die React-19-API; wird implizit von React-Imports genutzt.'],
  '@types/react-dom': ['Typen', 'Typpaket fuer React-DOM; wird implizit von react-dom-Imports genutzt.'],
  '@types/node': ['Typen', 'Typen fuer Node-Builtins in Gate-Skripten und Vitest-Reporter.'],
  eslint: ['Lint', 'Fail-Closed-Lint-Gate mit TypeScript-Parser und ungenutzten Symbolen.'],
  '@eslint/js': ['Lint', 'Empfohlene ESLint-Basisregeln.'],
  'typescript-eslint': ['Lint', 'TypeScript-Parser und Regeln fuer das Lint-Gate.'],
  globals: ['Lint', 'Browser- und Node-Globals fuer die ESLint-Konfiguration.'],
  jsdom: ['Test', 'DOM-Umgebung fuer UI-, Fokus- und Tastaturtests ohne echten Browser.'],
  '@testing-library/react': ['Test', 'Rendert HUD und Popups fuer Integrations- und Fokustests in jsdom.'],
  '@capacitor/core': ['Android', 'WebView-Bridge der Android-Huelle; von cap sync an die native Seite uebergeben.'],
  '@capacitor/cli': ['Android', 'Capacitor-CLI: erzeugt das Android-Projekt und synchronisiert Web-Build und Huelle.'],
  '@capacitor/android': ['Android', 'Native Android-Plattform, aus der Gradle Debug- und Release-APK baut.'],
};

const CATEGORY = (pkg) => JUSTIFICATIONS[pkg]?.[0] ?? 'Unbekannt';
const reason = (pkg) => JUSTIFICATIONS[pkg]?.[1] ?? '';
const pkgRoot = (specifier) => {
  if (specifier.startsWith('@')) return specifier.split('/').slice(0, 2).join('/');
  return specifier.split('/')[0];
};

const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const packages = {
  ...(packageJson.dependencies ?? {}),
  ...(packageJson.devDependencies ?? {}),
};
const candidates = walk(resolve(ROOT, 'src'), (file) => /\.(ts|tsx)$/.test(file));
const scriptRoot = resolve(ROOT, 'scripts');
if (existsSync(scriptRoot)) candidates.push(...walk(scriptRoot, (file) => /\.(mjs|js)$/.test(file)));
for (const file of ['vite.config.ts', 'eslint.config.mjs']) {
  const full = resolve(ROOT, file);
  if (existsSync(full)) candidates.push(full);
}
const configs = ['package.json', 'tsconfig.json'].map((file) => resolve(ROOT, file)).filter(existsSync);

const usage = new Map(Object.keys(packages).map((pkg) => [pkg, new Set()]));
// Paketimporte kommen aus dem Modulgraphen; Konfigurationen nur aus ihren eigenen Regeln.
for (const file of [...candidates, ...configs]) {
  const text = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file).replaceAll('\\', '/');
  const specifiers = candidates.includes(file) ? moduleSpecifiers(parse(file)) : [];
  for (const specifier of specifiers) {
    const root = pkgRoot(specifier);
    if (usage.has(root)) usage.get(root).add(rel);
  }
  if (specifiers.some((specifier) => specifier === 'react' || specifier === 'react/jsx-runtime') && usage.has('@types/react')) usage.get('@types/react').add(rel);
  if (specifiers.some((specifier) => specifier === 'react-dom' || specifier.startsWith('react-dom/')) && usage.has('@types/react-dom')) usage.get('@types/react-dom').add(rel);
  if (specifiers.some((specifier) => specifier.startsWith('node:')) && usage.has('@types/node')) usage.get('@types/node').add(rel);
  // jsdom wird nicht importiert, sondern als Umgebung gesetzt (Docblock, Config).
  if (/jsdom/.test(text) && usage.has('jsdom')) usage.get('jsdom').add(rel);
}
const cli = (pkg) => {
  const scripts = JSON.stringify(packageJson.scripts ?? {});
  if (usage.has(pkg) && scripts.includes(pkg)) usage.get(pkg).add('package.json');
};
for (const pkg of Object.keys(packages)) cli(pkg);
// Werkzeugpakete ohne Import: ihr Name steht im Build-Skript, das sie aufruft.
// Die Matrix selbst rechtfertigt sich nicht – sie traegt nur die Begruendung.
const buildScripts = new Map(candidates
  .filter((file) => file.includes('/scripts/') && !file.endsWith('sync-dependency-matrix.mjs'))
  .map((file) => [file, readFileSync(file, 'utf8')]));
for (const pkg of Object.keys(packages)) {
  if ((usage.get(pkg)?.size ?? 0) > 0) continue;
  const hit = [...buildScripts].find(([, text]) => text.includes(pkg));
  if (hit) usage.get(pkg).add(relative(ROOT, hit[0]).replaceAll('\\', '/'));
}
if (usage.has('typescript') && existsSync(resolve(ROOT, 'tsconfig.json'))) usage.get('typescript').add('tsconfig.json');

let broken = 0;
for (const [pkg, version] of Object.entries(packages)) {
  if (!JUSTIFICATIONS[pkg]) {
    broken += 1;
    fail(broken, 'ERR-4007', 'sync-deps', `${pkg}@${version} hat keine Architektur-Begruendung`);
  }
  if ((usage.get(pkg)?.size ?? 0) === 0) {
    broken += 1;
    fail(broken, 'ERR-4007', 'sync-deps', `${pkg}@${version} hat keine reale Nutzung`);
  }
}
if (broken > 0) process.exit(1);

const rows = Object.entries(packages)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([pkg, version]) => {
    const files = [...usage.get(pkg)].sort();
    const shown = files.slice(0, 6).map((file) => `\`${file}\``).join('<br>');
    const more = files.length > 6 ? `<br>… (+${files.length - 6})` : '';
    return `| ${pkg} | ${version} | ${CATEGORY(pkg)} | ${reason(pkg)} | ${files.length}: ${shown}${more} |`;
  });
const table = [
  '| Paket | Version | Kategorie | Architektur-Begründung | Real genutzte Dateien (Anzahl & Pfade) |',
  '| --- | --- | --- | --- | --- |',
  ...rows,
].join('\n');

const docPath = resolve(ROOT, 'docs', 'ARCHITECTURE.md');
if (!existsSync(docPath)) {
  fail(1, 'ERR-4013', 'sync-deps', 'docs/ARCHITECTURE.md fehlt');
  process.exit(1);
}
const doc = readFileSync(docPath, 'utf8');
const start = '<!-- DEP_MATRIX_START -->';
const end = '<!-- DEP_MATRIX_END -->';
const replacement = `${start}\n${table}\n${end}`;
const next = doc.includes(start) && doc.includes(end)
  ? doc.replace(new RegExp(`${start}[\\s\\S]*?${end}`), replacement)
  : `${doc.trimEnd()}\n\n## Live-Dependency-Matrix\n\n${replacement}\n`;
const checkOnly = process.argv.includes('--check');
if (next !== doc) {
  if (checkOnly) {
    fail(1, 'ERR-4013', 'sync-deps', 'Matrix ist veraltet; npm run sync:deps ausfuehren');
    process.exit(1);
  }
  writeFileSync(docPath, next);
  console.log('[IDX-0001] [ERR-0911-AUTOFIXED] sync-deps: Matrix aktualisiert');
} else {
  console.log('sync-deps: PASS, Matrix aktuell');
}
