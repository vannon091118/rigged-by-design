#!/usr/bin/env node
/**
 * Fail-Closed-Testvertrag: Header, echte Assertions, Determinismus und keine
 * Dummy-Werte in UI/Render. Jeder Verstoss bekommt eine IDX und einen ERR-Code.
 */
import { existsSync, readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { catalogCodes, fail, ROOT, walk } from './lib/report.mjs';

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
  const text = readFileSync(file, 'utf8');
  const header = text.slice(0, 800);
  const target = /@test-target:\s*([^\s|*]+)/.exec(header)?.[1];
  const code = /@error-code:\s*(ERR-\d{4})/.exec(header)?.[1];
  if (!target) report('ERR-4001', name, '@test-target fehlt');
  else if (!existsSync(resolve(ROOT, target))) report('ERR-4001', name, `Ziel existiert nicht: ${target}`);
  if (!code) report('ERR-4001', name, '@error-code fehlt');
  else if (!codes.has(code)) report('ERR-4001', name, `Code nicht im Katalog: ${code}`);
  if (!/\bexpect\s*\(/.test(text)) report('ERR-4002', name, 'keine Assertion vorhanden');
  // Jeder Lauf muss mit einem neuen, nicht vorab waehlbaren Seed starten.
  if (/\bnew\s+Prng\s*\(\s*(?:0x[0-9a-f]+|\d[\d_]*)\s*\)/i.test(text)) {
    report('ERR-4002', name, 'fester Seed im Test; randomSeed() verwenden');
  }
  const forbidden = [
    [/toMatch(In)?Snapshot/, 'Snapshot-Test'],
    [/\.toBeDefined\s*\(/, 'nur Existenz (toBeDefined)'],
    [/\.toBeTruthy\s*\(/, 'nur Wahrheitswert (toBeTruthy)'],
    [/expect\s*\(\s*typeof/, 'nur Typ-Existenz'],
    [/expect\s*\(\s*true\s*\)\s*\.toBe\s*\(\s*true\s*\)/, 'Tautologie'],
  ];
  for (const [pattern, label] of forbidden) {
    if (pattern.test(text)) report('ERR-4002', name, label);
  }
}

const deterministicRoots = [resolve(SRC, 'core'), resolve(SRC, 'store')];
for (const file of walk(resolve(SRC, 'core'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
for (const file of walk(resolve(SRC, 'store'), (entry) => entry.endsWith('.ts'))) checkDeterminism(file);
function checkDeterminism(file) {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((text, lineIndex) => {
    if (text.includes('@seed-initializer')) return;
    const match = /Math\.random|Date\.now|performance\.now|crypto\.getRandomValues/.exec(text);
    if (match) report('ERR-1001', relative(ROOT, file), `Nicht-deterministisch: ${match[0]} in Zeile ${lineIndex + 1}`);
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
