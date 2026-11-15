#!/usr/bin/env node
/**
 * check-in — atomare Reservierung des Maintainer-Locks (#835).
 *
 * Der Lock ist ein Git-Ref, kein Lese-Schreib-Zyklus: `POST /git/refs` legt
 * `refs/heads/rbd-lock/maintainer-cron` genau einmal an. Ein zweiter Lauf
 * erhaelt 422 und verliert; damit gibt es bei einem freien Lock genau einen
 * Gewinner. Der Lock-Commit traegt Halter, Claim-ID und Aufnahmezeit; nach TTL
 * wird ein haengender Lock genau einmal eingesammelt.
 *
 * Exit 0 = Lock erlangt, 1 = Lock belegt (kein Gewinner), 2 = API-Fehler.
 */
import { createClient } from './lib/github.mjs';
import { DEFAULT_TTL_MS, acquireLock } from './lib/lock.mjs';

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

const owner = String(args.owner ?? process.env.RBD_LOCK_OWNER ?? 'maintainer');
const claimId = String(
  args['claim-id'] ?? process.env.RBD_LOCK_CLAIM_ID ?? `lock-${process.pid}-${Date.now()}`,
);
const ttlMs = Number(args.ttl ?? process.env.RBD_LOCK_TTL_MS ?? DEFAULT_TTL_MS);
if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
  console.error('ERROR: TTL muss eine positive Millisekundenzahl sein');
  process.exit(2);
}

try {
  const api = createClient({ token: process.env.GITHUB_TOKEN });
  const result = await acquireLock({ api, owner, claimId, ttlMs });
  console.log(JSON.stringify({ ...result, claimId, ttlMs }, null, 2));
  process.exit(result.status === 'busy' ? 1 : 0);
} catch (error) {
  console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(2);
}
