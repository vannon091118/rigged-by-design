/**
 * Der Doku-Kern: fuenf Pflichtdokus, ein Token-Budget, ein Cross-Check.
 *
 * Ein Dokument "verstehen" heisst: seinen `## Kern` lesen. Fuer vier Dokumente
 * ist sogar das ganze Dokument budgetiert; die Roadmap traegt unter dem Kern
 * ihre ausfuehrlichen Phasentabellen. Die Summe aller Kerne ist der vollstaendige
 * Ueberblick und bleibt weit unter 10.000 Token.
 *
 * Die Pruefung ist rein lesend und merge-stabil: der Kern darf weder Version
 * noch HEAD-SHA noch einen generierten Block enthalten.
 */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { GENERATED_FILES } from './generated-files.mjs';
import { ROOT } from './report.mjs';
import {
  CORE_DOCS, CORE_PATHS, CORE_TOKEN_BUDGET, READING_DOCS, READING_PATHS,
  READING_TOKEN_BUDGET, budgetedText, estimateTokens, kernBlock, packageScripts,
  readText, trackedFiles,
} from './doc-core-schema.mjs';
import { commandFindings, lastChangesProblems, volatileFindings } from './doc-core-findings.mjs';
import { layerProblems, ownershipProblems, referenceProblems } from './doc-core-structure.mjs';

export {
  CHARS_PER_TOKEN, CORE_DOCS, CORE_PATHS, CORE_TOKEN_BUDGET, ENTRY_DOCS,
  OVERVIEW_TOKEN_BUDGET, READING_DOCS, READING_PATHS, READING_TOKEN_BUDGET,
  budgetedText, estimateTokens, kernBlock,
} from './doc-core-schema.mjs';
export { commandFindings, lastChangesProblems, volatileFindings } from './doc-core-findings.mjs';
export { LAYERS, layerProblems, ownershipProblems, referenceProblems } from './doc-core-structure.mjs';

/** Alle Abweichungen des Doku-Kerns; leer heisst gruen. */
export function docCoreProblems({ root = ROOT, coreDocs = CORE_DOCS } = {}) {
  const problems = [];
  const scripts = packageScripts(root);
  const fileExists = (path) => existsSync(join(root, path));
  let overview = 0;
  const texts = new Map();

  const checkDoc = (doc, { required }) => {
    const text = readText(doc.path, root);
    if (text === null) {
      problems.push(`${doc.path}: ${required ? 'Pflichtdokument' : 'Einstieg'} fehlt (${doc.title}).`);
      return;
    }
    texts.set(doc.path, text);
    if (!text.includes('<!-- rbd-doc: managed -->')) problems.push(`${doc.path}: rbd-doc-Marker fehlt.`);
    if (required) {
      for (const section of doc.sections) {
        if (!text.includes(section)) problems.push(`${doc.path}: Pflichtabschnitt "${section}" fehlt.`);
      }
    }
    const kern = kernBlock(text);
    if (kern === null) {
      problems.push(`${doc.path}: "## Kern" fehlt.`);
      return;
    }
    const budgeted = budgetedText(doc, text) ?? '';
    const tokens = estimateTokens(budgeted);
    overview += tokens;
    if (tokens > CORE_TOKEN_BUDGET) {
      problems.push(`${doc.path}: ${tokens} Token ueber Budget ${CORE_TOKEN_BUDGET} (${doc.scope}).`);
    }
    const volatile = volatileFindings(kern);
    if (volatile.length > 0) problems.push(`${doc.path}: Kern nicht merge-stabil (${volatile.join(', ')}).`);
    const commands = commandFindings(kern, { scripts, fileExists });
    if (commands.length > 0) {
      problems.push(`${doc.path}: Kern nennt unbekannte Quelle(n): ${commands.join(', ')}.`);
    }
  };

  for (const doc of coreDocs) checkDoc(doc, { required: true });
  for (const doc of READING_DOCS) {
    if (!CORE_PATHS.includes(doc.path)) checkDoc(doc, { required: false });
  }

  if (overview > READING_TOKEN_BUDGET) {
    problems.push(`Lesepfad: ${overview} Token ueber Gesamtbudget ${READING_TOKEN_BUDGET}.`);
  }
  const index = texts.get('docs/INDEX.md');
  if (index) {
    for (const doc of coreDocs) {
      const name = doc.path.split('/').pop();
      if (!index.includes(name)) problems.push(`docs/INDEX.md: Pflichtdoku ${doc.path} nicht verlinkt.`);
    }
  }
  const tracked = trackedFiles(root);
  problems.push(...referenceProblems({ index, tracked }));
  problems.push(...ownershipProblems({ root, index, tracked }));
  problems.push(...layerProblems({ index, tracked }));
  problems.push(...lastChangesProblems({ root, text: texts.get('docs/LAST-CHANGES.md') }));
  return problems;
}

/** Vollstaendige Messung fuer `scripts/doc-audit.mjs` und die Evidenz. */
export function auditDocs({ root = ROOT, coreDocs = CORE_DOCS } = {}) {
  const tracked = trackedFiles(root);
  const markdown = tracked.filter((path) => path.endsWith('.md'));
  const measure = (doc) => {
    const text = readText(doc.path, root) ?? '';
    const kern = kernBlock(text) ?? '';
    const budgeted = budgetedText(doc, text) ?? '';
    return {
      path: doc.path,
      title: doc.title,
      scope: doc.scope,
      bytes: Buffer.byteLength(text),
      tokens: estimateTokens(budgeted),
      kernTokens: estimateTokens(kern),
      budget: CORE_TOKEN_BUDGET,
      ok: estimateTokens(budgeted) <= CORE_TOKEN_BUDGET,
    };
  };
  const core = coreDocs.map(measure);
  const reading = READING_DOCS.map(measure);
  const reference = markdown
    .filter((path) => !READING_PATHS.includes(path))
    .map((path) => {
      const text = readText(path, root) ?? '';
      return {
        path,
        bytes: Buffer.byteLength(text),
        tokens: estimateTokens(text),
        generated: Object.hasOwn(GENERATED_FILES, path),
      };
    })
    .sort((left, right) => right.tokens - left.tokens);
  return {
    core,
    reading,
    reference,
    overviewTokens: reading.reduce((sum, doc) => sum + doc.tokens, 0),
    overviewBudget: READING_TOKEN_BUDGET,
    coreBudget: CORE_TOKEN_BUDGET,
    totals: {
      markdownFiles: markdown.length,
      markdownTokens: reference.reduce((sum, doc) => sum + doc.tokens, 0),
    },
    problems: docCoreProblems({ root, coreDocs }),
  };
}
