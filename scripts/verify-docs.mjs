#!/usr/bin/env node
/**
 * Doc-Gate: Struktur, Marker, flacher Wurzelbaum und interne Anker.
 * Rot bei Abweichung, also auch dann, wenn ein Link auf einen Anker zeigt,
 * den keine Ueberschrift erzeugt (#860).
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { checkDocAnchors } from './lib/doc-anchors.mjs';
import { verifyDocParity } from './lib/doc-parity.mjs';
import { verifyDocs } from './lib/doc-sync.mjs';
import { describePlan, plan } from './lib/escalation.mjs';
import { ROOT, fail } from './lib/report.mjs';

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

// Struktur und Marker allein reichen nicht: die Zahlen und Rollen muessen zum
// ausfuehrbaren Plan passen, sonst arbeitet ein Agent nach einer zweiten Wahrheit.
const problems = [...verifyDocs(), ...verifyDocParity(), ...checkDocAnchors(loadDocuments())];
if (problems.length === 0) {
  console.log('verify:docs: PASS (Struktur, Marker und interne Anker)');
  process.exit(0);
}
problems.forEach((problem, index) => fail(index + 1, 'ERR-4017', 'verify:docs', problem));
console.error(describePlan(plan(problems.join('\n'))));
process.exit(1);
