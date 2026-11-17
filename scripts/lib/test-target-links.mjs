/**
 * Zielverknuepfung von Tests: welche Dateien ein Test wirklich beruehrt.
 *
 * Statische und dynamische Importe, Subprozess-Aufrufe, Dateisystem-Zugriffe
 * und Verzeichnis-Scans werden zu einer Referenzmenge je Testdatei. Helfer-
 * module zaehlen mit, weil ein Test sein Ziel oft ueber einen Adapter prueft.
 *
 * Dieses Modul sammelt nur Belege. Ob die Menge den Testkopf deckt, entscheidet
 * `verify-test-quality.mjs`; die Trennung haelt beide Dateien unter ihrem
 * LOC-Budget und laesst andere Gates dieselben Referenzen nutzen.
 */
import { dirname, resolve } from 'node:path';
import { ROOT } from './report.mjs';
import { forEachNode, moduleSpecifiers, parse, resolveSpecifier, ts } from './ts-ast.mjs';

const PATH_CALLS = Object.freeze(new Set(['join', 'resolve', 'pathToFileURL']));
const PROCESS_CALLS = Object.freeze(
  new Set(['spawn', 'spawnSync', 'exec', 'execFile', 'execFileSync', 'execSync']),
);
const FS_CALLS = Object.freeze(
  new Set([
    'readFileSync', 'readFile', 'readdirSync', 'readdir', 'existsSync', 'statSync',
    'lstatSync', 'copyFileSync', 'copyFile', 'unlinkSync', 'unlink', 'watchFile',
  ]),
);
const referenceCache = new Map();
const inProgress = new Set();

export function normalizePath(file) {
  return file.replaceAll('\\', '/');
}

function callName(node) {
  if (ts.isIdentifier(node.expression)) return node.expression.text;
  if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text;
  return null;
}

function stringArgs(node) {
  return node.arguments.filter((arg) => ts.isStringLiteralLike(arg)).map((arg) => arg.text);
}

function resolvePathLiteral(specifier, fromFile) {
  const resolved = resolveSpecifier(specifier, fromFile);
  if (resolved) return resolved;
  return normalizePath(resolve(dirname(fromFile), specifier));
}

function scanPathCall(node, fromFile) {
  const args = node.arguments;
  const segments = [];
  let useRoot = false;
  for (const arg of args) {
    if (ts.isStringLiteralLike(arg)) segments.push(arg.text);
    else if (ts.isIdentifier(arg) && arg.text === 'ROOT') useRoot = true;
  }
  if (segments.length === 0) return null;
  for (const arg of args) {
    if (
      ts.isCallExpression(arg) &&
      ts.isPropertyAccessExpression(arg.expression) &&
      ts.isIdentifier(arg.expression.expression) &&
      arg.expression.expression.text === 'process' &&
      arg.expression.name.text === 'cwd'
    ) {
      useRoot = true;
      break;
    }
  }
  return normalizePath(resolve(useRoot ? ROOT : dirname(fromFile), ...segments));
}

/**
 * Alle Dateien, auf die eine Testdatei verweist: statische Importe,
 * Subprozess-Ziele, dynamische Importe und Dateisystem-Lesungen/Scans.
 */
export function collectReferencedFiles(file) {
  if (referenceCache.has(file)) return referenceCache.get(file);
  if (inProgress.has(file)) return { references: new Set(), scannedDirs: new Set() };
  inProgress.add(file);
  const references = new Set();
  const scannedDirs = new Set();
  const source = parse(file);
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node)) return;
    const name = callName(node);
    if (!name) return;
    if (PATH_CALLS.has(name)) {
      const hit = scanPathCall(node, file);
      if (hit) references.add(hit);
    }
    if (PROCESS_CALLS.has(name)) {
      for (const arg of stringArgs(node)) references.add(resolvePathLiteral(arg, file));
    }
    if (FS_CALLS.has(name) && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
      references.add(resolvePathLiteral(node.arguments[0].text, file));
    }
    if ((name === 'readdirSync' || name === 'readdir') && node.arguments[0]) {
      const first = node.arguments[0];
      let dir = null;
      if (ts.isStringLiteralLike(first)) dir = resolvePathLiteral(first.text, file);
      else if (ts.isCallExpression(first) && PATH_CALLS.has(callName(first))) dir = scanPathCall(first, file);
      if (dir) scannedDirs.add(dir);
    }
  });
  for (const specifier of moduleSpecifiers(source)) {
    const resolved = resolveSpecifier(specifier, file);
    if (resolved) references.add(resolved);
  }
  inProgress.delete(file);
  const result = { references, scannedDirs };
  referenceCache.set(file, result);
  return result;
}

/** Testdateien, die das Ziel ueber ein importiertes Helfermodul erreichen. */
export function targetViaHelper(file, normalizedTarget) {
  const found = new Set();
  for (const specifier of moduleSpecifiers(parse(file))) {
    const helper = resolveSpecifier(specifier, file);
    if (!helper) continue;
    const refs = collectReferencedFiles(helper);
    if (refs.references.has(normalizedTarget)) found.add(helper);
  }
  return found;
}

/**
 * Prozessziel: Die Datei wird als echter Kindprozess gestartet. Der Zielpfad
 * muss als Literal im Test stehen; ein Import wuerde eine CLI schon beim Laden
 * ausfuehren und beweist nichts.
 */
export function processTargetSpawned(file, target) {
  const base = target.split('/').pop() ?? '';
  if (!base) return false;
  const literals = new Set();
  let spawnCall = false;
  forEachNode(parse(file), (node) => {
    if (ts.isStringLiteralLike(node)) literals.add(node.text);
    if (!ts.isCallExpression(node)) return;
    if (PROCESS_CALLS.has(callName(node))) spawnCall = true;
  });
  return spawnCall && [...literals].some((text) => text === target || text === base || text.endsWith(`/${base}`));
}
