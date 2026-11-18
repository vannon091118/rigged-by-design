/**
 * Fuenf Redundanz-Kennzahlen als dauerhafte Budgets.
 *
 * Der globale Scan hat gezeigt, wo Redundanz waechst, ohne dass ein Gate sie
 * sieht: vergessene Module (Waisen), Module mit nur einem Aufrufer (Fan-in),
 * eine wachsende Zahl von Einstiegspunkten, Alias-Namen in `package.json` und
 * immer mehr Doku-Bytes. Diese Datei misst genau diese fuenf Werte; das Gate
 * `verify:redundancy` vergleicht sie mit `REDUNDANCY_BUDGET`.
 *
 * Die Basis ist gemessen, nicht geschaetzt (`main` d55824b4, 2026-11-17):
 * 635 Module, 14 Waisen (2.2 %), 30.2 % der Module mit Fan-in <= 1,
 * 65 Einstiegspunkte, 1 Alias-Name, 1.577.352 Doku-Bytes in 31 Dateien.
 * Doku-Bytes nachgemessen am 2026-11-18 (`main` fe40db6b): 1.649.993 B in
 * 43 Dateien. Das alte Limit 1.650.000 B liess damit 7 Byte Luft, also
 * weniger als eine Inventarzeile; jedes Issue mit einer neuen Datei riss es.
 * Der dokumentierte Einstieg `src/main.tsx` und die Build-Configs unter
 * `src/Config/` sind keine Waisen: sie haben per Definition keinen Importeur.
 * Die Budgets liegen knapp darueber: sie stoppen Wachstum, ohne jede
 * Modulverschiebung rot zu machen. Ein bewusstes Anheben ist ein sichtbarer
 * Governance-Commit: Wert, Messgrundlage und Anlass stehen zusammen hier,
 * damit die Ratsche pruefbar bleibt statt still zu wachsen. Die Anhebung auf
 * 1.655.000 B (2026-11-18, Issue #998) ist genau das.
 *
 * Bewusst ohne TypeScript-Compiler: `imports.mjs` liest Specifier per Muster.
 * Das Gate laeuft damit auch im nackten Checkout.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { resolveSpecifier, specifiersOf } from './imports.mjs';
import { ROOT } from './report.mjs';

/** Obergrenzen; jede Zahl ist eine Ratsche gegen Wachstum, keine Zielgroesse. */
export const REDUNDANCY_BUDGET = Object.freeze({
  /** Anteil Module ohne jeden Importeur (Produktion, Tests, Skripte). */
  orphanRate: 3.0,
  /** Anteil Module, die von hoechstens einem Modul importiert werden. */
  fanInAtMostOneRate: 32.0,
  /** Dateien unter scripts/, die aus package.json oder einem Hook erreichbar sind. */
  entryPoints: 68,
  /** Zusaetzliche Namen auf ein bereits vorhandenes Kommando in package.json. */
  aliases: 1,
  /** Bytes in docs/**.md plus AGENTS.md und README.md. */
  docBytes: 1_655_000,
});

/** Dokumentierte Einstiege: ohne Importeur per Definition, nie eine Waise. */
const ENTRY_MODULES = Object.freeze(['src/main.tsx']);
const isEntryModule = (relativePath) => ENTRY_MODULES.includes(relativePath)
  || relativePath.startsWith('src/Config/');

const SOURCE = /\.(ts|tsx)$/;
const SCRIPT = /\.(mjs|js|cjs|ts)$/;
const TEST = /(^|\/)__tests__\/|\.test\.tsx?$/;
const norm = (file) => file.replaceAll('\\', '/');
const percent = (part, whole) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 10);

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function packageScripts(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts ?? {};
  } catch {
    return {};
  }
}

/** Erreichbare Skriptdateien: aus `package.json` und aus den Git-Hooks. */
function entryPointFiles(root) {
  const names = new Set();
  const addFrom = (text) => {
    for (const match of String(text).matchAll(/scripts\/([\w.-]+\.mjs)/g)) names.add(match[1]);
  };
  for (const command of Object.values(packageScripts(root))) addFrom(command);
  const hooks = join(root, '.githooks');
  if (existsSync(hooks)) {
    for (const name of readdirSync(hooks)) {
      try {
        addFrom(readFileSync(join(hooks, name), 'utf8'));
      } catch {
        // Verzeichniseintrag ohne Datei: kein Einstiegspunkt.
      }
    }
  }
  return [...names].sort();
}

/** Zusaetzliche Namen je Kommando: `verify` und `verify:quick` auf demselben Aufruf. */
function aliasCount(root) {
  const byCommand = new Map();
  for (const [name, command] of Object.entries(packageScripts(root))) {
    if (!byCommand.has(command)) byCommand.set(command, []);
    byCommand.get(command).push(name);
  }
  let aliases = 0;
  for (const names of byCommand.values()) if (names.length > 1) aliases += names.length - 1;
  return aliases;
}

function docBytes(root) {
  const files = [
    ...walk(join(root, 'docs')).filter((file) => file.endsWith('.md')),
    join(root, 'AGENTS.md'),
    join(root, 'README.md'),
  ].filter(existsSync);
  return {
    docFiles: files.length,
    docBytes: files.reduce((sum, file) => sum + statSync(file).size, 0),
  };
}

/**
 * Misst die fuenf Kennzahlen. Importeure zaehlen aus Produktion, Tests und
 * Skripten: ein nur von Tests gelesenes Modul ist nicht vergessen, aber es
 * haengt an genau einer Kante - das zeigt der Fan-in-Anteil.
 */
export function measureRedundancy({
  root = ROOT,
  readSpecifiers = specifiersOf,
  resolveFrom = resolveSpecifier,
} = {}) {
  const sources = walk(join(root, 'src')).filter((file) => SOURCE.test(file) && !file.endsWith('.d.ts'));
  const modules = sources.filter((file) => !TEST.test(norm(relative(root, file))));
  const importers = new Map(modules.map((file) => [file, new Set()]));
  const readers = [...sources, ...walk(join(root, 'scripts')).filter((file) => SCRIPT.test(file))];

  for (const file of readers) {
    for (const specifier of readSpecifiers(file)) {
      const target = resolveFrom(specifier, file);
      if (target && importers.has(target)) importers.get(target).add(file);
    }
  }

  const orphans = modules
    .filter((file) => !isEntryModule(norm(relative(root, file))))
    .filter((file) => importers.get(file).size === 0);
  const single = modules
    .filter((file) => !isEntryModule(norm(relative(root, file))))
    .filter((file) => importers.get(file).size <= 1);
  const entries = entryPointFiles(root);
  const docs = docBytes(root);

  return {
    modules: modules.length,
    orphans: orphans.length,
    orphanRate: percent(orphans.length, modules.length),
    fanInAtMostOne: single.length,
    fanInAtMostOneRate: percent(single.length, modules.length),
    entryPoints: entries.length,
    entryPointFiles: entries,
    aliases: aliasCount(root),
    docFiles: docs.docFiles,
    docBytes: docs.docBytes,
  };
}

/**
 * Vergleich gegen die Budgets. Rueckgabe ist stabil sortiert und leer, wenn
 * alles im Rahmen liegt; jede Verletzung nennt Kennzahl, Ist und Limit.
 */
export function redundancyFindings(metrics, budget = REDUNDANCY_BUDGET) {
  const findings = [];
  const add = (metric, value, limit, hint) => findings.push({ metric, value, limit, hint });

  if (metrics.orphanRate > budget.orphanRate) {
    add('Waisenquote', `${metrics.orphanRate} % (${metrics.orphans}/${metrics.modules})`, `${budget.orphanRate} %`,
      'Waisen einbinden oder entfernen; kein Modul ohne Aufrufer.');
  }
  if (metrics.fanInAtMostOneRate > budget.fanInAtMostOneRate) {
    add('Anteil Fan-in <= 1', `${metrics.fanInAtMostOneRate} % (${metrics.fanInAtMostOne}/${metrics.modules})`,
      `${budget.fanInAtMostOneRate} %`, 'Einzelkanten buendeln oder tote Module entfernen.');
  }
  if (metrics.entryPoints > budget.entryPoints) {
    add('Entry-Point-Zahl', String(metrics.entryPoints), String(budget.entryPoints),
      'Neue Einstiegspunkte brauchen einen bestehenden Befehl statt eines neuen Skripts.');
  }
  if (metrics.aliases > budget.aliases) {
    add('Alias-Zahl', String(metrics.aliases), String(budget.aliases),
      'Aliase zeigen auf denselben Aufruf: einen Namen streichen.');
  }
  if (metrics.docBytes > budget.docBytes) {
    add('Doku-Bytes', `${metrics.docBytes} B (${metrics.docFiles} Dateien)`, `${budget.docBytes} B`,
      'Doku kuerzen oder ein Budget sichtbar anheben.');
  }
  return findings;
}
