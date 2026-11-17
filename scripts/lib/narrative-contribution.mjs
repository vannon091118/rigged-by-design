/**
 * Ein Beitrag und die Inbox: Schema, kontrolliertes Vokabular, Dateiname.
 * Keine Manifest- oder Registry-Pruefung.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  CONTRIBUTION_FIELDS, DIRECTIVE, FILE, LIMITS, SLUG, TURN,
  controlled, controlledList, isRecord, issue, stringField,
} from './narrative-schema.mjs';

/** Validate one contribution; exported for focused schema tests. */
export function validateContribution(data, vocabulary, sourcePath = '') {
  const issues = [];
  if (!isRecord(data)) {
    issues.push(issue(sourcePath || 'contribution', 'Beitrag ist kein Objekt'));
    return issues;
  }
  for (const key of Object.keys(data)) {
    if (!CONTRIBUTION_FIELDS.includes(key)) issues.push(issue(sourcePath, `unbekanntes Feld: ${key}`));
  }
  for (const key of ['agentId', 'turnId', 'contributionId', 'role', 'locale', 'slot', 'function', 'tone', 'mood', 'relationship', 'text']) {
    stringField(data, key, sourcePath, issues);
  }

  if (typeof data.agentId === 'string' && !SLUG.test(data.agentId)) issues.push(issue(sourcePath, 'agentId ist kein stabiler Slug'));
  if (typeof data.turnId === 'string' && !TURN.test(data.turnId)) issues.push(issue(sourcePath, 'turnId hat nicht das Format YYYY-MM-DDTHH:MMZ-slug'));
  if (typeof data.contributionId === 'string' && !SLUG.test(data.contributionId)) issues.push(issue(sourcePath, 'contributionId ist kein stabiler Slug'));

  controlled(data.role, vocabulary.roles, 'role', sourcePath, issues);
  controlled(data.locale, vocabulary.locales, 'locale', sourcePath, issues);
  controlled(data.slot, vocabulary.slots, 'slot', sourcePath, issues);
  controlled(data.function, vocabulary.functions, 'function', sourcePath, issues);
  controlled(data.tone, vocabulary.tones, 'tone', sourcePath, issues);
  controlled(data.mood, vocabulary.moods, 'mood', sourcePath, issues);
  controlled(data.relationship, vocabulary.relationships, 'relationship', sourcePath, issues);
  controlledList(data.contexts, vocabulary.contexts, 'contexts', sourcePath, issues, { min: 1, max: LIMITS.contexts });
  controlledList(data.flags, vocabulary.flags, 'flags', sourcePath, issues, { min: 1, max: LIMITS.flags });
  controlledList(data.personaRefs, vocabulary.personas, 'personaRefs', sourcePath, issues, { min: 0, max: LIMITS.personaRefs });
  if (Array.isArray(data.flags) && !data.flags.includes('narrativ')) issues.push(issue(sourcePath, 'flags muss narrativ enthalten'));

  const allowedFunctions = vocabulary.slotFunctions?.[data.slot];
  if (Array.isArray(allowedFunctions) && !allowedFunctions.includes(data.function)) {
    issues.push(issue(sourcePath, `function ${String(data.function)} passt nicht zu slot ${String(data.slot)}`));
  }

  if (typeof data.text === 'string' && data.text.includes('€')) {
    issues.push(issue(sourcePath, 'sichtbarer Text enthaelt ein €-Makro; Direktiven gehoeren in directives'));
  }

  if (!Array.isArray(data.directives) || data.directives.length > LIMITS.directives) {
    issues.push(issue(sourcePath, `directives braucht 0..${LIMITS.directives} Eintraege`));
  } else {
    for (const directive of data.directives) {
      if (typeof directive !== 'string' || !DIRECTIVE.test(directive) || directive.length > LIMITS.directive) {
        issues.push(issue(sourcePath, `directive ist ungueltig: ${String(directive)}`));
      }
    }
  }

  if (sourcePath) {
    const file = sourcePath.split('/').pop() ?? '';
    if (!FILE.test(file)) issues.push(issue(sourcePath, 'Dateiname folgt nicht dem Content-Muster'));
    else if (typeof data.turnId === 'string' && !data.turnId.startsWith(`${file.slice(0, 10)}T`)) {
      issues.push(issue(sourcePath, 'turnId-Datum passt nicht zum Dateinamen'));
    }
  }
  return issues;
}

export function readContributions(root) {
  const directory = join(root, 'content/narrative/contributions');
  if (!existsSync(directory)) return { contributions: [], issues: [issue('content/narrative/contributions', 'Verzeichnis fehlt')] };
  const issues = [];
  const contributions = [];
  const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const path = relative(root, join(directory, entry.name)).split(/[\\/]/).join('/');
    const reason = entry.isSymbolicLink() ? 'Symlink'
      : entry.isDirectory() ? 'Unterordner'
        : !entry.isFile() ? 'kein regulaere Datei'
          : entry.name.startsWith('.') ? 'versteckter Name'
            : !FILE.test(entry.name) ? 'Dateiname folgt nicht dem Content-Muster'
              : null;
    if (reason !== null) {
      issues.push(issue(path, `Nicht erlaubter Eintrag (${reason})`));
      continue;
    }
    try {
      contributions.push({ path, data: JSON.parse(readFileSync(join(directory, entry.name), 'utf8')) });
    } catch (error) {
      issues.push(issue(path, error instanceof Error ? error.message : String(error)));
      contributions.push({ path, data: null });
    }
  }
  return { contributions, issues };
}
