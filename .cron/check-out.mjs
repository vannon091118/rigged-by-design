#!/usr/bin/env node
/**
 * check-out — State schreiben und Lock freigeben (#835).
 *
 * Reihenfolge: Halterpruefung, `state:JSON` am State-Issue #677 schreiben,
 * danach den Ref loeschen. Ein fremder oder fehlender Lock gibt nichts frei;
 * ein Schreibfehler bricht vor der Freigabe ab, damit der TTL eingesammelt wird.
 *
 * Aufruf: node .cron/check-out.mjs '<state-json>' [--owner X --claim-id Y]
 *         node .cron/check-out.mjs --state-file state.json --owner X --claim-id Y
 * Exit 0 = State geschrieben und Lock frei, 1 = nicht Halter, 2 = Fehler.
 */
import { readFileSync } from 'node:fs';
import { createClient } from './lib/github.mjs';
import { readLock, releaseLock } from './lib/lock.mjs';

const ISSUE_NUMBER = 677;
const argv = process.argv.slice(2);
const args = { _: [] };
for (let index = 0; index < argv.length; index += 1) {
  const token = argv[index];
  if (token.startsWith('--')) {
    const next = argv[index + 1];
    if (next && !next.startsWith('--')) {
      args[token.slice(2)] = next;
      index += 1;
    } else args[token.slice(2)] = true;
  } else args._.push(token);
}

/** `LOCKED_AT` entfernen und den state:JSON-Block ersetzen oder anfuegen. */
function mergeState(body, json) {
  const marker = '```json\n';
  const endMarker = '\n```';
  const clean = String(body ?? '').split('\n').filter((line) => !line.trim().startsWith('LOCKED_AT:')).join('\n');
  if (clean.includes(marker)) {
    const before = clean.split(marker)[0];
    const rest = clean.split(endMarker).slice(1).join(endMarker);
    return before + marker + json + endMarker + rest;
  }
  return `${clean}\n\n## state:JSON\n\n${marker}${json}${endMarker}`;
}

const owner = String(args.owner ?? process.env.RBD_LOCK_OWNER ?? 'maintainer');
const claimId = String(args['claim-id'] ?? process.env.RBD_LOCK_CLAIM_ID ?? '');
let stateJson = args.state ?? args._[0];
if (args['state-file']) stateJson = readFileSync(String(args['state-file']), 'utf8');
if (!stateJson) {
  console.error("Usage: node .cron/check-out.mjs '<state-json>' [--owner X --claim-id Y]");
  process.exit(2);
}
if (!claimId) {
  console.error('ERROR: --claim-id/RBD_LOCK_CLAIM_ID fehlt; ohne Claim-ID wird nichts freigegeben');
  process.exit(2);
}

try {
  const api = createClient({ token: process.env.GITHUB_TOKEN });
  const current = await readLock({ api });
  if (!current) {
    console.error('NOT_LOCKED: kein Lock vorhanden; State wird nicht geschrieben');
    process.exit(1);
  }
  if (current.record.owner !== owner || current.record.claimId !== claimId) {
    console.error(`NOT_HOLDER: Lock gehoert ${current.record.owner}/${current.record.claimId}`);
    process.exit(1);
  }
  const issue = await api.getIssue(ISSUE_NUMBER);
  await api.patchIssue(ISSUE_NUMBER, mergeState(issue?.body, stateJson));
  const released = await releaseLock({ api, owner, claimId });
  console.log(JSON.stringify({ written: ISSUE_NUMBER, ...released }, null, 2));
  process.exit(released.status === 'released' ? 0 : 1);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
