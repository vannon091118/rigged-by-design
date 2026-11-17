#!/usr/bin/env node
/**
 * verify-lane-claims: Prüft, ob der aktuelle Branch einen Lane-Claim hat,
 * alle gestagten Dateien innerhalb der Allowlist liegen, die Meta-Dateien
 * für Feature-Lanes gesperrt bleiben und keine Kollision mit einer anderen
 * offenen Lane besteht.
 *
 * Die Meta-Sperre lässt genau den Schreibpfad des Systems durch: Doku-Marker,
 * Versionszeile und Lockfile-Zeile. Jede andere Änderung an einer Meta-Datei
 * braucht einen Claim, der den Pfad ausdrücklich führt.
 *
 * Exit 0 = OK, Exit 1 = Claim fehlt, Verletzung oder Kollision.
 */
import { execFileSync } from 'node:child_process';
import {
  loadClaimsStrict,
  findCollisions,
  META_FILES,
  OWNERS,
  BRANCH_PATTERN,
  LEGACY_PREFIXES,
  selectClaim,
  botClaim,
} from './lib/lane-claims.mjs';
import { filterMergedCollisions } from './lib/claim-merge-filter.mjs';
import { auditRegisterBase } from './lib/lane-claim-register-check.mjs';
import { collectDiffScope, stackedBase } from './lib/lane-claim-diff.mjs';
import { classifyStaged } from './lib/lane-claim-staged.mjs';
import { report, reportLaneGreen } from './lib/lane-claim-report.mjs';
import { captureConsole } from './lib/compact.mjs';

const notes = [];
const mergedNotes = [];
let registerAudited = false;

const git = (args) => execFileSync('git', args, { encoding: 'utf8', errors: 'replace' }).trim();

// `--ci` prüft den PR-Diff gegen die Basis statt den lokalen Index. Ohne diesen
// Modus waere die Claim-Sperre nur lokal: ein Cloud-Agent ohne Hooks schriebe
// ausserhalb jeder Allowlist, und niemand saehe es.
const CI = process.argv.includes('--ci');
captureConsole({ label: 'verify-claims' });
const DECLARED_BASE = process.env.BASE_REF ?? 'origin/main';
// Ohne HEAD_REF prueft der CI-Modus den ausgecheckten Stand. Fuer eine
// Vorabpruefung aller Lanes von einem Branch aus laesst sich damit die
// Remote-Ref der jeweiligen Lane als Diff-Kopf setzen.
const HEAD_REF = process.env.HEAD_REF ?? 'HEAD';

const branch = process.env.BRANCH || (CI ? process.env.GITHUB_HEAD_REF : '') || git(['rev-parse', '--abbrev-ref', 'HEAD']);

// Fail-closed: ein kaputtes oder fehlendes Register ist ein Befund, kein Freibrief.
let allClaims;
try {
  allClaims = loadClaimsStrict();
} catch (error) {
  report({
    status: 'ROT',
    headline: `${branch} · Claim-Register nicht lesbar`,
    facts: [['Basis', DECLARED_BASE]],
    findings: [
      `[ERR-4019] Claim-Register nicht lesbar (${error instanceof Error ? error.message : 'unbekannt'}).`,
      'Governance ist fail-closed: erst das Register reparieren, dann committen.',
    ],
  });
  process.exit(1);
}

/** Genau ein Claim pro Lane-ID und pro Branch. Doppelte Eintraege sind ein Loch. */
for (const key of ['id', 'branch']) {
  const seen = new Set();
  for (const entry of allClaims) {
    if (seen.has(entry[key])) {
      report({
        status: 'ROT',
        headline: `${branch} · doppelter ${key} im Claim-Register`,
        facts: [['Basis', DECLARED_BASE]],
        findings: [`[ERR-4019] doppelter ${key} '${entry[key]}' im Claim-Register.`],
      });
      process.exit(1);
    }
    seen.add(entry[key]);
  }
}

const claims = allClaims.filter((c) => c.status === 'open');
// Ein gemergter Claim gilt fuer seinen eigenen Branch weiter: so landet der
// Register-Nachtrag auf dem Branch der zuletzt gemergten Lane, ohne dass ein
// neuer offener Claim mit bereits gemergtem PR entsteht.
const laneClaim = selectClaim(allClaims, branch);
const claim = laneClaim ?? botClaim(branch);
const bot = laneClaim === null && claim !== null;

const BASE_REF = process.env.BASE_REF || stackedBase({ declared: claim, headRef: HEAD_REF, defaultBase: DECLARED_BASE, git });
const RANGE = CI ? `${BASE_REF}...${HEAD_REF}` : null;

// Ein Merge bringt fremde Arbeit mit. Bewertet wird nur, was der Branch
// gegenueber der Basis wirklich selbst hinzufuegt - sonst wuerde jeder Merge
// von main als Lane-Verstoss gelten und liesse sich nie committen.
const MERGING = (() => {
  try {
    return git(['rev-parse', '-q', '--verify', 'MERGE_HEAD']) !== '';
  } catch {
    return false;
  }
})();
const DIFF_BASE = CI ? RANGE : (MERGING ? BASE_REF : null);

/**
 * `main` ist der geschützte Zweig: dort gilt der Remote-Schutz ohne
 * Required-Status, nicht die Lane-Allowlist. Der PR-Check "Fail-Closed Gates"
 * ist optional. Ein Claim auf main wäre eine zweite Wahrheit neben dem
 * Branch-Schutz.
 */
if (branch === 'main') {
  report({
    status: 'GRUEN',
    headline: `${branch} · Branch-Schutz statt Lane-Allowlist`,
    facts: [['Claim', 'main braucht keinen Lane-Claim'], ['Basis', BASE_REF]],
  });
  process.exit(0);
}

if (!claim) {
  report({
    status: 'ROT',
    headline: `${branch} · kein Lane-Claim`,
    facts: [['Basis', BASE_REF]],
    findings: [
      `[ERR-4019] Kein Lane-Claim für Branch '${branch}' in .lane-claims/`,
      'Erst einen Claim mit `pnpm run claim:register` registrieren (AGENTS.md § Governance / Lanes).',
    ],
  });
  process.exit(1);
}

/** Feste Owner: eine Lane ohne benannten Owner ist keine Lane. */
if (!bot && !OWNERS.includes(claim.owner)) {
  report({
    status: 'ROT',
    headline: `${branch} · Owner nicht im Roster`,
    facts: [['Basis', BASE_REF]],
    findings: [`[ERR-4019] Owner '${claim.owner}' ist nicht im festen Roster (${OWNERS.join(', ')}).`],
  });
  process.exit(1);
}

if (!bot && !BRANCH_PATTERN.test(branch) && !LEGACY_PREFIXES.some((prefix) => branch.startsWith(prefix))) {
  report({
    status: 'ROT',
    headline: `${branch} · Branch-Schema verletzt`,
    facts: [['Basis', BASE_REF]],
    findings: [`[ERR-4019] Branch '${branch}' folgt nicht dem Schema lane/<domäne>/<task>.`],
  });
  process.exit(1);
}

if (claim.status === 'merged') {
  notes.push(`'${claim.id}' ist gemergt; der Branch fuehrt unter derselben Allowlist weiter.`);
}

/**
 * Die Basis ist die vertrauenswuerdige Wahrheit fuer die Allowlist. Zusaetzlich
 * zaehlt die erste Beruehrung des Registers im PR als Registrierung.
 */
const registerAudit = auditRegisterBase({ baseRef: BASE_REF, headRef: HEAD_REF, allClaims, branch });
if (registerAudit.unreadable) {
  if (CI) {
    report({
      status: 'ROT',
      headline: `${branch} · Basis-Register nicht lesbar`,
      facts: [['Basis', BASE_REF]],
      findings: [`[ERR-4019] Claim-Register der Basis '${BASE_REF}' nicht lesbar; ohne Basis keine Freigabe.`],
    });
    process.exit(1);
  }
  notes.push(`[ERR-4019] Basis-Register '${BASE_REF}' nicht lesbar; Basis-Audit lokal uebersprungen.`);
} else if (!registerAudit.ok) {
  report({
    status: 'ROT',
    headline: `${branch} · Claim-Register gegen die Basis veraendert`,
    facts: [['Basis', BASE_REF]],
    findings: registerAudit.violations.map((entry) => `[ERR-4019] ${entry}`),
    details: ['Eine Lane erweitert weder ihre eigene Allowlist noch fremde Claims; Registerpflege ist Governance.'],
  });
  process.exit(1);
} else {
  registerAudited = true;
}

// Die acht Meta-Dateien kommen aus scripts/lib/lane-claims.mjs: eine Liste fuer
// Gate und turn:finish, damit die Sperre nicht an zwei Stellen driftet.

const { staged, mergedClaims, deletedFiles } = collectDiffScope({
  git, diffBase: DIFF_BASE, ci: CI, merging: MERGING, allClaims,
});

const classified = classifyStaged({
  claim, staged, deletedFiles, mergedClaims, allClaims, git, diffBase: DIFF_BASE,
});
const { violations, allowedBySystem, generatedMeta, inherited, handedOver } = classified;

if (violations.length > 0) {
  report({
    status: 'ROT',
    headline: `${branch} · ${violations.length} Pfad(e) ausserhalb der Allowlist`,
    facts: [['Claim', `${claim.id} (${claim.owner})`], ['Basis', BASE_REF]],
    findings: violations.map((entry) => `[ERR-4019] ${entry}`),
    details: [
      `Erlaubte Pfade: ${claim.pathAllowlist.join(', ')}`,
      `Meta-Dateien (gesperrt): ${META_FILES.join(', ')}`,
    ],
  });
  process.exit(1);
}

// Eine Lane, deren Arbeit nachweislich gemergt ist, ist keine Kollision mehr,
// sondern ein veralteter Eintrag. Der geteilte Filter kennt beide Belege: den
// gemergten PR (braucht `gh`) und den baumgleichen Commit auf `main` aus der
// lokalen Historie (Squash-Merge, kein `gh` noetig). Ohne jeden Nachweis
// bleibt es fail-closed bei der Kollision. Pretask nutzt denselben Filter,
// damit Start und Gate nicht auseinanderlaufen.
const collisions = bot
  ? []
  : filterMergedCollisions({
      collisions: findCollisions(claim),
      claims,
      baseRef: BASE_REF,
      onMerged: (collision, evidence) => {
        mergedNotes.push(`${collision.lane}: ${evidence.why}; als merged behandelt (Register nachziehen)`);
      },
    });
if (collisions.length > 0) {
  report({
    status: 'ROT',
    headline: `${branch} · ${collisions.length} Lane-Kollision(en)`,
    facts: [['Claim', `${claim.id} (${claim.owner})`], ['Basis', BASE_REF]],
    findings: collisions.flatMap((coll) => [
      `[ERR-4019] vs ${coll.lane}: ${coll.reason}`,
      ...(coll.contractConflict.length > 0 ? [`  Contract-Konflikt: ${coll.contractConflict.join(', ')}`] : []),
    ]),
  });
  process.exit(1);
}

reportLaneGreen({
  branch, staged, ci: CI, range: RANGE, merging: MERGING, diffBase: DIFF_BASE,
  claim, baseRef: BASE_REF, headRef: HEAD_REF, registerAudited,
  inherited, handedOver, mergedNotes, notes, allowedBySystem, generatedMeta,
});
process.exit(0);
