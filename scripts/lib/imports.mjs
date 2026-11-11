/**
 * Import- und Kopfkommentar-Lesen ohne TypeScript-Abhaengigkeit.
 *
 * Der Impact-Pfad (`agent:context`, `pretask`, `test:affected`, `ci-plan`) muss
 * auch in einem nackten Checkout laufen, in dem `node_modules` fehlt. Genau
 * dort scheiterte `pretask` bisher mit "Impact-Plan fehlt", weil `ts-ast` den
 * Compiler statisch importiert.
 *
 * Die Gates, die echte Syntax brauchen (`verify-dead-code`,
 * `verify-test-quality`, `sync-dependency-matrix`), behalten `ts-ast.mjs` mit
 * dem Compiler. Hier steht die bewusst groebere Variante: sie darf Kanten
 * hinzuerfinden (breitere Testauswahl), aber keine echte Kante verlieren.
 * Deshalb sind die Muster Superset-orientiert und Kommentare werden entfernt.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const NORMALIZE_CACHE = new Map();
const cache = new Map();

/** Quelltext ohne Kommentare; Strings bleiben unangetastet. */
function stripComments(text) {
  // Blockkommentare zuerst, dann Zeilen, die nur ein Kommentar sind. Ein `//`
  // mitten in einer Zeile bleibt stehen: es koennte in einem String liegen.
  return String(text)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

const SPECIFIER_PATTERNS = Object.freeze([
  // import x from 'y' · import {a as b} from "y" · import type ... · import 'y'
  /\bimport\s+(?:type\s+)?(?:[^'"()]*?\bfrom\s*)?['"]([^'"]+)['"]/g,
  // export {a} from 'y' · export * as ns from 'y'
  /\bexport\s+(?:type\s+)?(?:[^'"()]*?\bfrom\s*)['"]([^'"]+)['"]/g,
  // import('y') · require('y')
  /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]);

/** Alle Modul-Specifier einer Datei; Reihenfolge ist stabil. */
export function specifiersOf(file) {
  if (cache.has(file)) return cache.get(file);
  let text;
  try {
    text = stripComments(readFileSync(file, 'utf8'));
  } catch {
    cache.set(file, []);
    return [];
  }
  const found = new Set();
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of text.matchAll(pattern)) {
      if (match[1]) found.add(match[1]);
    }
  }
  const list = [...found];
  cache.set(file, list);
  return list;
}

/**
 * Fuehrender Kommentarblock einer Datei. Gesucht werden nur die Kopfzeilen bis
 * zum ersten Code; `@test-target` und `@proof-class` stehen dort.
 */
export function headerCommentOf(file) {
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    return '';
  }
  const lines = [];
  let inBlock = false;
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (inBlock) {
      lines.push(line);
      if (trimmed.includes('*/')) inBlock = false;
      continue;
    }
    if (trimmed === '') {
      lines.push(line);
      continue;
    }
    if (trimmed.startsWith('/*')) {
      lines.push(line);
      inBlock = !trimmed.includes('*/');
      continue;
    }
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
      lines.push(line);
      continue;
    }
    break;
  }
  // Einzelne Leerzeilen am Rand zaehlen nicht als Kopf.
  return lines.join('\n').trim();
}

const PROBES = Object.freeze(['', '.ts', '.tsx', '.mjs', '.js', '.jsx', '.cjs', '.json']);

/**
 * Relativen Specifier gegen echte Dateien aufloesen.
 *
 * Bewusst ohne tsconfig: fuer den Importgraphen genuegt die Existenz. Externe
 * Pakete bleiben `null`, genau wie in `ts-ast`.
 */
export function resolveSpecifier(specifier, fromFile) {
  if (!specifier.startsWith('.') && !specifier.startsWith('/')) return null;
  const key = `${fromFile}::${specifier}`;
  const cached = NORMALIZE_CACHE.get(key);
  if (cached !== undefined) return cached;
  const base = resolve(dirname(fromFile), specifier);
  let hit = null;
  for (const probe of PROBES) {
    const candidate = probe === '' ? base : `${base}${probe}`;
    if (existsSync(candidate) && !candidate.endsWith('/')) {
      hit = candidate;
      break;
    }
  }
  if (!hit) {
    for (const name of ['index.ts', 'index.tsx', 'index.mjs', 'index.js']) {
      const candidate = join(base, name);
      if (existsSync(candidate)) {
        hit = candidate;
        break;
      }
    }
  }
  const normalized = hit === null ? null : hit.replaceAll('\\', '/');
  NORMALIZE_CACHE.set(key, normalized);
  return normalized;
}
