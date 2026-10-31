#!/usr/bin/env node
/**
 * Fail-Closed-Testvertrag ueber die TypeScript-AST: Header, echte Assertions,
 * Determinismus und keine Dummy-Werte in UI/Render. Geprueft werden Knoten,
 * keine Zeichensketten – ein Wort im Kommentar oder im String ist kein Test.
 * Jeder Verstoss bekommt eine IDX und einen ERR-Code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { catalogCodes, fail, ROOT, walk } from './lib/report.mjs';
import { forEachNode, lineOf, moduleSpecifiers, parse, resolveSpecifier, ts } from './lib/ts-ast.mjs';

const SRC = resolve(ROOT, 'src');
const codes = catalogCodes();
let index = 0;
let failures = 0;
const report = (code, component, message) => {
  index += 1;
  fail(index, code, component, message);
  failures += 1;
};

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

  // Zielbezug: direkte Importe aus dem Ziel oder aus einem Helfermodul, das das
  // Ziel importiert. Der Bezug wird pro Testfall geprueft, nicht nur irgendwo
  // in der Datei; ein zufaelliges expect() ohne Zielnaehe reicht nicht.
  const targetFile = target ? resolve(ROOT, target) : null;
  const targetIsCode = Boolean(target && /\.(ts|tsx|js|mjs|cjs)$/.test(target));
  const targetNames = new Set();
  if (targetFile && targetIsCode) {
    const normalizedTarget = targetFile.replaceAll('\\', '/');
    const rootPrefix = resolve(ROOT).replaceAll('\\', '/');
    forEachNode(source, (node) => {
      if (!ts.isImportDeclaration(node) || !node.importClause || node.importClause.isTypeOnly) return;
      const specifier = node.moduleSpecifier.text;
      const resolved = resolveSpecifier(specifier, file);
      const direct = resolved === normalizedTarget;
      let viaHelper = false;
      if (!direct && resolved && resolved.startsWith(rootPrefix) && !/\.test\.(ts|tsx)$/.test(resolved)) {
        const helper = parse(resolved);
        viaHelper = moduleSpecifiers(helper).some((spec) => resolveSpecifier(spec, resolved) === normalizedTarget);
      }
      if (!direct && !viaHelper) return;
      const clause = node.importClause;
      if (clause.name) targetNames.add(clause.name.text);
      const bindings = clause.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) targetNames.add(bindings.name.text);
      else if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          if (!element.isTypeOnly) targetNames.add((element.name ?? element.propertyName).text);
        }
      }
    });
  }
  let fileUsesTarget = false;
  const walkTargetUse = (node) => {
    if (ts.isImportDeclaration(node)) return;
    if (ts.isIdentifier(node) && targetNames.has(node.text)) fileUsesTarget = true;
    ts.forEachChild(node, walkTargetUse);
  };
  ts.forEachChild(source, walkTargetUse);
  const targetLinked = !targetIsCode || (targetNames.size > 0 && fileUsesTarget);
  for (const block of testBlocks) {
    let hasExpect = false;
    forEachNode(block.callback, (node) => { if (isExpectCall(node)) hasExpect = true; });
    if (!hasExpect) report('ERR-4002', name, `Testfall ohne Assertion: ${block.title}`);
  }
  if (targetIsCode && targetNames.size === 0) report('ERR-4002', name, `kein Import aus dem Ziel ${target}`);
  else if (!targetLinked) report('ERR-4002', name, 'kein Testfall mit Assertion und Bezug zum Ziel');

  const ordered = [
    [found.seed, 'fester Seed im Test; randomSeed() verwenden'],
    [found.snapshot, 'Snapshot-Test'],
    [found.defined, 'nur Existenz (toBeDefined)'],
    [found.truthy, 'nur Wahrheitswert (toBeTruthy)'],
    [found.typeOf, 'nur Typ-Existenz'],
    [found.tautology, 'Tautologie'],
  ];
  for (const [hit, label] of ordered) if (hit) report('ERR-4002', name, label);
}

const deterministicRoots = [resolve(SRC, 'core'), resolve(SRC, 'store')];
const RISKY = ['Math.random', 'Date.now', 'performance.now', 'crypto.getRandomValues'];
for (const file of walk(resolve(SRC, 'core'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
for (const file of walk(resolve(SRC, 'store'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
function checkDeterminism(file) {
  const source = parse(file);
  const lines = source.getFullText().split(/\r?\n/);
  const seen = new Set();
  forEachNode(source, (node) => {
    if (!ts.isPropertyAccessExpression(node)) return;
    const text = node.getText(source);
    if (!RISKY.some((risk) => text.endsWith(risk))) return;
    const line = lineOf(source, node.getStart(source));
    if (seen.has(line) || lines[line - 1]?.includes('@seed-initializer')) return;
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
