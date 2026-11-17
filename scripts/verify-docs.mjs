#!/usr/bin/env node
/**
 * Doc-Gate: Struktur, Marker, flacher Wurzelbaum und interne Anker.
 * Rot bei Abweichung, also auch dann, wenn ein Link auf einen Anker zeigt,
 * den keine Ueberschrift erzeugt (#860).
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkDocAnchors } from './lib/doc-anchors.mjs';
import { docCoreProblems } from './lib/doc-core.mjs';
import { verifyDocParity } from './lib/doc-parity.mjs';
import { verifyDocs } from './lib/doc-sync.mjs';
import { PROMPT_REGISTER_FILE, promptProblems } from './lib/prompt-register.mjs';
import { describePlan, plan } from './lib/escalation.mjs';
import { ROOT, fail } from './lib/report.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-docs' });

/** Alle Dokumente, deren interne Links gelten: Wurzelvertrag und `docs/`. */
function markdownFiles() {
  const files = ['AGENTS.md', 'README.md'];
  const walk = (directory) => {
    for (const entry of readdirSync(join(ROOT, directory)).sort()) {
      const path = `${directory}/${entry}`;
      if (statSync(join(ROOT, path)).isDirectory()) walk(path);
      else if (path.endsWith('.md')) files.push(path);
    }
  };
  walk('docs');
  return files.filter((path) => {
    try {
      return statSync(join(ROOT, path)).isFile();
    } catch {
      return false;
    }
  });
}

function loadDocuments() {
  return markdownFiles().map((path) => ({ path, text: readFileSync(join(ROOT, path), 'utf8') }));
}

/**
 * Prompt-Register (#885): ein Prompt mit Verhaltenswirkung ohne Board-Issue ist
 * ein roter Befund. Geprueft wird die Abdeckung, nicht der Inhalt des Prompts.
 */
function promptRegisterProblems() {
  const register = join(ROOT, PROMPT_REGISTER_FILE);
  const text = existsSync(register) ? readFileSync(register, 'utf8') : null;
  const cronFiles = (() => {
    try {
      return readdirSync(join(ROOT, '.cron'))
        .filter((name) => name.endsWith('.md'))
        .sort()
        .map((name) => `.cron/${name}`);
    } catch {
      // Ohne `.cron` gibt es keine Cron-Prompts; die Pflichtprompts gelten weiter.
      return [];
    }
  })();
  return promptProblems({
    text,
    cronFiles,
    fileExists: (path) => existsSync(join(ROOT, path)),
  });
}

// Struktur und Marker allein reichen nicht: die Zahlen und Rollen muessen zum
// ausfuehrbaren Plan passen, sonst arbeitet ein Agent nach einer zweiten Wahrheit.
const problems = [
  ...new Set([
    ...verifyDocs(),
    ...docCoreProblems(),
    ...verifyDocParity(),
    ...checkDocAnchors(loadDocuments()),
    ...promptRegisterProblems(),
  ]),
];
if (problems.length === 0) {
  console.log('verify:docs: PASS (5 Pflichtdokus, Kern-Budgets, Cross-Checks, Anker, Prompt-Register)');
  process.exit(0);
}
problems.forEach((problem, index) => fail(index + 1, 'ERR-4017', 'verify:docs', problem));
console.error(describePlan(plan(problems.join('\n'))));
process.exit(1);
