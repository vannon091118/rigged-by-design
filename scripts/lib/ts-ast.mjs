/**
 * Gemeinsame TypeScript-AST-Basis der Governance-Gates.
 *
 * Drei Aufgaben, mehr nicht: die tsconfig-Optionen laden, Quelldateien als
 * Syntaxbaum halten und Modul-Specifier gegen den echten Modulgraphen
 * aufloesen. Die Gates selbst bleiben die einzige Stelle, die entscheidet,
 * was ein Verstoss ist – hier entstehen keine Meldungen und kein Zurueckschreiben.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import ts from 'typescript';
import { ROOT } from './report.mjs';

export { ts };

let configCache;
/** tsconfig.json als echte Compiler-Optionen; alle Aufloesungen laufen darueber. */
export function compilerConfig() {
  if (configCache) return configCache;
  // Werkzeug-Configs liegen gesammelt in src/Config.
  const configPath = ts.findConfigFile(resolve(ROOT, 'src', 'Config'), ts.sys.fileExists, 'tsconfig.json');
  if (!configPath) throw new Error('src/Config/tsconfig.json nicht gefunden');
  const read = ts.readConfigFile(configPath, ts.sys.readFile);
  if (read.error) throw new Error(ts.flattenDiagnosticMessageText(read.error.messageText, ' '));
  const parsed = ts.parseJsonConfigFileContent(read.config, ts.sys, dirname(configPath));
  configCache = { fileNames: parsed.fileNames, options: parsed.options };
  return configCache;
}

const parseCache = new Map();
/** Quelldatei als Syntaxbaum, geparst mit der Syntax ihres Endungs. */
export function parse(file) {
  const cached = parseCache.get(file);
  if (cached) return cached;
  const kind = /\.tsx$/.test(file) ? ts.ScriptKind.TSX
    : /\.(m|c)?jsx?$/.test(file) ? ts.ScriptKind.JSX
    : ts.ScriptKind.TS;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.ES2022, true, kind);
  parseCache.set(file, source);
  return source;
}

/** Jeden Knoten der Datei genau einmal besuchen. */
export function forEachNode(source, visitor) {
  const walk = (node) => {
    visitor(node);
    ts.forEachChild(node, walk);
  };
  ts.forEachChild(source, walk);
}

/** 1-based Zeile einer Position im Quelltext. */
export function lineOf(source, pos) {
  return source.getLineAndCharacterOfPosition(pos).line + 1;
}

/** Alle Modul-Specifier: Import, Re-Export, dynamischer Import und require(). */
export function moduleSpecifiers(source) {
  const found = [];
  const take = (specifier) => {
    if (specifier && ts.isStringLiteralLike(specifier)) found.push(specifier.text);
  };
  forEachNode(source, (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) take(node.moduleSpecifier);
    else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) take(node.arguments[0]);
      else if (ts.isIdentifier(node.expression) && node.expression.text === 'require') take(node.arguments[0]);
    }
  });
  return found;
}

const resolutionCache = new Map();
/** Relativen Specifier ueber den Modulgraphen aufloesen; externe Pakete bleiben null. */
export function resolveSpecifier(specifier, fromFile) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  const key = `${fromFile}::${specifier}`;
  if (resolutionCache.has(key)) return resolutionCache.get(key);
  const { options } = compilerConfig();
  const hit = ts.resolveModuleName(specifier, fromFile, options, ts.sys).resolvedModule;
  const base = resolve(dirname(fromFile), specifier);
  // Die Endungsliste deckt auch die Gate-Skripte ab: Tests importieren .mjs
  // direkt, und ohne allowJs loest ts.resolveModuleName diese Kante nicht auf.
  const file = hit?.resolvedFileName
    ?? [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, `${base}.js`, join(base, 'index.ts')].find(existsSync)
    ?? null;
  const normalized = file === null ? null : file.replaceAll('\\', '/');
  resolutionCache.set(key, normalized);
  return normalized;
}
