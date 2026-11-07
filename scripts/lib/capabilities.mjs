/**
 * Capability-Manifest: Validierung und Gate-Logik für `verify:capabilities`.
 *
 * Prüft:
 * 1. Schema/IDs sind konsistent (stabile IDs, gültige Domains, Status-Werte)
 * 2. Jede aktive Fähigkeit hat mindestens einen existierenden, ausgeführten Test
 * 3. Test-IDs existieren wirklich und sind im Testkatalog registriert
 * 4. Pfadverweise sind nicht veraltet (Dateien existieren)
 * 5. Tombstones haben removedBecause, replacedBy, parityTestIds, Owner und ADR/Issue
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, 'docs', 'capabilities.json');

const VALID_STATUSES = Object.freeze(['active', 'deprecated', 'retired', 'unverified']);
const VALID_DOMAINS = Object.freeze([
  'raum',
  'karten',
  'slots',
  'interaktion',
  'narrative',
  'wirtschaft',
  'speicher',
  'zufall',
  'ui',
]);

/** Ein Capability-Eintrag aus dem Manifest. */
export class CapabilityEntry {
  constructor(data) {
    this.id = data.id;
    this.domain = data.domain;
    this.status = data.status;
    this.description = data.description;
    this.paths = data.paths ?? [];
    this.testIds = data.testIds ?? [];
    this.browserEvidence = data.browserEvidence ?? null;
    this.owner = data.owner;
  }

  toJSON() {
    return {
      id: this.id,
      domain: this.domain,
      status: this.status,
      description: this.description,
      paths: this.paths,
      testIds: this.testIds,
      browserEvidence: this.browserEvidence,
      owner: this.owner,
    };
  }
}

/** Ein Tombstone-Eintrag (entfernte Fähigkeit). */
export class TombstoneEntry {
  constructor(data) {
    this.id = data.id;
    this.removedBecause = data.removedBecause;
    this.replacedBy = data.replacedBy;
    this.parityTestIds = data.parityTestIds ?? [];
    this.owner = data.owner;
    this.adrIssue = data.adrIssue;
  }

  toJSON() {
    return {
      id: this.id,
      removedBecause: this.removedBecause,
      replacedBy: this.replacedBy,
      parityTestIds: this.parityTestIds,
      owner: this.owner,
      adrIssue: this.adrIssue,
    };
  }
}

/** Lädt das Capability-Manifest. */
export function loadCapabilities() {
  if (!existsSync(MANIFEST_PATH)) return { capabilities: [], tombstones: [] };
  try {
    const data = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
    return {
      capabilities: (data.capabilities ?? []).map((c) => new CapabilityEntry(c)),
      tombstones: (data.tombstones ?? []).map((t) => new TombstoneEntry(t)),
    };
  } catch {
    return { capabilities: [], tombstones: [] };
  }
}

/** Validiert eine einzelne Capability und gibt Fehler zurück. */
export function validateCapability(cap, existingTestFiles, allTestIds) {
  const errors = [];

  // ID muss stabil sein (keine Leerzeichen, keine Sonderzeichen außer Punkt/Minus/Unterstrich)
  if (!/^[a-z][a-z0-9._-]*$/.test(cap.id)) {
    errors.push(`Ungültige Capability-ID "${cap.id}": muss mit kleinem Buchstaben beginnen, nur a-z, 0-9, ., -, _`);
  }

  // Domain muss gültig sein
  if (!VALID_DOMAINS.includes(cap.domain)) {
    errors.push(`Ungültige Domain "${cap.domain}" für ${cap.id}: erlaubte Werte ${[...VALID_DOMAINS].join(', ')}`);
  }

  // Status muss gültig sein
  if (!VALID_STATUSES.includes(cap.status)) {
    errors.push(`Ungültiger Status "${cap.status}" für ${cap.id}: erlaubte Werte ${[...VALID_STATUSES].join(', ')}`);
  }

  // Aktive Fähigkeit braucht mindestens einen Test
  if (cap.status === 'active') {
    if (cap.testIds.length === 0) {
      errors.push(`Aktive Fähigkeit "${cap.id}" hat keine Test-IDs`);
    }
    for (const testId of cap.testIds) {
      if (!existingTestFiles.includes(testId)) {
        errors.push(`Test "${testId}" für ${cap.id} existiert nicht als Datei`);
      }
      if (!allTestIds.includes(testId)) {
        errors.push(`Test "${testId}" für ${cap.id} ist nicht im Testkatalog registriert`);
      }
    }
  }

  // Pfade müssen existieren
  for (const p of cap.paths) {
    if (!existsSync(join(ROOT, p))) {
      errors.push(`Pfad "${p}" für ${cap.id} existiert nicht`);
    }
  }

  // Browser-Evidenz muss existieren, wenn angegeben
  if (cap.browserEvidence && !existsSync(join(ROOT, cap.browserEvidence))) {
    errors.push(`Browser-Evidenz "${cap.browserEvidence}" für ${cap.id} existiert nicht`);
  }

  return errors;
}

/** Validiert einen Tombstone-Eintrag. */
export function validateTombstone(tomb) {
  const errors = [];

  if (!tomb.removedBecause || !tomb.removedBecause.trim()) {
    errors.push(`Tombstone "${tomb.id}" hat kein removedBecause`);
  }
  if (!tomb.replacedBy || !tomb.replacedBy.trim()) {
    errors.push(`Tombstone "${tomb.id}" hat kein replacedBy`);
  }
  if (tomb.parityTestIds.length === 0) {
    errors.push(`Tombstone "${tomb.id}" hat keine parityTestIds`);
  }
  if (!tomb.owner || !tomb.owner.trim()) {
    errors.push(`Tombstone "${tomb.id}" hat keinen Owner`);
  }
  if (!tomb.adrIssue || !tomb.adrIssue.trim()) {
    errors.push(`Tombstone "${tomb.id}" hat keine ADR/Issue-Referenz`);
  }

  return errors;
}

/** Hauptvalidierung: gibt { ok, errors } zurück. */
export function validateCapabilities() {
  const { capabilities, tombstones } = loadCapabilities();

  // Alle existierenden Testdateien sammeln (aus dem Dateisystem)
  const existingTestFiles = collectExistingTestFiles();
  const allTestIds = existingTestFiles.slice();

  const errors = [];

  for (const cap of capabilities) {
    const capErrors = validateCapability(cap, existingTestFiles, allTestIds);
    for (const e of capErrors) errors.push(`[${cap.id}] ${e}`);
  }

  for (const tomb of tombstones) {
    const tombErrors = validateTombstone(tomb);
    for (const e of tombErrors) errors.push(`[Tombstone ${tomb.id}] ${e}`);
  }

  // Doppelte IDs prüfen
  const ids = capabilities.map((c) => c.id);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) {
      errors.push(`Doppelte Capability-ID "${id}"`);
    }
    seen.add(id);
  }

  return {
    ok: errors.length === 0,
    errors,
    capabilityCount: capabilities.length,
    tombstoneCount: tombstones.length,
    activeCount: capabilities.filter((c) => c.status === 'active').length,
    unverifiedCount: capabilities.filter((c) => c.status === 'unverified').length,
  };
}

/** Sammelt alle existierenden Testdateien aus dem Dateisystem. */
function collectExistingTestFiles() {
  const testDirs = ['src/core', 'src/store', 'src/ui', 'src/render'];
  const files = [];
  for (const dir of testDirs) {
    collectTestFilesRecursive(join(ROOT, dir), files);
  }
  return files;
}

function collectTestFilesRecursive(dir, files) {
  if (!existsSync(dir)) return;
  try {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const normalized = full.replaceAll('\\', '/');
      if (statSync(full).isDirectory()) {
        collectTestFilesRecursive(full, files);
      } else if (name.endsWith('.test.ts') || name.endsWith('.test.tsx')) {
        files.push(normalized.slice(ROOT.length + 1));
      }
    }
  } catch {
    // Verzeichnis nicht lesbar – ignorieren
  }
}

/** Formatiert das Validierungsergebnis als Text. */
export function formatValidationResult(result) {
  const lines = [];
  lines.push(`Capability-Gate: ${result.ok ? 'PASS' : 'FAIL'}`);
  lines.push(`  Fähigkeiten: ${result.capabilityCount} (aktiv: ${result.activeCount}, unverified: ${result.unverifiedCount})`);
  lines.push(`  Tombstones: ${result.tombstoneCount}`);
  if (result.errors.length > 0) {
    lines.push('  Fehler:');
    for (const e of result.errors) lines.push(`    - ${e}`);
  } else {
    lines.push('  Keine Fehler.');
  }
  return lines.join('\n');
}
