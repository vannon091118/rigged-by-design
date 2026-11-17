/**
 * Turn-Manifest und Gesamtvertrag: genau ein Beitrag je registriertem Turn,
 * keine doppelten IDs, Registry-Vergleich optional.
 */
import { buildCompiledRegistry, validateCompiledRegistry } from './narrative-compiler.mjs';
import { MANIFEST_FIELDS, TURN, isRecord, issue } from './narrative-schema.mjs';
import { validateContribution } from './narrative-contribution.mjs';

export function validateManifest(manifest, contributions) {
  const path = 'content/narrative/turns/manifest.json';
  const issues = [];
  if (!isRecord(manifest) || manifest.version !== 1 || !Array.isArray(manifest.turns)) {
    issues.push(issue(path, 'Manifest braucht version 1 und turns[]'));
    return issues;
  }
  const turnIds = new Map();
  const contributionIds = new Map();
  const byTurn = new Map();
  for (const entry of contributions) {
    if (entry.data?.turnId) {
      if (!byTurn.has(entry.data.turnId)) byTurn.set(entry.data.turnId, []);
      byTurn.get(entry.data.turnId).push(entry);
    }
  }
  for (const entry of manifest.turns) {
    if (!isRecord(entry)) {
      issues.push(issue(path, 'Manifest-Eintrag ist kein Objekt'));
      continue;
    }
    for (const key of Object.keys(entry)) if (!MANIFEST_FIELDS.includes(key)) issues.push(issue(path, `unbekanntes Manifest-Feld: ${key}`));
    for (const key of MANIFEST_FIELDS) {
      if (typeof entry[key] !== 'string' || entry[key].trim() === '') issues.push(issue(path, `Manifest-Eintrag ohne ${key}`));
    }
    if (typeof entry.turnId === 'string' && !TURN.test(entry.turnId)) issues.push(issue(path, `ungueltige turnId: ${entry.turnId}`));
    if (typeof entry.turnId === 'string') {
      if (turnIds.has(entry.turnId)) issues.push(issue(path, `turnId doppelt registriert: ${entry.turnId}`));
      turnIds.set(entry.turnId, (turnIds.get(entry.turnId) ?? 0) + 1);
    }
    if (typeof entry.contributionId === 'string') {
      if (contributionIds.has(entry.contributionId)) issues.push(issue(path, `contributionId doppelt registriert: ${entry.contributionId}`));
      contributionIds.set(entry.contributionId, (contributionIds.get(entry.contributionId) ?? 0) + 1);
    }
    if (typeof entry.turnId === 'string') {
      const matches = byTurn.get(entry.turnId) ?? [];
      if (matches.length !== 1) issues.push(issue(path, `registrierter Turn braucht genau einen Beitrag: ${entry.turnId} (${matches.length})`));
      else if (matches[0].data.contributionId !== entry.contributionId) {
        issues.push(issue(path, `Manifest verweist fuer ${entry.turnId} auf ${entry.contributionId}, Beitrag traegt ${matches[0].data.contributionId}`));
      }
    }
  }
  for (const entry of contributions) {
    if (entry.data?.turnId && !turnIds.has(entry.data.turnId)) issues.push(issue(entry.path, `Beitrag ist nicht im Turn-Manifest registriert: ${entry.data.turnId}`));
  }
  if (manifest.turns.length !== contributions.length) {
    issues.push(issue(path, `Manifest zaehlt ${manifest.turns.length} Turns, Inbox enthaelt ${contributions.length} Beitraege`));
  }
  return issues;
}

/** Validate schema, duplicate IDs, manifest and compilation; registry is optional. */
export function validateNarrativeData({ vocabulary, contributions, manifest, registry, registryText = null, compiled = null }) {
  const issues = [];
  for (const entry of contributions) {
    if (entry.data === null) continue;
    issues.push(...validateContribution(entry.data, vocabulary, entry.path));
  }
  const contributionIds = new Map();
  const turnIds = new Map();
  for (const entry of contributions) {
    const id = entry.data?.contributionId;
    const turn = entry.data?.turnId;
    if (typeof id === 'string') {
      if (contributionIds.has(id)) issues.push(issue(entry.path, `contributionId doppelt: ${id}`));
      contributionIds.set(id, (contributionIds.get(id) ?? 0) + 1);
    }
    if (typeof turn === 'string') {
      if (turnIds.has(turn)) issues.push(issue(entry.path, `turnId doppelt: ${turn}`));
      turnIds.set(turn, (turnIds.get(turn) ?? 0) + 1);
    }
  }
  issues.push(...validateManifest(manifest, contributions));
  const compilation = compiled ?? buildCompiledRegistry(contributions, vocabulary);
  issues.push(...compilation.issues);
  if (registry !== undefined) {
    issues.push(...validateCompiledRegistry(registry, compilation.document, registryText));
  }
  return issues;
}
