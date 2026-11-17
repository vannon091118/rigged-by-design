/**
 * Register-Befehle, die Claims anlegen oder fortschreiben: add und update.
 * Pfade und atomare Writes kommen aus `claim-register-io.mjs`.
 */
import { existsSync, renameSync, writeFileSync } from 'node:fs';
import { BRANCH_PATTERN, LEGACY_PREFIXES, OWNERS } from './lane-claim-schema.mjs';
import { LaneClaim } from './lane-claim.mjs';

export function addClaim({ io, fail }) {
  const { options } = io;
  const id = io.requireId();
  const owner = options.owner;
  if (!owner) fail('--owner fehlt');
  if (!OWNERS.includes(owner)) fail(`Owner '${owner}' ist nicht im Roster (${OWNERS.join(', ')})`);
  const branch = options.branch ?? id;
  if (!BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
    fail(`Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>`);
  }
  const task = options.task;
  if (!task) fail('--task fehlt: Task-Ziel ist Teil des Arbeitsvertrags');
  const issue = options.issue === undefined ? null : Number(options.issue);
  if (options.issue !== undefined && (!Number.isInteger(issue) || issue <= 0)) fail(`--issue '${options.issue}' ist keine Issue-Nummer`);
  if (options.allow.length === 0) fail('mindestens ein --allow-Pfad ist erforderlich');

  const existing = io.loadForCommand();
  if (existing.some((claim) => claim.id === id)) fail(`Claim '${id}' ist bereits registriert`);
  if (existing.some((claim) => claim.branch === branch)) fail(`Branch '${branch}' hat bereits einen Claim`);
  const parallel = existing.filter((claim) => claim.status === 'open' && claim.owner === owner);
  if (parallel.length > 0 && !options.parallel) {
    fail(
      `${owner} haelt bereits ${parallel.length} offenen Claim(s): ${parallel.map((claim) => claim.id).join(', ')}; ` +
        "erst 'claim:register release --id <id> --reason <text>' oder bewusst --parallel setzen",
    );
  }

  const file = io.claimFileFor(id);
  if (existsSync(file)) fail(`${file} existiert bereits; bestehende Claims werden nicht ueberschrieben`);
  const allowlist = [...new Set([...options.allow, `.lane-claims/claims/${file.split(/[\\/]/).pop()}`])];
  const claim = new LaneClaim({
    id,
    owner,
    branch,
    baseSha: io.baseSha(),
    task,
    goal: options.goal ?? '',
    issue,
    pathAllowlist: allowlist,
    gateProfile: options['gate-profile'] ?? 'light',
    status: 'open',
  });
  io.validateOrFail(claim.toJSON());
  io.writeAtomic(file, claim.toJSON(), { overwrite: false });
  io.printClaim(claim.toJSON());
}

export function updateClaim({ io, fail }) {
  const { options } = io;
  const id = io.requireId();
  const existingFiles = io.entryFiles();
  const all = io.loadForCommand();
  const current = all.find((claim) => claim.id === id);
  if (!current) fail(`Claim '${id}' ist nicht registriert`);
  const next = { ...current.toJSON() };
  if (options.owner !== undefined) next.owner = options.owner;
  if (options.branch !== undefined) next.branch = options.branch;
  if (options.task !== undefined) next.task = options.task;
  if (options.goal !== undefined) next.goal = options.goal;
  if (options.issue !== undefined) next.issue = Number(options.issue);
  if (options.base !== undefined) next.baseSha = options.base;
  if (options['gate-profile'] !== undefined) next.gateProfile = options['gate-profile'];
  if (options.status !== undefined) next.status = options.status;
  if (options.allow.length > 0) next.pathAllowlist = [...new Set(options.allow)];
  if (!['open', 'merged', 'archived', 'parked', 'superseded'].includes(next.status)) fail(`Status '${next.status}' ist unbekannt`);
  const legacy = !existingFiles.has(id);
  io.validateOrFail(next, { legacy });

  if (!legacy) {
    io.writeAtomic(existingFiles.get(id), next);
  } else {
    try {
      io.withLegacyLock(() => {
        const entries = io.readEntries(io.legacyFile);
        const index = entries.findIndex((entry) => entry.id === id);
        if (index < 0) throw new Error(`Claim '${id}' ist nicht im Legacy-Register`);
        entries[index] = next;
        const temp = `${io.legacyFile}.new`;
        writeFileSync(temp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
        renameSync(temp, io.legacyFile);
      });
    } catch (error) {
      fail(error instanceof Error ? error.message : 'Legacy-Update fehlgeschlagen');
    }
  }
  io.printClaim(next);
}
