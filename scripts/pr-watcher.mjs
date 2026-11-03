#!/usr/bin/env node
/**
 * PR Watcher – erstellt Issues bei rotem Gate oder fehlerhaftem PR-Body.
 *
 * Aufruf durch .github/workflows/pr-watcher.yml.
 * Liefert einem Agenten alle Infos, um das Issue zu lösen und den Merge
 * durchzubekommen.
 */


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
 * sonst Titel unter den offenen Issues.
 */
async function findIssue(fingerprint, title) {
  const res = await api('GET', '/issues?state=all&labels=gate-failure&per_page=100');
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

async function createIssue(title, body, labels, fingerprint, runUrl) {
  const found = await findIssue(fingerprint, title);
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

/** Erste Fehlerzeile mit ERR-Code aus den Job-Logs eines Runs; sonst ERR-0000. */
async function firstGateError(runId) {
  const jobs = await getWorkflowRunJobs(runId);
  for (const job of jobs.filter((j) => j.conclusion === 'failure')) {
    const res = await api('GET', `/actions/jobs/${job.id}/logs`);
    if (!res.ok) continue;
    const lines = (await res.text()).split(/\r?\n/);
    const hit = lines.find((line) => /\[ERR-\d{4}\]/.test(line) || /\bERR-\d{4}\b/.test(line));
    if (hit) {
      const code = /ERR-\d{4}/.exec(hit)[0];
      return { code, firstLine: hit.replace(/^.*?\d{4}-\d{2}-\d{2}T[^ ]+\s*/, '') };
    }
  }
  return { code: 'ERR-0000', firstLine: 'Kein Fehlercode im Gate-Log gefunden' };
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

async function main() {
  const eventName = process.env.GITHUB_EVENT_NAME;

  if (eventName === 'workflow_run') {
    await handleWorkflowRun();
  } else if (eventName === 'pull_request') {
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

  if (runConclusion !== 'failure') {
    console.log('CI-Run nicht rot, kein Issue nötig.');
    return;
  }

  console.log(`CI-Run rot: ${runBranch} (${runCommit}), Run ${runId}`);

  const jobDetails = await getFailedJobDetails(runId);
  const { code, firstLine } = await firstGateError(runId);
  const fingerprint = fingerprintOf(code, firstLine);

  const title = `[${code}] CI Verify: ${firstLine.trim().slice(0, 80)}`;
  const body = `## 🚨 CI Gate rot

**Branch:** \`${runBranch}\`  
**Commit:** \`${runCommit}\`  
**CI Run:** <${runUrl}>  
**Erkannt durch:** pr-watcher.yml

## 📋 Was der Agent tun muss

1. **Checkout des betroffenen Branches:**
   \`\`\`bash
   git checkout ${runBranch}
   git pull origin ${runBranch}
   \`\`\`

2. **Alle Gates lokal ausführen:**
   \`\`\`bash
   pnpm run verify:quick
   # oder bei Bedarf:
   pnpm run verify:all
   \`\`\`

3. **Fehler beheben** bis alle Gates grün sind.

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

6. **Wenn alle Gates grün:** PR zu \`main\` erstellen und mergen (siehe AGENTS.md § PR+Merge-Pflicht).

## 🔍 Gate-Details

<details>
<summary>Fehlgeschlagene Jobs / Schritte</summary>

\`\`\`
${jobDetails}
\`\`\`

</details>

## 📎 Regeln (aus AGENTS.md)

- **Vor Beginn jeder Arbeit:** GitHub Issues prüfen. Offene \`gate-failure\`-Issues haben höchste Priorität.
- **Issue vollständig lösen:** Nicht halbherzig beheben, alle Gates müssen grün sein.
- **Nach jedem Turn/Phase/Slice-Abschluss:** Aufgezwungene PR+Merge-Pflicht.
- **Commit-Body muss** die drei Pflichtsektionen enthalten (\`### Changes\`, \`### Technische Basis & Kausalität\`, \`### Ausblick\`).

## ✅ Issue schließen

Sobald alle Gates grün sind und der PR gemergt wurde, dieses Issue als \`completed\` schließen.
`;

  await createIssue(title, body, ['gate-failure', 'agent-action'], fingerprint, runUrl);
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
