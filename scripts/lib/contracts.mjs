/**
 * Vertragsregister: die eine mechanische Sicht auf `docs/contracts/`.
 *
 * Die Vertraege werden nicht gepflegt, sondern abgeleitet: jede Datei unter
 * `docs/contracts/` ist ein Vertrag, die Tabelle in `README.md` liefert Owner,
 * Writer und Vertragstest. Das Gate `verify:contracts` vergleicht beides und
 * prueft zusaetzlich, dass genau ein offener Claim je Contract schreibt.
 *
 * Reine Funktionen ohne Seiteneffekte: der Test kann Luecken synthetisch
 * erzeugen, ohne den Arbeitsbaum anzufassen.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { OWNERS } from './lane-claims.mjs';

/** Alle Vertragsdateien; `README.md` ist der Index, kein Vertrag. */
export function contractIds(root) {
  return readdirSync(join(root, 'docs', 'contracts'))
    .filter((name) => name.endsWith('.md') && name !== 'README.md')
    .map((name) => name.slice(0, -'.md'.length))
    .sort();
}

/** Die Zeilen der Vertragstabelle: id, owner, writer, test. */
export function parseIndex(markdown) {
  const rows = [];
  const cell = (value) => String(value ?? '').trim().replace(/^`|`$/g, '').trim();
  for (const line of String(markdown ?? '').split('\n')) {
    const cells = line.split('|').slice(1, -1).map((entry) => entry.trim());
    if (cells.length !== 5) continue;
    const link = cells[0].match(/^\[`([a-z0-9-]+)`\]\(([a-z0-9-]+)\.md\)$/);
    if (!link) continue;
    rows.push({ id: link[1], link: link[2], owner: cell(cells[2]), writer: cell(cells[3]), test: cell(cells[4]) });
  }
  return rows;
}

/** Offene und geschlossene Lane-Claims mit ihren Contract-Modi. */
export function loadClaims(root) {
  const dir = join(root, '.lane-claims', 'claims');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .map((name) => {
      try {
        return JSON.parse(readFileSync(join(dir, name), 'utf8'));
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

const WRITER = /^lane\/[a-z0-9-]+(\/[a-z0-9-]+)*$/;
const MODES = new Set(['read', 'write']);

/**
 * Vergleicht Vertragsdateien, Index und Claims. Jede Luecke ist ein Befund;
 * die Reihenfolge ist stabil, damit die Ausgabe reproduzierbar bleibt.
 */
export function checkContracts({ root, ids, rows, claims = [] }) {
  const findings = [];
  const files = new Set(ids);
  const listed = new Set(rows.map((row) => row.id));

  for (const row of rows) {
    if (row.link !== row.id) findings.push(`docs/contracts/README.md: \`${row.id}\` verlinkt auf ${row.link}.md`);
  }
  const duplicates = rows.map((row) => row.id).filter((id, index, all) => all.indexOf(id) !== index);
  for (const id of new Set(duplicates)) findings.push(`docs/contracts/README.md: \`${id}\` steht mehrfach in der Tabelle`);
  for (const id of ids) if (!listed.has(id)) findings.push(`docs/contracts/${id}.md: keine Zeile in docs/contracts/README.md`);
  for (const id of listed) if (!files.has(id)) findings.push(`docs/contracts/README.md: \`${id}\` hat keine Vertragsdatei`);

  for (const row of rows) {
    if (!OWNERS.includes(row.owner)) findings.push(`contracts/${row.id}: Owner '${row.owner}' steht nicht im Roster`);
    if (!WRITER.test(row.writer)) findings.push(`contracts/${row.id}: Writer '${row.writer}' ist keine Lane`);
    const testPath = join(root, row.test);
    if (!existsSync(testPath)) {
      findings.push(`contracts/${row.id}: Vertragstest ${row.test} fehlt`);
    } else {
      const body = readFileSync(testPath, 'utf8');
      if (!body.includes('@test-target')) findings.push(`contracts/${row.id}: ${row.test} traegt kein @test-target`);
      if (!body.includes(row.id)) findings.push(`contracts/${row.id}: ${row.test} nennt die Contract-ID nicht`);
    }
    const contractPath = join(root, 'docs', 'contracts', `${row.id}.md`);
    if (existsSync(contractPath) && !/\*\*Status:\*\*/.test(readFileSync(contractPath, 'utf8'))) {
      findings.push(`contracts/${row.id}: Vertragsdatei traegt keine Status-Zeile`);
    }
  }

  const known = new Set(ids);
  const writers = new Map();
  for (const claim of claims) {
    for (const entry of Array.isArray(claim.contracts) ? claim.contracts : []) {
      const id = String(entry?.id ?? '');
      const mode = String(entry?.mode ?? '');
      if (!known.has(id)) findings.push(`claim ${claim.id}: unbekannter Contract '${id}'`);
      if (!MODES.has(mode)) findings.push(`claim ${claim.id}: Modus '${mode}' fuer '${id}' ist nicht read|write`);
      if (mode === 'write' && claim.status === 'open') {
        writers.set(id, [...(writers.get(id) ?? []), claim.id]);
      }
    }
  }
  for (const [id, lanes] of writers) {
    if (lanes.length > 1) findings.push(`contracts/${id}: mehrere schreibende Claims (${lanes.join(', ')})`);
  }
  return findings;
}
