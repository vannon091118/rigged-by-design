#!/usr/bin/env node
/**
 * NAR-10 content compiler.
 *
 * Default and `--check` are strictly read-only. Only `--write` changes the
 * generated registry. The compiler refuses to write while any schema, macro or
 * conflict issue exists.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadNarrativeSources } from './lib/narrative-content.mjs';
import { renderRegistry, validateCompiledRegistry } from './lib/narrative-compiler.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const TARGET = join(ROOT, 'content/narrative/registry/fragments.json');
const args = process.argv.slice(2);
const write = args.includes('--write');
const check = args.includes('--check');
const unknown = args.filter((arg) => arg !== '--write' && arg !== '--check');

if (unknown.length > 0 || (write && check)) {
  console.error('[narrative-compiler] Nutzung: compile-narrative-content.mjs [--check|--write]');
  process.exit(2);
}

const sources = loadNarrativeSources(ROOT);

if (sources.issues.length > 0) {
  for (const problem of sources.issues) console.error(`[ERR-4022] ${problem.path}: ${problem.message}`);
  process.exit(1);
}

const document = sources.compiled;
const next = renderRegistry(document);
const current = existsSync(TARGET) ? readFileSync(TARGET, 'utf8') : null;

if (write) {
  writeFileSync(TARGET, next);
  console.log(`[narrative-compiler] Registry geschrieben: ${document.fragments.length} Fragmente, ${document.contentHash}`);
} else {
  const registryIssues = current === null
    ? [{ path: 'content/narrative/registry/fragments.json', message: 'Registry fehlt' }]
    : validateCompiledRegistry(JSON.parse(current), document, current);
  if (registryIssues.length > 0) {
    for (const problem of registryIssues) console.error(`[ERR-4022] ${problem.path}: ${problem.message}`);
    console.error('[narrative-compiler] Registry ist nicht aktuell; mit --write neu erzeugen.');
    process.exit(1);
  }
  console.log(`[narrative-compiler] Registry aktuell: ${document.fragments.length} Fragmente, ${document.contentHash}`);
}
