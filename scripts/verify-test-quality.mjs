#!/usr/bin/env node
/**
 * Fail-Closed-Testvertrag ueber die TypeScript-AST: Header, echte Assertions,
 * Determinismus und keine Dummy-Werte in UI/Render. Geprueft werden Knoten,
 * keine Zeichensketten – ein Wort im Kommentar oder im String ist kein Test.
 * Jeder Verstoss bekommt eine IDX und einen ERR-Code.
 *
 * Zielverknuepfung: Ein Test ist mit seinem @test-target verknuepft, wenn er
 * das Ziel statisch importiert (direkt oder ueber ein Helfermodul), es als
 * Subprozess ausfuehrt, dynamisch importiert oder ueber das Dateisystem liest
 * (Direkt-Lesung oder Scan eines Baumes, der das Ziel enthaelt).
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve, dirname } from 'node:path';
import { catalogCodes, fail, ROOT, walk } from './lib/report.mjs';
import { forEachNode, lineOf, moduleSpecifiers, parse, resolveSpecifier, ts } from './lib/ts-ast.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-test-quality' });

const SRC = resolve(ROOT, 'src');
const codes = catalogCodes();
let index = 0;
let failures = 0;
const report = (code, component, message) => {
  index += 1;
  fail(index, code, component, message);
  failures += 1;
};

const PATH_CALLS = Object.freeze(new Set(['join', 'resolve', 'pathToFileURL']));
const PROCESS_CALLS = Object.freeze(new Set(['spawn', 'spawnSync', 'exec', 'execFile', 'execFileSync', 'execSync']));
const FS_CALLS = Object.freeze(new Set(['readFileSync', 'readFile', 'readdirSync', 'readdir', 'existsSync', 'statSync', 'lstatSync', 'copyFileSync', 'copyFile', 'unlinkSync', 'unlink', 'watchFile']));
const referenceCache = new Map();
const inProgress = new Set();

function normalizePath(file) {
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
function collectReferencedFiles(file) {
  if (referenceCache.has(file)) return referenceCache.get(file);
  if (inProgress.has(file)) return new Set();
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

function targetViaHelper(file, normalizedTarget) {
  const found = new Set();
  for (const specifier of moduleSpecifiers(parse(file))) {
    const helper = resolveSpecifier(specifier, file);
    if (!helper) continue;
    const refs = collectReferencedFiles(helper);
    if (refs.references.has(normalizedTarget)) found.add(helper);
  }
  return found;
}

function run() {
  const files = walk(SRC, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'));
  const tests = files.filter((file) => /\.test\.tsx?$/.test(file));
  for (const file of tests) {
    const name = relative(ROOT, file);
    const source = parse(file);
    const comments = ts.getLeadingCommentRanges(source.getFullText(), 0) ?? [];
    const header = comments.map((range) => source.getFullText().slice(range.pos, range.end)).join('\n');
    const target = /@test-target:\s*([^\s|*]+)/.exec(header)?.[1];
    const code = /@error-code:\s*(ERR-\d{4})/.exec(header)?.[1];
    if (!target) report('ERR-4001', name, '@test-target fehlt');
    else if (!existsSync(resolve(ROOT, target))) report('ERR-4001', name, `Ziel existiert nicht: ${target}`);
    if (!code) report('ERR-4001', name, '@error-code fehlt');
    else if (!codes.has(code)) report('ERR-4001', name, `Code nicht im Katalog: ${code}`);

    const found = { seed: false, snapshot: false, defined: false, truthy: false, typeOf: false, tautology: false };
    let asserted = false;
    const isExpectCall = (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'expect';
    const isTrueLiteral = (node) => node && node.kind === ts.SyntaxKind.TrueKeyword;
    const isTestCallback = (node) => {
      if (!ts.isCallExpression(node)) return null;
      const callback = node.arguments.at(-1);
      if (!callback || (!ts.isArrowFunction(callback) && !ts.isFunctionExpression(callback))) return null;
      const callee = node.expression;
      const base = ts.isCallExpression(callee) ? callee.expression : callee;
      if (ts.isIdentifier(base) && (base.text === 'it' || base.text === 'test')) return callback;
      // it.each(...)(...), it.skipIf(...)(...) und weitere Varianten: der letzte
      // Aufruf traegt den Test-Callback, der innere each-Aufruf nur die Daten.
      if (ts.isPropertyAccessExpression(base) && ts.isIdentifier(base.expression)
        && (base.expression.text === 'it' || base.expression.text === 'test')) return callback;
      return null;
    };
    const testBlocks = [];
    forEachNode(source, (node) => {
      if (ts.isCallExpression(node)) {
        if (isExpectCall(node)) {
          asserted = true;
          if (node.arguments[0]?.kind === ts.SyntaxKind.TypeOfExpression) found.typeOf = true;
        }
        const callback = isTestCallback(node);
        if (callback) {
          const title = ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : '<each>';
          testBlocks.push({ node, callback, title });
        }
        if (!ts.isPropertyAccessExpression(node.expression)) return;
        const matcher = node.expression.name.text;
        if (matcher === 'toMatchSnapshot' || matcher === 'toMatchInlineSnapshot') found.snapshot = true;
        else if (matcher === 'toBeDefined') found.defined = true;
        else if (matcher === 'toBeTruthy') found.truthy = true;
        else if (matcher === 'toBe' && isTrueLiteral(node.arguments[0])
          && ts.isCallExpression(node.expression.expression) && isExpectCall(node.expression.expression)
          && isTrueLiteral(node.expression.expression.arguments[0])) found.tautology = true;
      } else if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)
        && node.expression.text.toLowerCase() === 'prng'
        && node.arguments?.[0]?.kind === ts.SyntaxKind.NumericLiteral) {
        // Jeder Lauf muss mit einem neuen, nicht vorab waehlbaren Seed starten.
        found.seed = true;
      }
    });
    if (!asserted) report('ERR-4002', name, 'keine Assertion vorhanden');

    const targetFile = target ? resolve(ROOT, target) : null;
    const normalizedTarget = targetFile === null ? null : targetFile.replaceAll('\\', '/');
    const targetIsCode = Boolean(target && /\.(ts|tsx|js|mjs|cjs)$/.test(target));

    /** Bezug zum Ziel: statischer Import (direkt oder ueber ein Helfermodul),
     * Subprozess-Aufruf des Ziels, dynamischer Import oder Dateisystem-Zugriff. */
    const referenced = collectReferencedFiles(file);
    const targetLinked =
      !targetIsCode ||
      Boolean(
        normalizedTarget &&
          (referenced.references.has(normalizedTarget) ||
            [...referenced.scannedDirs].some((dir) => normalizedTarget.startsWith(normalizePath(dir) + '/')) ||
            targetViaHelper(file, normalizedTarget).size > 0)
      );
    for (const block of testBlocks) {
      let hasExpect = false;
      forEachNode(block.callback, (node) => { if (isExpectCall(node)) hasExpect = true; });
      if (!hasExpect) report('ERR-4002', name, `Testfall ohne Assertion: ${block.title}`);
    }
    if (targetIsCode && !targetLinked) report('ERR-4002', name, `kein Bezug zum Ziel ${target} (statischer Import, Subprozess, dynamischer Import oder Datei-Scan)`);
  }

  const deterministicRoots = [resolve(SRC, 'core'), resolve(SRC, 'store')];
  const RISKY = ['Math.random', 'Date.now', 'performance.now', 'crypto.getRandomValues'];
  for (const file of walk(resolve(SRC, 'core'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
  for (const file of walk(resolve(SRC, 'store'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
  function checkDeterminism(file) {
    const source = parse(file);
    const seen = new Set();
    forEachNode(source, (node) => {
      if (!ts.isPropertyAccessExpression(node)) return;
      const text = node.getText(source);
      if (!RISKY.some((risk) => text.endsWith(risk))) return;
      const line = lineOf(source, node.getStart(source));
      // Keine Kommentar-Ausnahme: eine Zufallsquelle bleibt eine Zufallsquelle.
      if (seen.has(line)) return;
      seen.add(line);
      report('ERR-1001', relative(ROOT, file), `Nicht-deterministisch: ${text} in Zeile ${line}`);
    });
  }

  for (const dir of [resolve(SRC, 'ui'), resolve(SRC, 'render')]) {
    for (const file of walk(dir, (entry) => /\.(ts|tsx)$/.test(entry))) {
      const text = readFileSync(file, 'utf8');
      const name = relative(ROOT, file);
      const dead = /TODO|DUMMY|PLACEHOLDER|coming soon|FIXME/i.exec(text);
      if (dead) report('ERR-3001', name, `toter Platzhalter: ${dead[0]}`);
      if (/width:\s*['"`]\d{1,3}%/.test(text)) report('ERR-3001', name, 'hartcodierter Prozentbalken');
    }
  }

  if (deterministicRoots.some((dir) => !existsSync(dir))) {
    report('ERR-4001', 'verify-test-quality', 'core/ oder store/ fehlt');
  }

  if (failures > 0) {
    console.error(`verify-test-quality: ${failures} Verstoss/Verstoesse`);
    process.exit(1);
  }
  console.log(`verify-test-quality: PASS (${tests.length} Testdateien, ${files.length} Dateien)`);
}

// Als CLI-Einstieg laufend pruefen; beim Import durch Tests laeuft der
// Pruflauf nicht mit, die exportierten Helfer stehen dennoch zur Verfuegung.
const SELF_NAME = 'verify-test-quality.mjs';
const IS_CLI_ENTRY = import.meta.main === true || String(process.argv[1] ?? '').endsWith(`/${SELF_NAME}`);
if (IS_CLI_ENTRY) run();

export { collectReferencedFiles };
