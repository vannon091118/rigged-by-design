/**
 * Prompt-Register (#885): jeder Prompt, der Maintainer- oder Agentenverhalten
 * regelt, hat eine Zeile in `docs/PROMPTS.md` und ein Board-Issue.
 *
 * Die Datei ist die Belegliste, nicht die Regel: die Regel steht in
 * `docs/GOVERNANCE.md#prompt-register`. Hier stehen nur reine Funktionen;
 * Dateisystem und Netz liegen beim Aufrufer.
 */

export const PROMPT_REGISTER_FILE = 'docs/PROMPTS.md';

/** Pflichtprompts im Repo: der Kurzvertrag und die kanonischen Regeln. */
export const REQUIRED_PROMPTS = Object.freeze(['AGENTS.md', 'docs/GOVERNANCE.md']);

const KINDS = Object.freeze(['datei', 'external']);
const SEVERITY = /^sev-[123]$/;

/**
 * Tabellenzeilen des Registers: `| Prompt | Pfad | Art | Sev | Issue |`.
 * Fremde Tabellen werden ignoriert, weil `Pfad` nur in Backticks und `Art` nur
 * als bekannter Wert zaehlt.
 */
export function parsePromptRegister(text = '') {
  const entries = [];
  for (const line of String(text).split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 5) continue;
    const [name, pathCell, kind, severity, issueCell] = cells;
    const prompt = /^`([^`]+)`$/.exec(pathCell)?.[1];
    if (!prompt || !KINDS.includes(kind)) continue;
    const number = /^#(\d+)$/.exec(issueCell)?.[1];
    entries.push({
      name,
      prompt,
      kind,
      severity: SEVERITY.test(severity) ? severity : null,
      issue: number ? Number(number) : null,
    });
  }
  return entries;
}

/** Board-Form: nur belegte Eintraege, nach Issue-Nummer sortiert. */
export function summarizePromptIssues(entries = []) {
  return (Array.isArray(entries) ? entries : [])
    .filter((entry) => Number.isInteger(entry?.issue) && entry.issue > 0 && entry.prompt)
    .map((entry) => ({
      issue: entry.issue,
      prompt: String(entry.prompt),
      severity: entry.severity ?? null,
      kind: entry.kind ?? null,
    }))
    .sort((left, right) => left.issue - right.issue);
}

/**
 * Abdeckung: kein Prompt ohne Issue, kein Registereintrag ohne Datei.
 * `text = null` heisst: die Registerdatei fehlt ganz.
 */
export function promptProblems({
  text = null,
  cronFiles = [],
  required = REQUIRED_PROMPTS,
  fileExists = () => true,
} = {}) {
  if (text === null) return [`${PROMPT_REGISTER_FILE}: Prompt-Register fehlt.`];
  const entries = parsePromptRegister(text);
  if (entries.length === 0) return [`${PROMPT_REGISTER_FILE}: kein Prompt registriert.`];
  const problems = [];
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.prompt)) problems.push(`${PROMPT_REGISTER_FILE}: ${entry.prompt} doppelt registriert.`);
    seen.add(entry.prompt);
    if (!entry.issue) problems.push(`${PROMPT_REGISTER_FILE}: ${entry.prompt} hat kein Board-Issue.`);
    if (!entry.severity) problems.push(`${PROMPT_REGISTER_FILE}: ${entry.prompt} hat keinen Schweregrad (sev-1 bis sev-3).`);
    if (entry.kind === 'datei' && !fileExists(entry.prompt)) {
      problems.push(`${PROMPT_REGISTER_FILE}: ${entry.prompt} ist registriert, existiert aber nicht.`);
    }
  }
  for (const path of [...required, ...cronFiles]) {
    if (!seen.has(path)) problems.push(`${PROMPT_REGISTER_FILE}: ${path} ist nicht registriert.`);
  }
  return problems;
}
