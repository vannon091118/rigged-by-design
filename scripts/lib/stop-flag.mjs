#!/usr/bin/env node
/**
 * stop-flag.mjs — Zentrale Prüfung der stop.flag vor jedem Agent-Schritt.
 *
 * Bei Vorhandensein einer Datei `stop.flag` im Repo-Root bricht das Skript
 * mit Exit-Code 1 ab und meldet den Stopp an den Maintainer. Fehlt die
 * Datei, läuft der Loop weiter (Exit 0).
 *
 * Usage: node scripts/lib/stop-flag.mjs [--root <pfad>]
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const rootIdx = argv.indexOf('--root');
const ROOT = rootIdx >= 0 && argv[rootIdx + 1] ? argv[rootIdx + 1] : process.cwd();

const stopFlagPath = join(ROOT, 'stop.flag');

if (existsSync(stopFlagPath)) {
  console.error('[stop-flag] stop.flag vorhanden — Loop gestoppt. Meldung an maintainer.');
  process.exit(1);
}

console.log('[stop-flag] stop.flag nicht vorhanden — Loop läuft.');
process.exit(0);
