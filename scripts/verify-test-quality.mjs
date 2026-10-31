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
import { forEachNode, lineOf, parse, ts } from './lib/ts-ast.mjs';

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
  forEachNode(source, (node) => {
    if (ts.isCallExpression(node)) {
      if (isExpectCall(node)) {
        asserted = true;
        if (node.arguments[0]?.kind === ts.SyntaxKind.TypeOfExpression) found.typeOf = true;
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
