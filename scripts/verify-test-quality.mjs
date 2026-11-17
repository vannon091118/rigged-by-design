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
 * (Direkt-Lesung oder Scan eines Baumes, der das Ziel enthaelt). Der Modus
 * `@test-target-mode: process` verlangt zusaetzlich einen belegten Start.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { catalogCodes, fail, ROOT, walk } from './lib/report.mjs';
import { forEachNode, lineOf, parse, ts } from './lib/ts-ast.mjs';
import { captureConsole } from './lib/compact.mjs';
import { collectReferencedFiles, normalizePath, processTargetSpawned, targetViaHelper } from './lib/test-target-links.mjs';
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

/** Header eines Tests: die fuehrenden Kommentare als Text. */
function headerOf(source) {
  const comments = ts.getLeadingCommentRanges(source.getFullText(), 0) ?? [];
  return comments.map((range) => source.getFullText().slice(range.pos, range.end)).join('\n');
}

/** Gefundene Assertion-Formen eines Testfalls. */
function assertionsOf(source, isExpectCall) {
  const found = { seed: false, snapshot: false, defined: false, truthy: false, typeOf: false, tautology: false };
  const isTrueLiteral = (node) => node && node.kind === ts.SyntaxKind.TrueKeyword;
  forEachNode(source, (node) => {
    if (ts.isCallExpression(node)) {
      if (isExpectCall(node) && node.arguments[0]?.kind === ts.SyntaxKind.TypeOfExpression) found.typeOf = true;
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
  return found;
}

/** Testfall-Callbacks: `it(...)`, `test(...)`, `it.each(...)(...)`. */
function testBlocksOf(source, isExpectCall) {
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
  const blocks = [];
  let asserted = false;
  forEachNode(source, (node) => {
    if (!ts.isCallExpression(node)) return;
    if (isExpectCall(node)) asserted = true;
    const callback = isTestCallback(node);
    if (!callback) return;
    const title = ts.isStringLiteralLike(node.arguments[0]) ? node.arguments[0].text : '<each>';
    blocks.push({ node, callback, title });
  });
  return { blocks, asserted };
}

function run() {
  const files = walk(SRC, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts'));
  const tests = files.filter((file) => /\.test\.tsx?$/.test(file));
  const isExpectCall = (node) => ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'expect';

  for (const file of tests) {
    const name = relative(ROOT, file);
    const source = parse(file);
    const header = headerOf(source);
    const target = /@test-target:\s*([^\s|*]+)/.exec(header)?.[1];
    // Der Modus steht im Testkopf: `process` fuer echte Kindprozess-Aufrufe,
    // ohne Angabe gilt der Import-/Dateibezug.
    const targetMode = /@test-target-mode:\s*(\S+)/.exec(header)?.[1] ?? 'import';
    const code = /@error-code:\s*(ERR-\d{4})/.exec(header)?.[1];
    if (!['import', 'process'].includes(targetMode)) {
      report('ERR-4001', name, `unbekannter @test-target-mode: ${targetMode}`);
    }
    if (!target) report('ERR-4001', name, '@test-target fehlt');
    else if (!existsSync(resolve(ROOT, target))) report('ERR-4001', name, `Ziel existiert nicht: ${target}`);
    if (!code) report('ERR-4001', name, '@error-code fehlt');
    else if (!codes.has(code)) report('ERR-4001', name, `Code nicht im Katalog: ${code}`);

    const found = assertionsOf(source, isExpectCall);
    const { blocks, asserted } = testBlocksOf(source, isExpectCall);
    if (!asserted) report('ERR-4002', name, 'keine Assertion vorhanden');

    const targetFile = target ? resolve(ROOT, target) : null;
    const normalizedTarget = targetFile === null ? null : normalizePath(targetFile);
    const targetIsCode = Boolean(target && /\.(ts|tsx|js|mjs|cjs)$/.test(target));

    /** Bezug zum Ziel: statischer Import (direkt oder ueber ein Helfermodul),
     * Subprozess-Aufruf des Ziels, dynamischer Import oder Dateisystem-Zugriff. */
    const referenced = collectReferencedFiles(file);
    const targetLinked =
      !targetIsCode ||
      (targetMode === 'process'
        ? processTargetSpawned(file, target)
        : Boolean(
            normalizedTarget &&
              (referenced.references.has(normalizedTarget) ||
                [...referenced.scannedDirs].some((dir) => normalizedTarget.startsWith(normalizePath(dir) + '/')) ||
                targetViaHelper(file, normalizedTarget).size > 0)
          ));
    for (const block of blocks) {
      let hasExpect = false;
      forEachNode(block.callback, (node) => { if (isExpectCall(node)) hasExpect = true; });
      if (!hasExpect) report('ERR-4002', name, `Testfall ohne Assertion: ${block.title}`);
    }
    if (targetIsCode && !targetLinked) {
      report(
        'ERR-4002',
        name,
        targetMode === 'process'
          ? `Prozessziel nicht belegt gestartet: ${target}`
          : `kein Bezug zum Ziel ${target} (statischer Import, Subprozess, dynamischer Import oder Datei-Scan)`,
      );
    }
    // Schwache Assertions bleiben ein Befund: Existenz, Wahrheitswert oder ein
    // Snapshot beweisen kein Verhalten.
    const weak = [
      [found.seed, 'fester Seed im Test; randomSeed() verwenden'],
      [found.snapshot, 'Snapshot-Test'],
      [found.defined, 'nur Existenz (toBeDefined)'],
      [found.truthy, 'nur Wahrheitswert (toBeTruthy)'],
      [found.typeOf, 'nur Typ-Existenz'],
      [found.tautology, 'Tautologie'],
    ];
    for (const [hit, label] of weak) if (hit) report('ERR-4002', name, label);
  }

  const deterministicRoots = [resolve(SRC, 'core'), resolve(SRC, 'store')];
  const RISKY = ['Math.random', 'Date.now', 'performance.now', 'crypto.getRandomValues'];
  for (const root of deterministicRoots) {
    for (const file of walk(root, (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
  }
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
