/**
 * Doku-Paritaet: `AGENTS.md`, `docs/CI.md` und `docs/GOVERNANCE.md` gegen den
 * ausfuehrbaren Plan (`pipeline-plan.mjs`) und den Roster (`lane-claims.mjs`).
 *
 * Quelle ist der Code. Die Doku darf ihn beschreiben, aber keine zweite Wahrheit
 * erzeugen: eine Gate-Zahl, ein fehlendes Gate in der Tabelle oder eine Rolle
 * ausserhalb von `OWNERS` ist ein Fehler, kein Hinweis.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { OWNERS } from './lane-claims.mjs';
import { LIGHT_GATES, REQUIRED_CI_GATES } from './pipeline-plan.mjs';
import { ROOT } from './report.mjs';

/** Die Gate-Namen der Required-Tabelle: `| 3 | `typecheck` | ... |`. */
export function documentedRequiredGates(ciText, required = REQUIRED_CI_GATES) {
  return [...String(ciText).matchAll(/^\|\s*\d+\s*\|\s*`([a-z:-]+)`\s*\|/gm)]
    .map((match) => String(match[1] ?? ''))
    // Nur die Required-Tabelle; spaetere Tabellen nennen keine Gates.
    .filter((name) => [...required].includes(name));
}

/** Die Liste hinter `- `verify:light` = zehn Gates: ...`. */
export function documentedLightGates(ciText) {
  const line = String(ciText).split('\n').find((entry) => entry.startsWith('- `verify:light` ='));
  if (!line) return [];
  const start = line.indexOf(':', line.indexOf('='));
  return [...line.slice(start + 1).matchAll(/`([^`]+)`/g)].map((match) => match[1]);
}

/** Die Rollen der Governance-Zeile, die sich ausdruecklich auf `OWNERS` beruft. */
export function documentedOwners(governanceText) {
  const line = String(governanceText).split('\n').find((entry) => entry.includes('sind feste Rollen aus `OWNERS`'));
  if (!line) return [];
  return [...line.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => match[1].trim());
}

const NUMBER_WORDS = Object.freeze({ 10: 'zehn', 15: 'fünfzehn', 16: 'sechzehn', 17: 'siebzehn' });
const numberWord = (value) => NUMBER_WORDS[value] ?? String(value);

/**
 * Reine Pruefung: bekommt die drei Doku-Texte und die erwarteten Listen.
 * Liefert die Abweichungen als Saetze; leer heisst paritaetisch.
 */
export function checkDocParity({
  ciText,
  agentsText,
  governanceText,
  required = REQUIRED_CI_GATES,
  light = LIGHT_GATES,
  owners = OWNERS,
}) {
  const problems = [];
  const requiredList = [...required];
  const lightList = [...light];
  const ownerList = [...owners];

  const table = documentedRequiredGates(ciText, required);
  if (JSON.stringify(table) !== JSON.stringify(requiredList)) {
    problems.push(
      `docs/CI.md: Required-Tabelle nennt ${table.length} Gates (${table.join(', ') || '-'}), der Plan ${requiredList.length} (${requiredList.join(', ')})`,
    );
  }
  if (!String(ciText).includes(`besteht aus ${numberWord(requiredList.length)} Gates`)) {
    problems.push(`docs/CI.md: Zahl der Required-Gates ist nicht "${numberWord(requiredList.length)}"`);
  }
  if (!String(ciText).includes(`${numberWord(requiredList.length)} Required plus Audit (${numberWord(requiredList.length + 1)} Läufe)`)) {
    problems.push(`docs/CI.md: Full-Profil nennt nicht ${requiredList.length} Required plus Audit (${requiredList.length + 1} Läufe)`);
  }

  const lightDoc = documentedLightGates(ciText);
  if (JSON.stringify(lightDoc) !== JSON.stringify(lightList)) {
    problems.push(
      `docs/CI.md: verify:light nennt ${lightDoc.length} Gates (${lightDoc.join(', ') || '-'}), der Plan ${lightList.length} (${lightList.join(', ')})`,
    );
  }

  const agentsRequired = /(\d+)\s+lokale Required-Gates/.exec(String(agentsText));
  const agentsLight = /(\d+)\s+Light-Gates/.exec(String(agentsText));
  const agentsRuns = /(\d+)\s+Required-Gates plus Audit \((\d+)\s+Läufe\)/.exec(String(agentsText));
  if (Number(agentsRequired?.[1]) !== requiredList.length) {
    problems.push(`AGENTS.md: ${agentsRequired?.[1] ?? '?'} lokale Required-Gates, der Plan ${requiredList.length}`);
  }
  if (Number(agentsLight?.[1]) !== lightList.length) {
    problems.push(`AGENTS.md: ${agentsLight?.[1] ?? '?'} Light-Gates, der Plan ${lightList.length}`);
  }
  if (Number(agentsRuns?.[1]) !== requiredList.length || Number(agentsRuns?.[2]) !== requiredList.length + 1) {
    problems.push(
      `AGENTS.md: verify:all nennt ${agentsRuns?.[1] ?? '?'} Required / ${agentsRuns?.[2] ?? '?'} Läufe, der Plan ${requiredList.length} / ${requiredList.length + 1}`,
    );
  }

  const docOwners = documentedOwners(governanceText);
  if (JSON.stringify(docOwners) !== JSON.stringify(ownerList)) {
    problems.push(
      `docs/GOVERNANCE.md: Rollen (${docOwners.join(', ') || '-'}) weichen von OWNERS (${ownerList.join(', ')}) ab`,
    );
  }

  return problems;
}

/** Liest die drei Pflichtdokumente und prueft sie gegen den Code. */
export function verifyDocParity(root = ROOT) {
  const read = (file) => readFileSync(join(root, file), 'utf8');
  return checkDocParity({
    ciText: read('docs/CI.md'),
    agentsText: read('AGENTS.md'),
    governanceText: read('docs/GOVERNANCE.md'),
  });
}
