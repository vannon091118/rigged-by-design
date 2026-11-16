#!/usr/bin/env node
/**
 * verify:capabilities - Validiert das Capability-Manifest.
 *
 * Prüft:
 * 1. Schema/IDs konsistent (stabile IDs, gültige Domains/Status)
 * 2. Jede aktive Fähigkeit hat existierende, registrierte Tests
 * 3. Pfadverweise existieren
 * 4. Tombstones haben removedBecause, replacedBy, parityTestIds, Owner, ADR/Issue
 * 5. Keine doppelten IDs
 *
 * Fail-closed: Bei Fehlern exit code 1.
 */

import { validateCapabilities, formatValidationResult } from './lib/capabilities.mjs';
import { captureConsole } from './lib/compact.mjs';
// Sichtbare Antwort bleibt unter 500 Token; vollstaendig im Log.
captureConsole({ label: 'verify-capabilities' });

const result = validateCapabilities();
console.log(formatValidationResult(result));

if (!result.ok) {
  process.exit(1);
}

console.log('verify:capabilities: alle Fähigkeiten validiert, Gate grün.');
process.exit(0);
