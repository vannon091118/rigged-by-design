#!/usr/bin/env node
/**
 * Fail-Closed Dead-Artifact-Gate: ein Export ist tot, wenn ihn niemand ueber
 * genau diese Datei importiert. Aufloesung ueber den Modulgraphen der
 * tsconfig – Namensgleichheit in einer fremden Datei zaehlt nicht.
 * main.tsx ist der einzige Einstiegspunkt.
 */
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { fail, ROOT, walk } from './lib/report.mjs';
import { forEachNode, lineOf, parse, resolveSpecifier, ts } from './lib/ts-ast.mjs';

const norm = (file) => file.replaceAll('\\', '/');
const SRC = resolve(ROOT, 'src');
const entry = norm(resolve(SRC, 'main.tsx'));
const sources = [
  ...walk(SRC, (file) => /\.(ts|tsx)$/.test(file) && !file.endsWith('.d.ts')).map(norm),
  ...['vite.config.ts', 'eslint.config.mjs'].map((file) => resolve(ROOT, file)).filter(existsSync).map(norm),
];
const consumers = [...sources, ...walk(resolve(ROOT, 'scripts'), (file) => /\.(m|c)?[jt]sx?$/.test(file)).map(norm)];

const exportsOf = new Map();
const used = new Map();
/** Dateien, deren Mitglieder nicht in Namensform vorliegen: Import verdeckt alles. */
const unknown = new Set();
const addUse = (file, name) => {
  if (!used.has(file)) used.set(file, new Set());
  used.get(file).add(name);
};

function addBinding(node, add) {
  if (ts.isIdentifier(node)) add(node.text, node.getStart());
  else if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    for (const element of node.elements) if (ts.isBindingElement(element)) addBinding(element.name, add);
  }
}

/** Benannte Exporte einer Datei: Name -> Zeile; Default-Exports sind kein benanntes Artefakt. */
function collectExports(file) {
  const source = parse(file);
  const names = new Map();
  const add = (name, pos) => names.set(name, lineOf(source, pos));
  for (const statement of source.statements) {
    const modifiers = ts.canHaveModifiers(statement) ? (ts.getModifiers(statement) ?? []) : [];
    if (!modifiers.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) continue;
    if (modifiers.some((mod) => mod.kind === ts.SyntaxKind.DefaultKeyword)) continue;
    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const target = resolveSpecifier(statement.moduleSpecifier.text, file);
      const clause = statement.exportClause;
      if (!clause) {
        if (target) unknown.add(target);
      } else if (ts.isNamespaceExport(clause)) {
        add(clause.name.text, clause.name.getStart(source));
      } else {
        for (const element of clause.elements) {
          add(element.name.text, element.name.getStart(source));
          if (target) addUse(target, (element.propertyName ?? element.name).text);
        }
      }
    } else if (ts.isExportDeclaration(statement)) {
      const clause = statement.exportClause;
      if (clause && ts.isNamespaceExport(clause)) add(clause.name.text, clause.name.getStart(source));
      else if (clause) for (const element of clause.elements) add(element.name.text, element.name.getStart(source));
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        addBinding(declaration.name, (name, pos) => add(name, pos));
      }
    } else if (statement.name) add(statement.name.text, statement.name.getStart(source));
  }
  return names;
}

/** Jeder Import oder Re-Export in einer fremden Datei ist eine Nutzung des Ziels. */
function collectUses(file) {
  const source = parse(file);
  forEachNode(source, (node) => {
    if (ts.isImportDeclaration(node)) {
      const target = resolveSpecifier(node.moduleSpecifier.text, file);
      const clause = node.importClause;
      if (!target || !clause?.namedBindings) return;
      if (ts.isNamespaceImport(clause.namedBindings)) unknown.add(target);
      else for (const element of clause.namedBindings.elements) addUse(target, (element.propertyName ?? element.name).text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      const target = resolveSpecifier(node.moduleSpecifier.text, file);
      const clause = node.exportClause;
      if (!target) return;
      if (!clause || ts.isNamespaceExport(clause)) unknown.add(target);
      else for (const element of clause.elements) addUse(target, (element.propertyName ?? element.name).text);
    }
  });
}

for (const file of sources) exportsOf.set(file, collectExports(file));
for (const file of consumers) collectUses(file);

let index = 0;
let dead = 0;
let total = 0;
for (const file of sources) {
  const hidden = file === entry || unknown.has(file);
  for (const [name, line] of exportsOf.get(file) ?? []) {
    total += 1;
    if (hidden || used.get(file)?.has(name)) continue;
    dead += 1;
    index += 1;
    fail(index, 'ERR-4003', relative(ROOT, file), `Export ${name} (Zeile ${line}) wird nirgendwo importiert`);
  }
}

if (dead > 0) {
  console.error(`verify-dead-code: ${dead} tote Exporte`);
  process.exit(1);
}
console.log(`verify-dead-code: PASS (${total} Exporte, ${sources.length} Dateien)`);
