#!/usr/bin/env node
/**
 * PR Watcher – erstellt Issues bei rotem Gate, Timeout oder fehlerhaftem PR-Body
 * und schliesst erledigte Issues, wenn `main` gruen ist.
 *
 * Aufruf durch .github/workflows/pr-watcher.yml.
 * Liefert einem Agenten alle Infos, um das Issue zu loesen und den Merge
 * durchzubekommen.
 */
import { execFileSync } from 'node:child_process';
import { CATALOG } from './lib/error-codes.mjs';
import { loadClaims } from './lib/lane-claims.mjs';

const REPO = process.env.GITHUB_REPOSITORY ?? 'vannon091118/rigged-by-design';
const GH_TOKEN = process.env.GH_TOKEN;

const SECTIONS = [
  '### Changes (Was ist neu)',
  '### Technische Basis & Kausalität',
  '### Ausblick (Nächste Schritte)',
];

function api(method, path, body) {
  const url = `https://api.github.com/repos/${REPO}${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `Bearer ${GH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'opencode-pr-watcher',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  return fetch(url, opts);
}

/** Fingerprint = Fehlercode + erste Fehlerzeile aus dem Gate-Log. */
function fingerprintOf(code, firstLine) {
  return `fp:${code}:${firstLine.trim().slice(0, 160)}`;
}

/**
 * Einzige Issue-Suche: Fingerprint zuerst (offen oder geschlossen, dann nur Zaehlung),
 * sonst Titel unter den offenen Issues desselben Labels.
 */
async function findIssue(fingerprint, title) {
  const res = await api('GET', '/issues?state=all&per_page=100');
  if (!res.ok) return undefined;
  const issues = await res.json();
  const byFingerprint = issues.find((i) => (i.body ?? '').includes(`<!-- ${fingerprint} -->`));
  if (byFingerprint) return { issue: byFingerprint, recurring: true };
  const byTitle = issues.find((i) => i.state === 'open' && i.title === title);
  return byTitle ? { issue: byTitle, recurring: false } : undefined;
}

/** Zählt Vorkommen über Kommentare "Vorgekommen: N mal" und hängt den neuen Lauf an. */
async function recordRecurrence(issue, runUrl, body, labels) {
  const res = await api('GET', `/issues/${issue.number}/comments?per_page=100`);
  const comments = res.ok ? await res.json() : [];
  const counts = comments.map((c) => /Vorgekommen: (\d+) mal/.exec(c.body ?? '')).filter(Boolean);
  const previous = counts.length > 0 ? Math.max(...counts.map((m) => Number(m[1]))) : 1;
  const count = previous + 1;
  await api('POST', `/issues/${issue.number}/comments`, { body: `Vorgekommen: ${count} mal, zuletzt ${runUrl}` });
  if (issue.state === 'closed') {
    await api('PATCH', `/issues/${issue.number}`, { state: 'open', state_reason: 'reopened', title: issue.title, body });
  } else {
    await api('PATCH', `/issues/${issue.number}`, { title: issue.title, body });
  }
  if (labels?.length) await api('POST', `/issues/${issue.number}/labels`, { labels });
  console.log(issue.state === 'closed'
    ? `Issue #${issue.number} wegen erneutem Befund wieder geoeffnet (${count} mal).`
    : `Issue #${issue.number} aktualisiert (${count} mal).`);
}

async function createIssue(title, body, labels, fingerprint, runUrl) {
  const found = await findIssue(fingerprint, title);
  if (found?.recurring) {
    await recordRecurrence(found.issue, runUrl, `${body}\n<!-- ${fingerprint} -->\n`, labels);
    return found.issue;
  }
  if (found) {
    await api('POST', `/issues/${found.issue.number}/comments`, { body: `Erneuter Befund auf ${runUrl}.\n\n${body}` });
    if (labels?.length) await api('POST', `/issues/${found.issue.number}/labels`, { labels });
    console.log(`Issue existiert bereits und wurde ergaenzt: #${found.issue.number}`);
    return found.issue;
  }
  const res = await api('POST', '/issues', {
    title,
    body: `${body}\n<!-- ${fingerprint} -->\n`,
    labels,
  });
  if (!res.ok) {
    const err = await res.text();
    console.error(`Issue-Erstellung fehlgeschlagen: ${res.status} ${err}`);
    process.exit(1);
  }
  const issue = await res.json();
  console.log(`Issue erstellt: #${issue.number} ${issue.html_url}`);
  return issue;
}

async function getWorkflowRunJobs(runId) {
  const res = await api('GET', `/actions/runs/${runId}/jobs`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.jobs ?? [];
}

async function getFailedJobDetails(runId) {
  const jobs = await getWorkflowRunJobs(runId);
  const failed = jobs.filter((j) => j.conclusion === 'failure');
  if (failed.length === 0) return 'Kein spezifisch fehlgeschlagener Job gefunden.';
  const details = failed.map((j) => {
    const steps = (j.steps ?? []).filter((s) => s.conclusion === 'failure');
    const stepDetails = steps.map((s) => `  - ${s.name}: ${s.conclusion}`).join('\n');
    return `Job: ${j.name}\n${stepDetails}`;
  });
  return details.join('\n\n');
}

/**
 * Fehlercode aus einem Job-Log.
 *
 * Der Code darf nur aus einem tatsaechlich roten Befund stammen. Die alte
 * Fassung nahm die erste Zeile mit irgendeinem ERR-Code - also auch eine
 * PASS-Zeile eines erfolgreichen Tests. Genau so wurde aus einem
 * Registerfehler ein RTP-Issue.
 */
function errorFromLog(text) {
  const lines = text.split(/\r?\n/);
  const reporterFailure = lines.find((line) => /\[IDX-\d{4}\] \[ERR-\d{4}\].*:\s*FAIL\s*$/.test(line.trim()));
  if (reporterFailure) {
    const code = /(ERR-\d{4})/.exec(reporterFailure)?.[1];
    const failedTest = /((?:src|scripts)\/[^\s:]+?\.[cm]?[jt]sx?)(?=:)/.exec(reporterFailure)?.[1] ?? null;
    if (code) return { code, firstLine: reporterFailure.trim().slice(0, 180), failedTest };
  }
  const vitestFailure = lines.find((line) => /^\s*FAIL\s+(?:src|scripts)\//.test(line));
  const gateFailure = [...lines].reverse().find((line) => /\[IDX-\d{4}\] \[ERR-\d{4}\].*Gate fehlgeschlagen/.test(line));
  if (!gateFailure && !vitestFailure) return null;
  const gateName = /pipeline\/([^:]+):/.exec(gateFailure ?? '')?.[1];
  const code = gateName === 'tests' && vitestFailure
    ? 'ERR-4026'
    : /(ERR-\d{4})/.exec(gateFailure ?? '')?.[1];
  if (!code) return null;
  const failedTest = /((?:src|scripts)\/[^\s:]+?\.[cm]?[jt]sx?)/.exec(vitestFailure ?? '')?.[1] ?? null;
  return {
    code,
    firstLine: (reporterFailure ?? vitestFailure ?? gateFailure).trim().slice(0, 180),
    failedTest,
  };
}

/** Fehlerzeile aus den Logs der fehlgeschlagenen Jobs; sonst ERR-0000. */
async function firstGateError(runId) {
  const jobs = await getWorkflowRunJobs(runId);
  for (const job of jobs.filter((j) => j.conclusion === 'failure')) {
    const res = await api('GET', `/actions/jobs/${job.id}/logs`);
    if (!res.ok) continue;
    const found = errorFromLog(await res.text());
    if (found) return found;
  }
  return { code: 'ERR-0000', firstLine: 'Kein Fehlercode im Gate-Log gefunden', failedTest: null };
}

function gateFailureSections(body) {
  const lines = body.split(/\r?\n/);
  const missing = [];
  const empty = [];
  let previous = -1;
  for (const section of SECTIONS) {
    const at = lines.indexOf(section);
    if (at < 0) {
      missing.push(section);
      continue;
    }
    if (at < previous) empty.push(`${section} (falsche Reihenfolge)`);
    previous = at;
    const next = lines.findIndex((line, position) => position > at && line.startsWith('### '));
    const content = lines.slice(at + 1, next < 0 ? undefined : next).filter((line) => line.startsWith('- '));
    if (content.length === 0 || content.every((line) => line.length < 8)) {
      empty.push(`${section} (kein echter Inhalt)`);
    }
  }
  return { missing, empty };
}

/**
 * `main` ist gruen: Issues schliessen, deren Commit nachweislich auf main liegt.
 * Der Nachweis ist `git merge-base --is-ancestor`, nicht ein Titelvergleich.
 */
async function sweepGreenMain() {
  const res = await api('GET', '/issues?state=open&labels=gate-failure&per_page=100');
  if (!res.ok) {
    console.log(`Sweep uebersprungen: Issues nicht lesbar (${res.status}).`);
    return;
  }
  const issues = await res.json();
  let closed = 0;
  for (const issue of issues) {
    const match = /\*\*Commit:\*\*\s*`([0-9a-f]{7,40})`/.exec(issue.body ?? '');
    if (!match) continue;
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', match[1], 'origin/main'], { stdio: 'ignore' });
    } catch {
      continue; // Commit liegt nicht auf main: Issue bleibt offen.
    }
    await api('POST', `/issues/${issue.number}/comments`, {
      body: `Der Stand \`${match[1]}\` liegt auf \`main\` und \`CI Verify\` ist gruen. Issue wird geschlossen.`,
    });
    const patch = await api('PATCH', `/issues/${issue.number}`, { state: 'closed', state_reason: 'completed' });
    if (patch.ok) {
      closed += 1;
      console.log(`Issue #${issue.number} geschlossen (gruen auf main).`);
    } else {
      console.error(`Issue #${issue.number} konnte nicht geschlossen werden (${patch.status}).`);
    }
  }
  console.log(`Sweep: ${closed} Issue(s) geschlossen.`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--sweep-green')) {
    await sweepGreenMain();
    return;
  }

  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === 'workflow_run') {
    await handleWorkflowRun();
  } else if (eventName === 'pull_request' || args.includes('--pr-check')) {
    await handlePullRequest();
  } else {
    console.log(`Unbekanntes Event: ${eventName}`);
  }
}

async function handleWorkflowRun() {
  const runId = process.env.RUN_ID;
  const runUrl = process.env.RUN_URL;
  const runBranch = process.env.RUN_BRANCH;
  const runCommit = process.env.RUN_COMMIT;
  const runConclusion = process.env.RUN_CONCLUSION;
  const workflowName = process.env.RUN_WORKFLOW ?? 'CI Verify';

  // Timeout, Abbruch und Startfehler sind REMOTE_CI: kein Blocker, kein
  // Notfall, sondern ein Lauf, der wiederholt wird.
  if (['timed_out', 'cancelled', 'startup_failure'].includes(runConclusion)) {
    const title = `[REMOTE_CI] ${workflowName} ${runConclusion}: ${runBranch}`;
    const body = `## ⏱️ CI ohne Ergebnis (REMOTE_CI)

**Branch:** \`${runBranch}\`  
**Commit:** \`${runCommit}\`  
**CI Run:** <${runUrl}>  
**Ergebnis:** \`${runConclusion}\`

## Was zu tun ist

1. Lauf erneut starten (\`gh run rerun ${runId}\` oder "Re-run jobs").
2. Bleibt es beim Timeout, den Befund als \`REMOTE_CI\` (ERR-4014) behandeln und das Gate entlasten.
3. Kein \`BLOCKED\`, kein Dump auf \`integration\`: die Arbeit laeuft weiter.
`;
    await createIssue(title, body, ['remote-ci'], fingerprintOf('REMOTE_CI', `${runConclusion}:${runBranch}`), runUrl);
    return;
  }

  if (runConclusion !== 'failure') {
    console.log('CI-Run nicht rot, kein Issue nötig.');
    return;
  }

  console.log(`CI-Run rot: ${runBranch} (${runCommit}), Run ${runId}`);

  const jobDetails = await getFailedJobDetails(runId);
  const { code, firstLine, failedTest } = await firstGateError(runId);
  const fingerprint = fingerprintOf(code, firstLine);
  const definition = CATALOG.get(code);
  const claim = loadClaims().find((entry) => entry.branch === runBranch);
  const laneLabel = claim ? `lane:${claim.id}` : null;
  const advisory = workflowName === 'Long Checks' || definition?.scope === 'advisory' || definition?.scope === 'triage';
  const critical = definition?.level === 'BLOCKED' && definition?.scope === 'lane';
  const labels = [
    ...(advisory ? ['advisory'] : ['gate-failure']),
    'agent-action',
    ...(critical ? ['blocked'] : []),
    ...(laneLabel ? [laneLabel] : ['triage:unknown']),
  ];
  for (const label of labels) {
    await api('POST', '/labels', {
      name: label,
      color: label === 'blocked' ? 'b60205' : label === 'advisory' ? 'fbca04' : label.startsWith('triage:') ? '5319e7' : '0e8a16',
      description: `Issue-Scope ${label}`,
    });
  }

  const kind = advisory ? 'Advisory' : critical ? 'Lane-Blocker' : 'Gate-Befund';
  const title = `[${kind} ${code}] ${workflowName}: ${firstLine.trim().slice(0, 80)}`;
  const body = `## ${advisory ? '🟡 CI Advisory' : critical ? '🛑 Lane-Blocker' : '🚨 CI Gate rot'}

**Branch:** \`${runBranch}\`  
**Commit:** \`${runCommit}\`  
**CI Run:** <${runUrl}>  
**Error-Code:** \`${code}\` · ${definition?.level ?? 'AGENT'} / ${definition?.scope ?? 'triage'}
**Owner:** ${claim ? `\`${claim.owner}\`` : 'nicht zugeordnet; Triage erforderlich'}
**Betroffene Datei:** ${failedTest ? `\`${failedTest}\`` : 'nicht eindeutig - Log-Auszug unten'}  
**Erkannt durch:** pr-watcher.yml  
**Scope:** ${laneLabel ? `\`${laneLabel}\`` : '`triage:unknown`'}${critical ? ' · nur diese Lane und ihre Dependents halten an' : advisory ? ' · nicht erforderlich fuer den Merge, unabhaengige Arbeit laeuft weiter' : ''}

## 📋 Was der Agent tun muss

1. **Checkout des betroffenen Branches:**
   \`\`\`bash
   git checkout ${runBranch}
   git pull origin ${runBranch}
   \`\`\`

2. **Nur den betroffenen Pfad lokal pruefen:**
   \`\`\`bash
   pnpm run test:affected
   pnpm run verify:light
   \`\`\`

3. **Fehler beheben** bis die betroffenen Gates grün sind.

4. **Commit mit Pflichtsektionen erstellen:**
   \`\`\`text
   <type>: <Kurzbeschreibung>

   ### Changes (Was ist neu)
   ...

   ### Technische Basis & Kausalität
   ...

   ### Ausblick (Nächste Schritte)
   ...
   \`\`\`

5. **Auf den Branch pushen** (der CI-Run startet automatisch neu).

6. **Wenn alle erforderlichen Gates gruen:** der vorhandene PR wird von der Promotion-Queue verarbeitet.

## 🔍 Gate-Details

<details>
<summary>Fehlgeschlagene Jobs / Schritte</summary>

\`\`\`
${jobDetails}
\`\`\`

</details>

## 📎 Regeln (aus AGENTS.md)

- **Pretask zuerst:** \`pnpm run agent:pretask\`; Issues werden nach Lane und Kritikalitaet priorisiert.
- **Nur echte Invarianten blockieren:** Statistik/Balance ist Advisory, RNG-/Ledger-/Save- und deterministische Auszahlungspfadfehler blockieren die betroffene Lane.
- **Lokal leicht pruefen** (\`test:affected\`, \`verify:light\`); die volle Suite laeuft in CI.
- **Commit-Body muss** die drei Pflichtsektionen enthalten (\`### Changes\`, \`### Technische Basis & Kausalität\`, \`### Ausblick\`).

## ✅ Issue schließen

Sobald der Stand grün auf \`main\` liegt, schliesst \`pr-watcher.yml --sweep-green\` dieses Issue automatisch.
`;

  await createIssue(title, body, labels, fingerprint, runUrl);
}

async function handlePullRequest() {
  const prNumber = process.env.PR_NUMBER;
  const prBody = process.env.PR_BODY ?? '';

  if (!prBody.trim()) {
    const title = `[PR-BODY-FEHLT] PR #${prNumber}`;
    const body = `## 📋 PR ohne Body

**PR:** #${prNumber}  
**URL:** <https://github.com/${REPO}/pull/${prNumber}>  

Der PR hat keinen Body. Der PR-Body muss die drei Pflichtsektionen enthalten:

\`\`\`
### Changes (Was ist neu)
...

### Technische Basis & Kausalität
...

### Ausblick (Nächste Schritte)
...
\`\`\`

Siehe AGENTS.md für die vollständigen Regeln.
`;
    await createIssue(title, body, ['gate-failure', 'agent-action'], fingerprintOf('PR-BODY', `PR #${prNumber}`), `https://github.com/${REPO}/pull/${prNumber}`);
    return;
  }

  const { missing, empty } = gateFailureSections(prBody);

  if (missing.length > 0 || empty.length > 0) {
    const title = `[PR-BODY-UNVOLLSTÄNDIG] PR #${prNumber}`;
    const body = `## 📋 PR-Body unvollständig

**PR:** #${prNumber}  
**URL:** <https://github.com/${REPO}/pull/${prNumber}>  

Folgende Pflichtsektionen fehlen oder sind ohne echten Inhalt:

${missing.map((s) => `- \`${s}\` (fehlt komplett)`).join('\n')}${empty.length > 0 ? '\n' + empty.map((s) => `- \`${s}\``).join('\n') : ''}

Der PR-Body muss alle drei Pflichtsektionen mit echtem Inhalt enthalten:

\`\`\`
### Changes (Was ist neu)
<echter Inhalt>

### Technische Basis & Kausalität
<echter Inhalt>

### Ausblick (Nächste Schritte)
<echter Inhalt>
\`\`\`

Siehe AGENTS.md für die vollständigen Regeln.
`;
    await createIssue(title, body, ['gate-failure', 'agent-action'], fingerprintOf('PR-BODY', `PR #${prNumber}`), `https://github.com/${REPO}/pull/${prNumber}`);
  } else {
    console.log(`PR #${prNumber} Body PASS: alle Pflichtsektionen vorhanden.`);
  }
}

main().catch((err) => {
  console.error('pr-watcher Fehler:', err);
  process.exit(1);
});
