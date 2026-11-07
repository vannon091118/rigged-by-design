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
import { diagnose } from './lib/gate-diagnostics.mjs';

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
async function findIssue(fingerprint, title, label = 'gate-failure') {
  const res = await api('GET', `/issues?state=all&labels=${label}&per_page=100`);
  if (!res.ok) return undefined;
  const issues = await res.json();
  const byFingerprint = issues.find((i) => (i.body ?? '').includes(`<!-- ${fingerprint} -->`));
  if (byFingerprint) return { issue: byFingerprint, recurring: true };
  const byTitle = issues.find((i) => i.state === 'open' && i.title === title);
  return byTitle ? { issue: byTitle, recurring: false } : undefined;
}

/** Zählt Vorkommen über Kommentare "Vorgekommen: N mal" und hängt den neuen Lauf an. */
async function recordRecurrence(issue, runUrl) {
  const res = await api('GET', `/issues/${issue.number}/comments?per_page=100`);
  const comments = res.ok ? await res.json() : [];
  const counts = comments.map((c) => /Vorgekommen: (\d+) mal/.exec(c.body ?? '')).filter(Boolean);
  const previous = counts.length > 0 ? Math.max(...counts.map((m) => Number(m[1]))) : 1;
  const count = previous + 1;
  await api('POST', `/issues/${issue.number}/comments`, {
    body: `Vorgekommen: ${count} mal, zuletzt ${runUrl}`,
  });
  if (issue.state === 'closed') {
    console.log(`Issue #${issue.number} bleibt geschlossen, Kommentar ergänzt (${count} mal).`);
  } else {
    console.log(`Issue #${issue.number} aktualisiert (${count} mal).`);
  }
}

async function createIssue(title, body, labels, fingerprint, runUrl, label = 'gate-failure') {
  const found = await findIssue(fingerprint, title, label);
  if (found?.recurring) {
    await recordRecurrence(found.issue, runUrl);
    return found.issue;
  }
  if (found) {
    console.log(`Issue existiert bereits: #${found.issue.number}`);
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

async function jobLogs(runId) {
  const jobs = await getWorkflowRunJobs(runId);
  const logs = new Map();
  for (const job of jobs.filter((j) => j.conclusion === 'failure')) {
    const res = await api('GET', '/actions/jobs/' + job.id + '/logs');
    if (res.ok) logs.set(job.id, await res.text());
  }
  return { jobs, logs };
}

/** Alle roten Gates eines Laufs - nicht nur der erste Befund. */
async function collectRunFailure(runId) {
  const { jobs, logs } = await jobLogs(runId);
  return diagnose({ jobs, logs });
}

/** Wie oft der Lauf schon gelaufen ist; null, wenn nicht lesbar. */
async function runAttempt(runId) {
  const res = await api('GET', '/actions/runs/' + runId);
  if (!res.ok) return null;
  const data = await res.json();
  return Number(data.run_attempt ?? 1);
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

  // Timeout, Abbruch und Startfehler sind REMOTE_CI: kein Blocker, kein
  // Notfall, sondern ein Lauf, der wiederholt wird.
  if (['timed_out', 'cancelled', 'startup_failure'].includes(runConclusion)) {
    const title = `[REMOTE_CI] CI Verify ${runConclusion}: ${runBranch}`;
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
    await createIssue(title, body, ['remote-ci'], fingerprintOf('REMOTE_CI', `${runConclusion}:${runBranch}`), runUrl, 'remote-ci');
    return;
  }

  if (runConclusion !== 'failure') {
    console.log('CI-Run nicht rot, kein Issue nötig.');
    return;
  }

  console.log(`CI-Run rot: ${runBranch} (${runCommit}), Run ${runId}`);

  const diagnostics = await collectRunFailure(runId);
  // Begrenzter Retry vor dem Issue: nur wenn jeder Befund transient ist
  // (Netz, Runner, Rate Limit), und hoechstens einmal. Fachliche Fehler
  // wiederholen sich mit identischen Eingaben und werden nicht erneut gestartet.
  const attempt = await runAttempt(runId);
  const transient = diagnostics.failures.length > 0
    && diagnostics.failures.every((failure) => failure.level === 'REMOTE_CI');
  if (transient && attempt !== null && attempt < 2) {
    const rerun = await api('POST', '/actions/runs/' + runId + '/rerun', { enable_debug_logging: false });
    console.log('Retry ' + (attempt + 1) + '/2 fuer ausschliesslich transiente Befunde (' + rerun.status + ').');
    if (rerun.ok) return;
  }
  const primary = diagnostics.primary;
  const code = primary.code;
  const firstLine = primary.line;
  const failedTest = primary.failedTest;
  const fingerprint = fingerprintOf(code, firstLine);

  // Lane-Scope: ein rotes Lane-Gate blockiert nur diese Lane, nicht alle
  // Promotions. Das Label macht den Scope in der Issue-Liste sichtbar.
  const laneLabel = runBranch && runBranch.includes('/')
    ? `lane:${runBranch.split('/').slice(0, 2).join('/')}`
    : null;
  if (laneLabel) {
    await api('POST', '/labels', { name: laneLabel, color: '0e8a16', description: `Gate-Scope ${laneLabel}` });
  }
  const labels = ['gate-failure', 'agent-action', ...(laneLabel ? [laneLabel] : [])];

  const title = `[${code}] CI Verify: ${firstLine.trim().slice(0, 80)}`;
  const body = `## 🚨 CI Gate rot

**Branch:** \`${runBranch}\`  
**Commit:** \`${runCommit}\`  
**CI Run:** <${runUrl}>  
**Betroffene Datei:** ${failedTest ? `\`${failedTest}\`` : 'nicht eindeutig - Log-Auszug unten'}  
**Erkannt durch:** pr-watcher.yml  
**Scope:** ${laneLabel ? `\`${laneLabel}\` - rotes Lane-Gate, nur diese Lane und ihre Dependents sind blockiert` : 'main/global'}

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

6. **Wenn alle Gates grün:** PR zu \`main\` erstellen; Promote mergt ihn.

## 🔍 Gate-Details

<details>
<summary>Fehlgeschlagene Jobs / Schritte</summary>

\`\`\`
${diagnostics.report}
\`\`\`

</details>

## 📎 Regeln (aus AGENTS.md)

- **Pretask zuerst:** \`pnpm run agent:pretask\`; offene \`gate-failure\`-Issues haben Vorrang.
- **Nur echte Invarianten blockieren:** Balance, schiefe Tests und Randfaelle sind dieses Issue, kein \`BLOCKED\`.
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
