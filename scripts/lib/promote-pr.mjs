/**
 * PR-Plumbing der Promotion: Titel aus den Commits, Body-Automation,
 * PR-Erkennung, Check-Runs und Verifikation gegen den geprueften Kopf.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  describeAutomation, mergeAutomation, parseNameStatus, splitAutomation,
} from './body-sync.mjs';
import { promotionPrListArgs, verifyPromotion } from './promote-guard.mjs';

const FULL_SHA = /^[0-9a-f]{40}$/;

export function createPromotePr({
  gh, git, warn, log, headRef, exactHead, branch, MAIN, owner,
  headSha, baseSha, ciRunId, event, repo, headRepo,
}) {
  const subject = (ref) => git(['log', '-1', '--pretty=%s', ref]) ?? `Promotion ${ref}`;

  function diffBase(ref) {
    for (const candidate of ['origin/main', 'main', 'HEAD']) {
      const base = git(['merge-base', candidate, ref]);
      if (base) return base;
    }
    return null;
  }

  function commitText(ref) {
    const base = diffBase(ref);
    return base ? git(['log', '--pretty=format:%s%n%b', `${base}..${ref}`]) ?? '' : '';
  }

  function mergeText(existing, ref) {
    const base = diffBase(ref);
    if (!base) return { ok: false, body: '', changed: false, reason: 'keine gemeinsame Basis mit main; Diff nicht bestimmbar' };
    const entries = parseNameStatus(git(['diff', '--name-status', `${base}...${ref}`]) ?? '');
    return mergeAutomation(
      existing,
      describeAutomation({
        entries,
        outside: splitAutomation(existing).outside,
        commitText: commitText(ref),
        base,
        head: git(['rev-parse', ref]) ?? '',
      }),
    );
  }

  function writeBodyFile(text, name = 'pr-body.md') {
    const dir = mkdtempSync(join(tmpdir(), 'rbd-promote-'));
    const file = join(dir, name);
    writeFileSync(file, `${text}\n`);
    return file;
  }

  function prInfo(number) {
    if (!number) return null;
    const raw = gh(['pr', 'view', String(number), '--json', 'state,isCrossRepository,headRefOid,baseRefOid,baseRefName,headRepository,labels,url']);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function openPr(head = branch) {
    if (!head) return '';
    const raw = gh(promotionPrListArgs(head, MAIN));
    if (!raw || !/^\d+$/.test(raw)) return '';
    return prInfo(raw)?.isCrossRepository === false ? raw : '';
  }

  function checkRunsOfHead() {
    if (!FULL_SHA.test(headSha)) return null;
    const raw = gh(['api', `repos/${repo}/commits/${headSha}/check-runs?per_page=100`, '--jq', '.check_runs']);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function verifiedPr(number) {
    const info = prInfo(number);
    const check = verifyPromotion({
      event,
      repo,
      headRepo,
      branch,
      headSha,
      baseSha,
      ciRunId,
      checkRuns: checkRunsOfHead(),
      pr: info,
    });
    if (!check.ok) {
      warn(`PR #${number}: ${check.reason}; kein Merge`);
      return null;
    }
    if (!exactHead()) {
      warn(`PR #${number}: ${headSha} ist nicht als exakter Kopf geladen; kein Merge`);
      return null;
    }
    return info;
  }

  function syncPrBody(number) {
    if (!number) return;
    const current = gh(['pr', 'view', number, '--json', 'body', '--jq', '.body']);
    if (current === null) {
      warn(`PR #${number}: Body nicht lesbar; keine Schreiboperation`);
      return;
    }
    const merged = mergeText(current, headRef());
    if (!merged.ok) {
      warn(`PR #${number}: ${merged.reason}; Body bleibt unveraendert`);
      return;
    }
    if (!merged.changed) return;
    const bodyFile = writeBodyFile(merged.body);
    if (gh(['pr', 'edit', number, '--body-file', bodyFile]) === null) warn(`PR #${number}: Body nicht aktualisiert`);
    else log(`PR #${number}: Diff-Fakten im Automationsbereich ergaenzt`);
  }

  function ensurePr() {
    const existing = openPr();
    if (existing) return existing;
    const ref = headRef();
    const merged = mergeText('', ref);
    if (!merged.ok) {
      warn(`PR nicht angelegt: ${merged.reason}`);
      return '';
    }
    const bodyFile = writeBodyFile(merged.body);
    const headSpec = owner ? `${owner}:${branch}` : branch;
    if (gh(['pr', 'create', '--base', MAIN, '--head', headSpec, '--title', subject(ref), '--body-file', bodyFile]) === null) return '';
    return openPr();
  }

  return { subject, diffBase, commitText, mergeText, writeBodyFile, prInfo, openPr, checkRunsOfHead, verifiedPr, syncPrBody, ensurePr };
}
