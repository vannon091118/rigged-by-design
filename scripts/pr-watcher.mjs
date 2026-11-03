#!/usr/bin/env node
/**
 * PR Watcher – erstellt Issues bei rotem Gate oder fehlerhaftem PR-Body.
 *
 * Aufruf durch .github/workflows/pr-watcher.yml.
 *
 * Designprinzip:
 * - Lokal wird nur getrennt und gezielt getestet (schnell, effizient).
 * - GitHub CI ist das letzte Gate-System: prüft alles auf Herz und Nieren.
 * - Bei rotem Gate wird ein Issue mit Fehlercode, Beschreibung und
 *   Fehlerhäufigkeit erstellt, damit ein Agent das Issue direkt lösen kann.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

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

async function listOpenIssues(label) {
  const q = label ? `?state=open&labels=${label}` : '?state=open';
  const res = await api('GET', `/issues${q}`);
  return res.ok ? await res.json() : [];
}

async function findExistingIssue(title) {
  const issues = await listOpenIssues('gate-failure');
  return issues.find((i) => i.title === title);
}

async function countSimilarIssues(titleKeyword) {
  const issues = await listOpenIssues('gate-failure');
  const closed = await api('GET', '/issues?state=closed&labels=gate-failure');
  const closedList = closed.ok ? await closed.json() : [];
  const all = [...issues, ...closedList];
  return all.filter((i) => i.title.includes(titleKeyword)).length;
}

async function createIssue(title, body, labels) {
  const existing = await findExistingIssue(title);
  if (existing) {
    console.log(`Issue existiert bereits: #${existing.number}`);
    return existing;
  }
  const res = await api('POST', '/issues', {
    title,
    body,
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

function extractErrorCodes(text) {
  const codes = [];
  const errRegex = /(ERR-\d{4})/g;
  let m;
  while ((m = errRegex.exec(text)) !== null) {
    if (!codes.includes(m[1])) codes.push(m[1]);
  }
  return codes;
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
  const errorCodes = extractErrorCodes(jobDetails);
  const frequency = await countSimilarIssues(`[GATE-RED] CI Verify auf ${runBranch}`);

  const title = `[GATE-RED] CI Verify auf ${runBranch}`;
  const body = `## 🚨 CI Gate rot – Letztes Gate-System hat versagt

**Branch:** \`${runBranch}\`  
**Commit:** \`${runCommit}\`  
**CI Run:** <${runUrl}>  
**Erkannt am:** ${new Date().toISOString()}  
**Erkannt durch:** pr-watcher.yml  
**Fehlerhäufigkeit:** ${frequency}× ähnlicher Gate-Fehler bereits erfasst  
**Fehlercodes:** ${errorCodes.length > 0 ? errorCodes.join(', ') : 'keineExtrahierbaren'}

## 📋 Was der Agent tun muss

1. **Checkout des betroffenen Branches:**
   \`\`\`bash
   git checkout ${runBranch}
   git pull origin ${runBranch}
   \`\`\`

2. **Lokal gezielt testen** (nur das betroffene Gate, schnell und effizient):
   \`\`\`bash
   pnpm run verify:quick
   # oder bei Bedarf nur das spezifische Gate:
   pnpm run check:loc
   pnpm run verify:docs
   pnpm run lint
   \`\`\`

3. **CI ist das letzte Gate:** Alles auf Herz und Nieren prüfen:
   \`\`\`bash
   pnpm run verify:all
   \`\`\`

4. **Fehler beheben** bis alle Gates grün sind.

5. **Commit mit Pflichtsektionen erstellen:**
   \`\`\`text
   <type>: <Kurzbeschreibung>

   ### Changes (Was ist neu)
   ...

   ### Technische Basis & Kausalität
   ...

   ### Ausblick (Nächste Schritte)
   ...
   \`\`\`

6. **Auf den Branch pushen** (der CI-Run startet automatisch neu).

7. **Wenn alle Gates grün:** PR zu \`main\` erstellen und mergen (siehe AGENTS.md § PR+Merge-Pflicht).

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
- **Lokal nur getrennt und gezielt testen** – die volle Testkette läuft in der CI.

## ✅ Issue schließen

Sobald alle Gates grün sind und der PR gemergt wurde, dieses Issue als \`completed\` schließen.
`;

  await createIssue(title, body, ['gate-failure', 'agent-action']);
}

async function handlePullRequest() {
  const prNumber = process.env.PR_NUMBER ?? 'unbekannt';
  const prBody = process.env.PR_BODY ?? '';

  if (!prBody.trim()) {
    const title = `[PR-BODY-FEHLT] PR #${prNumber}`;
    const body = `## 📋 PR ohne Body

**PR:** #${prNumber}  
**URL:** <https://github.com/${REPO}/pull/${prNumber}>  
**Erkannt am:** ${new Date().toISOString()}  
**Erkannt durch:** pr-watcher.yml

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
    await createIssue(title, body, ['gate-failure', 'agent-action']);
    return;
  }

  const lines = prBody.split(/\r?\n/);
  const { missing, empty } = gateFailureSections(prBody);

  if (missing.length > 0 || empty.length > 0) {
    const title = `[PR-BODY-UNVOLLSTÄNDIG] PR #${prNumber}`;
    const body = `## 📋 PR-Body unvollständig

**PR:** #${prNumber}  
**URL:** <https://github.com/${REPO}/pull/${prNumber}>  
**Erkannt am:** ${new Date().toISOString()}  
**Erkannt durch:** pr-watcher.yml

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
    await createIssue(title, body, ['gate-failure', 'agent-action']);
  } else {
    console.log(`PR #${prNumber} Body PASS: alle Pflichtsektionen vorhanden.`);
  }
}

main().catch((err) => {
  console.error('pr-watcher Fehler:', err);
  process.exit(1);
});
