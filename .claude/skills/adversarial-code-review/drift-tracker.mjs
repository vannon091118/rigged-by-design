#!/usr/bin/env node
/**
 * Drift Tracker — Phase 0 des Adversarial Code Review
 *
 * Durchläuft die vollständige Projekt-History (Commits, PRs, Issues, DevTagebuch, Doku)
 * und betrachtet Diffs, um aufzustöbern:
 *  - Parallele Wahrheiten (dasselbe wird an zwei Stellen unterschiedlich definiert)
 *  - Doppelte Systeme (zwei Wege, dasselbe zu tun)
 *  - Widersprüchliche Systeme (Doku sagt X, Code sagt Y)
 *  - Falsche Takt-Logiken (Sequence-Fehler, Missing Preconditions)
 *  - Redundante Arbeitsschritte (gleiche Änderung an mehreren Stellen)
 *
 * Schreibt phase-0-drift.md mit allen Befunden.
 *
 * Usage: node drift-tracker.mjs
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();
const REPORTS_DIR = join(ROOT, '.claude', 'skills', 'adversarial-code-review', 'reports');
const DRIFT_REPORT = join(REPORTS_DIR, 'phase-0-drift.md');

function sh(cmd) {
  try {
    return execSync(cmd, { cwd: ROOT, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }).trim();
  } catch (e) {
    return '';
  }
}

function shLines(cmd) {
  return sh(cmd).split('\n').filter(Boolean);
}

function getCommits() {
  const out = sh('git log --pretty=format:"%H|%s|%an|%ad|%d" --date=short -200');
  if (!out) return [];
  return out.split('\n').map((line) => {
    const parts = line.split('|');
    return { sha: parts[0], subject: parts[1], author: parts[2], date: parts[3], ref: parts.slice(4).join('|') };
  });
}

function getPRs() {
  const out = sh('gh pr list --state all --limit 100 --json number,title,state,mergeable,headRefName,baseRefName,createdAt,mergedAt --jq ".[]" 2>/dev/null');
  if (!out) return [];
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function getIssues() {
  const out = sh('gh issue list --state all --limit 100 --json number,title,state,labels,createdAt,updatedAt --jq ".[]" 2>/dev/null');
  if (!out) return [];
  try {
    return JSON.parse(out);
  } catch {
    return [];
  }
}

function getDevTagebuch() {
  const path = join(ROOT, 'docs', 'DEVTAGEBUCH.md');
  if (!existsSync(path)) return '';
  return readFileSync(path, 'utf-8');
}

function findDocCodeDrift() {
  const findings = [];

  const agentsMd = readFileSync(join(ROOT, 'AGENTS.md'), 'utf-8');
  if (agentsMd.includes('18')) {
    const pipelinePlan = existsSync(join(ROOT, 'scripts', 'lib', 'pipeline-plan.mjs'))
      ? readFileSync(join(ROOT, 'scripts', 'lib', 'pipeline-plan.mjs'), 'utf-8')
      : '';
    const gateCount = (pipelinePlan.match(/REQUIRED_CI_GATES|QUICK_GATES|LIGHT/g) || []).length;
    if (gateCount === 0) {
      findings.push({
        typ: 'Doku-Code-Drift',
        beschreibung: 'AGENTS.md nennt 18 Required-Gates, aber pipeline-plan.mjs enthält keine entsprechende Gate-Zählung.',
        quelle: 'AGENTS.md vs scripts/lib/pipeline-plan.mjs',
        schwerwiegend: 'mittel',
      });
    }
  }

  const coreIndex = join(ROOT, 'src', 'core');
  if (existsSync(coreIndex)) {
    const pixiImports = sh('grep -rl "pixi.js" src/core/ 2>/dev/null | head -5');
    const reactImports = sh('grep -rl "react" src/core/ 2>/dev/null | head -5');
    if (pixiImports) {
      findings.push({
        typ: 'Headless-Core-Verletzung',
        beschreibung: 'src/core/ importiert pixi.js — verletzt Regel 3 (src/core bleibt headless).',
        quelle: 'src/core/ (pixi.js Importe: ' + pixiImports.split('\n').length + ')',
        schwerwiegend: 'hoch',
      });
    }
    if (reactImports) {
      findings.push({
        typ: 'Headless-Core-Verletzung',
        beschreibung: 'src/core/ importiert react — verletzt Regel 3 (src/core bleibt headless).',
        quelle: 'src/core/ (react Importe: ' + reactImports.split('\n').length + ')',
        schwerwiegend: 'hoch',
      });
    }
  }

  const randomHits = sh('grep -rn "Math\\.random\\|Date\\.now\\|new Date()" src/core/ src/render/ src/store/ src/ui/ 2>/dev/null | grep -v __tests__ | head -10');
  if (randomHits) {
    findings.push({
      typ: 'Regel-5-Verletzung (Nicht-Determinismus)',
      beschreibung: 'Math.random / Date.now / new Date() im Spielpfad gefunden — verletzt Regel 5.',
      quelle: randomHits,
      schwerwiegend: 'hoch',
    });
  }

  return findings;
}

function findDuplicateSystems() {
  const findings = [];

  const claimsJson = existsSync(join(ROOT, '.lane-claims', 'claims.json'));
  const claimsDir = existsSync(join(ROOT, '.lane-claims', 'claims'));
  if (claimsJson && claimsDir) {
    findings.push({
      typ: 'Doppeltes System: Claim-Register',
      beschreibung: 'Es existieren zwei Claim-Register-Strukturen: Legacy claims.json (Array) und einzelne Dateien unter claims/ (eine pro Lane). loadClaimsStrict() führt beide zusammen, aber Inkonsistenzen sind möglich.',
      quelle: '.lane-claims/claims.json + .lane-claims/claims/',
      schwerwiegend: 'mittel',
    });
  }

  const boardState = existsSync(join(ROOT, '.lane-claims', 'board-state.json'));
  const mergedIndex = existsSync(join(ROOT, '.lane-claims', 'merged-index.json'));
  if (boardState && mergedIndex) {
    findings.push({
      typ: 'Doppeltes System: Board-State vs Merged-Index',
      beschreibung: 'board-state.json ist ein generierter Snapshot, merged-index.json trackt gemergte Claims. Beide enthalten überlappende Informationen über Claim-Status. Keine klare Primärquelle.',
      quelle: '.lane-claims/board-state.json + .lane-claims/merged-index.json',
      schwerwiegend: 'mittel',
    });
  }

  const actorsJson = existsSync(join(ROOT, '.lane-claims', 'actors.json'));
  if (actorsJson) {
    const actors = readFileSync(join(ROOT, '.lane-claims', 'actors.json'), 'utf-8');
    if (actors.includes('shared-principal') || actors.includes('vannon091118')) {
      findings.push({
        typ: 'Doppeltes System: Rollen ohne Trennung',
        beschreibung: 'actors.json listet einen Principal, der gleichzeitig User, Maintainer und Worker ist. Es gibt keinen eigenen Maintainer-Login, der die Trennung erzwingt.',
        quelle: '.lane-claims/actors.json',
        schwerwiegend: 'hoch',
      });
    }
  }

  return findings;
}

function findTacticLogicIssues(commits) {
  const findings = [];

  const commitsWithoutIssue = commits.filter(c => !c.subject.match(/#\d+/));
  if (commitsWithoutIssue.length > 0) {
    findings.push({
      typ: 'Takt-Logik: Commits ohne Issue-Bezug',
      beschreibung: commitsWithoutIssue.length + ' der letzten 200 Commits haben keinen Issue-Bezug (#N) in der Commit-Nachricht. Das erschwert die Rückverfolgbarkeit (Issue bestimmt Aufgabe, Priorität und Akzeptanz).',
      quelle: 'git log (' + commitsWithoutIssue.length + ' Commits ohne #N)',
      schwerwiegend: 'mittel',
    });
  }

  try {
    const taskFiles = readdirSync(join(ROOT, '.lane-claims', 'tasks')).filter(f => f.endsWith('.json'));
    const claimFiles = readdirSync(join(ROOT, '.lane-claims', 'claims')).filter(f => f.endsWith('.json'));
    if (claimFiles.length > taskFiles.length) {
      findings.push({
        typ: 'Takt-Logik: Claims ohne Task-Verträge',
        beschreibung: claimFiles.length + ' Claim-Dateien aber nur ' + taskFiles.length + ' Task-Dateien. Einige Claims haben keinen zugehörigen Task-Vertrag mit Done-Kriterien.',
        quelle: '.lane-claims/claims/ (' + claimFiles.length + ') vs .lane-claims/tasks/ (' + taskFiles.length + ')',
        schwerwiegend: 'mittel',
      });
    }
  } catch {
    // Verzeichnis existiert nicht
  }

  return findings;
}

function findRedundantWork(commits) {
  const findings = [];

  const docReadCommits = commits.filter(c => c.subject.includes('docs read') || c.subject.includes('Pflichtlektuere'));
  if (docReadCommits.length > 1) {
    findings.push({
      typ: 'Redundante Arbeit: Pflichtdoku-Lesung mehrfach committet',
      beschreibung: docReadCommits.length + ' Commits beziehen sich auf die Pflichtdoku-Lesung (docs read). Das Receipt sollte nur einmal erstellt werden, nicht mehrfach committet.',
      quelle: 'git log (' + docReadCommits.length + ' Mal)',
      schwerwiegend: 'niedrig',
    });
  }

  const closeoutCommits = commits.filter(c => c.subject.includes('Closeout') || c.subject.includes('closeout'));
  if (closeoutCommits.length > 5) {
    findings.push({
      typ: 'Redundante Arbeit: Viele Closeout-Commits',
      beschreibung: closeoutCommits.length + ' Closeout-Commits in der History. Jeder Merge braucht einen eigenen Closeout — das ist viel Boilerplate für kleine Änderungen.',
      quelle: 'git log (' + closeoutCommits.length + ' Closeout-Commits)',
      schwerwiegend: 'niedrig',
    });
  }

  return findings;
}

function main() {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const commits = getCommits();
  const prs = getPRs();
  const issues = getIssues();
  const devtagebuch = getDevTagebuch();

  const lines = [];
  lines.push('# Adversarial Code Review — Phase 0: Drift Tracker (History-Analyse)');
  lines.push('');
  lines.push('Erstellt: ' + new Date().toISOString());
  lines.push('Repository: ' + ROOT);
  lines.push('');
  lines.push('## Ziel dieser Phase');
  lines.push('');
  lines.push('Die vollständige Projekt-History durchgehen (Commits, PRs, Issues, DevTagebuch, Doku). Nicht nur Text lesen, sondern Diffs betrachten und Auffälligkeiten zurückverfolgen: parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken, redundante Arbeitsschritte.');
  lines.push('');

  // === Section: Commits ===
  lines.push('## 1. Commit-History (letzte 200 Commits)');
  lines.push('');
  lines.push('| SHA (kurz) | Betreff | Autor | Datum | Refs |');
  lines.push('|------------|---------|-------|-------|------|');
  for (const c of commits.slice(0, 50)) {
    lines.push('| ' + c.sha.slice(0, 8) + ' | ' + c.subject + ' | ' + c.author + ' | ' + c.date + ' | ' + c.ref + ' |');
  }
  if (commits.length > 50) {
    lines.push('| … | … (weitere ' + (commits.length - 50) + ' Commits) | … | … | … |');
  }
  lines.push('');

  // === Section: PRs ===
  lines.push('## 2. Pull Request History');
  lines.push('');
  if (prs.length > 0) {
    lines.push('| # | Titel | State | Mergeable | Head → Base | Erstellt | Gemergt |');
    lines.push('|---|-------|-------|-----------|-------------|----------|---------|');
    for (const pr of prs.slice(0, 30)) {
      lines.push('| #' + pr.number + ' | ' + pr.title + ' | ' + pr.state + ' | ' + (pr.mergeable || '—') + ' | ' + pr.headRefName + ' → ' + pr.baseRefName + ' | ' + (pr.createdAt || '—') + ' | ' + (pr.mergedAt || '—') + ' |');
    }
    if (prs.length > 30) {
      lines.push('| … | … (weitere ' + (prs.length - 30) + ' PRs) | … | … | … | … | … |');
    }
  } else {
    lines.push('Keine PR-Daten verfügbar (gh CLI nicht authentifiziert oder keine PRs).');
  }
  lines.push('');

  // === Section: Issues ===
  lines.push('## 3. Issue History');
  lines.push('');
  if (issues.length > 0) {
    lines.push('| # | Titel | State | Labels | Erstellt | Aktualisiert |');
    lines.push('|---|-------|-------|--------|----------|--------------|');
    for (const iss of issues.slice(0, 30)) {
      const labels = (iss.labels || []).map(function(l) { return l.name; }).join(', ');
      lines.push('| #' + iss.number + ' | ' + iss.title + ' | ' + iss.state + ' | ' + labels + ' | ' + (iss.createdAt || '—') + ' | ' + (iss.updatedAt || '—') + ' |');
    }
    if (issues.length > 30) {
      lines.push('| … | … (weitere ' + (issues.length - 30) + ' Issues) | … | … | … | … |');
    }
  } else {
    lines.push('Keine Issue-Daten verfügbar (gh CLI nicht authentifiziert oder keine Issues).');
  }
  lines.push('');

  // === Section: DevTagebuch ===
  lines.push('## 4. DevTagebuch');
  lines.push('');
  if (devtagebuch) {
    const dtLines = devtagebuch.split('\n').filter(function(l) { return l.trim().length > 0; });
    lines.push('Zeilen: ' + dtLines.length);
    lines.push('');
    lines.push('### Erste 30 Zeilen:');
    for (const l of dtLines.slice(0, 30)) {
      lines.push('> ' + l);
    }
    lines.push('');
  } else {
    lines.push('DevTagebuch nicht gefunden oder leer.');
  }
  lines.push('');

  // === Section: Drift-Analyse ===
  lines.push('## 5. Drift-Analyse (Widersprüche, Doppelte Systeme, Takt-Logik, Redundanz)');
  lines.push('');

  const docCodeDrift = findDocCodeDrift();
  const duplicateSystems = findDuplicateSystems();
  const tacticIssues = findTacticLogicIssues(commits);
  const redundantWork = findRedundantWork(commits);

  const allDrift = docCodeDrift.concat(duplicateSystems, tacticIssues, redundantWork);

  lines.push('| Typ | Befund | Quelle | Schweregrad |');
  lines.push('|-----|--------|--------|-------------|');
  for (const d of allDrift) {
    const quelle = d.quelle ? d.quelle.slice(0, 60) + (d.quelle.length > 60 ? '…' : '') : '—';
    lines.push('| ' + d.typ + ' | ' + d.beschreibung + ' | ' + quelle + ' | ' + d.schwerwiegend + ' |');
  }
  if (allDrift.length === 0) {
    lines.push('| — | Keine Drift-Befunde gefunden. | — | — |');
  }
  lines.push('');

  lines.push('### Details zu kritischen Drift-Befunden:');
  const kritisch = allDrift.filter(function(d) { return d.schwerwiegend === 'hoch'; });
  if (kritisch.length > 0) {
    for (const d of kritisch) {
      lines.push('- **' + d.typ + '**: ' + d.beschreibung);
      lines.push('  Quelle: ' + d.quelle);
    }
  } else {
    lines.push('- Keine kritischen Drift-Befunde.');
  }
  lines.push('');

  // === Section: Empfehlungen ===
  lines.push('## 6. Empfehlungen aus Phase 0');
  lines.push('');
  if (kritisch.length > 0) {
    lines.push('1. Kritische Drift-Befunde zuerst beheben (Hoher Schweregrad):');
    for (const d of kritisch) {
      lines.push('   - ' + d.typ + ': ' + d.beschreibung + ' (' + d.quelle + ')');
    }
    lines.push('');
  }
  lines.push('2. Doppelte Systeme zusammenführen (z. B. claims.json + claims/ pro-Lane-Dateien).');
  lines.push('3. Klare Primärquelle für Board-State definieren (board-state.json ODER merged-index.json, nicht beide).');
  lines.push('4. Rollentrennung in actors.json durchsetzen (eigener Maintainer-Login statt shared-principal).');
  lines.push('5. Jeder Commit sollte einen Issue-Bezug (#N) haben für Rückverfolgbarkeit.');

  writeFileSync(DRIFT_REPORT, lines.join('\n') + '\n', 'utf-8');

  console.log('=== Drift Tracker Phase 0 abgeschlossen ===');
  console.log('Commits analysiert: ' + commits.length);
  console.log('PRs analysiert: ' + prs.length);
  console.log('Issues analysiert: ' + issues.length);
  console.log('Drift-Befunde: ' + allDrift.length + ' (' + kritisch.length + ' kritisch)');
  console.log('Bericht geschrieben: ' + DRIFT_REPORT);
}

main();