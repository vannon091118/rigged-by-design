#!/usr/bin/env node
/**
 * merge-driver-generated: git-Merge-Driver fuer generierte Artefakte (#877).
 *
 * Generierte Dateien werden nicht verhandelt. Der Driver nimmt die eigene
 * Fassung des Artefakts und erklaert den Konflikt damit als aufgeloest; die
 * inhaltliche Wahrheit entsteht anschliessend im `post-merge`-Hook aus den
 * dann vollstaendig gemischten Quellen.
 *
 * Warum nicht im Driver selbst regenerieren: git ruft den Driver waehrend des
 * Merges pro Pfad auf, nicht nach dem letzten Pfad. Eine Regeneration dort
 * liest einen halb gemischten Arbeitsbaum und schreibt still falschen Inhalt.
 *
 * Fail-closed: nur Pfade der Generated-Liste werden uebernommen. Handdateien,
 * eine fehlende Arbeitsdatei oder Konfliktmarker in der eigenen Fassung lassen
 * den Konflikt offen (Exit 1). Es gibt keine zweite Liste generierter Pfade.
 *
 * Registrierung: `pnpm run hooks:install` setzt `merge.generated-regenerate.*`
 * repo-lokal, `.gitattributes` weist die Pfade zu. Fehlt die Registrierung,
 * bleibt das Standardverhalten von git (Konflikt) bestehen.
 *
 * Aufruf durch git: `<driver> %O %A %B %P` (Basis, unsere, ihre, Pfad).
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GENERATED_FILES, isGeneratedPath } from './lib/generated-files.mjs';

export const DRIVER_NAME = 'generated-regenerate';
export const DRIVER_SCRIPT = 'scripts/merge-driver-generated.mjs';
export const CONFLICT_MARKER = /^(?:<{7}|={7}|>{7})(?:\s|$)/m;

/** git uebergibt %O %A %B %P; aeltere Versionen ohne %P. */
export function parseDriverArgs(argv = []) {
  const [base = '', ours = '', theirs = '', path = ''] = argv;
  return { base, ours, theirs, path: String(path).replaceAll('\\', '/') };
}

/** Der repo-lokale git-config-Wert fuer `merge.<name>.driver`. */
export function driverCommand({ node = process.execPath, script = DRIVER_SCRIPT } = {}) {
  return `"${node}" ${script} %O %A %B %P`;
}

export function hasConflictMarkers(text) {
  return CONFLICT_MARKER.test(String(text ?? ''));
}

/** Nur registrierte generierte Pfade duerfen automatisch aufgeloest werden. */
export function classifyDriverPath(path) {
  const clean = String(path ?? '').replaceAll('\\', '/');
  if (!isGeneratedPath(clean)) {
    return { accepted: false, reason: 'Handdatei: Konflikt bleibt offen' };
  }
  return { accepted: true, owner: GENERATED_FILES[clean].owner };
}

/**
 * Loest den Konflikt, indem die eigene Fassung des generierten Artefakts
 * bestehen bleibt. Die Regeneration folgt im `post-merge`-Hook.
 * @returns {{ok: boolean, path: string, owner?: string, bytes?: number, reason?: string}}
 */
export function resolveGeneratedConflict({ path, ours, read = readFileSync } = {}) {
  const verdict = classifyDriverPath(path);
  if (!verdict.accepted) return { ok: false, path, reason: verdict.reason };
  if (!ours) return { ok: false, path, reason: 'keine Arbeitsdatei von git uebergeben' };

  let content;
  try {
    content = String(read(ours, 'utf8'));
  } catch {
    return { ok: false, path, reason: 'Arbeitsdatei nicht lesbar' };
  }
  if (hasConflictMarkers(content)) {
    return { ok: false, path, reason: 'Arbeitsdatei enthaelt Konfliktmarker' };
  }
  return { ok: true, path, owner: verdict.owner, bytes: Buffer.byteLength(content) };
}

const invokedDirectly = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const { path, ours } = parseDriverArgs(process.argv.slice(2));
  const result = resolveGeneratedConflict({ path, ours });
  if (!result.ok) {
    console.error(`merge-driver: ${result.reason} (${path || 'ohne Pfad'})`);
    process.exit(1);
  }
  console.error(`merge-driver: ${result.path} konfliktfrei uebernommen; Regeneration folgt im post-merge (${result.bytes} B)`);
  process.exit(0);
}
