/**
 * Ausgabe von agent:start: ein JSON-Vertrag oder der kompakte Textbericht.
 * Keine Datenbeschaffung; alle Werte kommen fertig herein.
 */
export function printAgentStart({ asJson, brief, repo, at, agent, credentials, board, next, mechanics, pretask, webhook, apk, blockers, warnings, notes, steps }) {
  if (asJson) {
    console.log(JSON.stringify({
      ok: blockers.length === 0,
      repo,
      at,
      agent,
      tokenSource: credentials.source,
      board: {
        total: board.total,
        shown: board.rows.length,
        next: next ? next.number : null,
        rows: board.rows,
      },
      mechanics: {
        flow: mechanics.entries,
        wired: mechanics.wired,
        unused: mechanics.unused,
        orphan: mechanics.orphan,
      },
      pretask,
      webhook: {
        ok: webhook.ok,
        active: webhook.active,
        events: webhook.events,
        url: webhook.url,
        hooks: webhook.hooks,
        step: webhook.step,
        error: webhook.error ?? '',
      },
      apkRelevance: apk,
      blockers,
      warnings,
      notes,
      nextSteps: brief ? steps.slice(0, 1) : steps,
      details: 'vollstaendig mit --json',
    }, null, 2));
    return;
  }

  const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim();
  const claimCell = (claim) => {
    if (claim.status === 'claimed-other' || claim.status === 'claimed-self') return `${claim.holder} ${claim.claimId ?? ''}`.trim();
    if (claim.status === 'stale') return `stale (${claim.holder}, ${claim.ageHours}h)`;
    return claim.status;
  };
  console.log(`agent:start — ${repo} · Stand ${at} · Agent ${agent}`);
  console.log('');
  console.log('=== Board (GitHub, live) ===');
  console.log(`  Offen: ${board.total} Issues, ${board.pulls.length} PRs · gezeigt: ${board.rows.length} · frei: ${next ? `#${next.number}` : 'keins'}`);
  console.log('');
  console.log('  | # | Prio | Phase | Claim | PR | Naechster Akteur | Warum |');
  console.log('  | --- | --- | --- | --- | --- | --- | --- |');
  for (const row of board.rows) {
    const pr = row.pr ? `#${row.pr.number}${row.pr.draft ? ' (draft)' : ''}` : '—';
    console.log(`  | #${row.number} | ${row.priority} | ${row.phase} | ${cell(claimCell(row.claim))} | ${pr} | ${cell(row.nextActor)} | ${cell(row.reasons.join(' · '))} |`);
  }
  console.log('');
  console.log('=== Start-Befund (pretask, im selben Lauf) ===');
  console.log(pretask.ran
    ? `  Modus ${pretask.mode ?? '?'} · Phase ${pretask.phase ?? '?'} · Claim ${pretask.claimState ?? '?'} · ${(pretask.blockers ?? []).length} Blocker`
    : `  nicht ausgewertet: ${pretask.reason}`);
  console.log('');
  console.log('=== Webhook (speist denselben Ablauf) ===');
  console.log(webhook.ok
    ? `  aktiv ${webhook.active} · Events ${webhook.events.join(',')} · Ziel ${webhook.url}`
    : `  ${webhook.step || `nicht lesbar (${webhook.error})`}`);
  console.log('');
  console.log('=== Mechaniken ===');
  for (const entry of mechanics.entries) console.log(`  FLOW   ${entry.id}: ${entry.rule}`);
  console.log(`  AUTO/WIRED: ${mechanics.wired.length} Skripte erreichbar · ohne Ablauf: ${mechanics.unused.length} · vergessen: ${mechanics.orphan.length}`);
  for (const entry of mechanics.wired.filter((item) => item.note)) console.log(`  HINWEIS ${entry.file}: ${entry.note}`);
  for (const entry of mechanics.unused) console.log(`  OHNE ABLAUF ${entry.file}: ${entry.note}`);
  for (const entry of mechanics.orphan) console.log(`  VERGESSEN ${entry.file}: ${entry.note}`);
  console.log(`  APK-Relevanz: ${apk.checked ? `${apk.apk ? 'APK empfohlen' : 'kein APK noetig'} (seit ${apk.prevTag})` : apk.reason}`);
  for (const warning of warnings) console.log(`  ! ${warning}`);
  for (const note of notes) console.log(`  - ${note}`);
  console.log('');
  if (brief) {
    console.log('=== Naechste Aktion ===');
    console.log(`  -> ${steps[0] ?? 'keine: Blockliste oben abarbeiten'}`);
  } else {
    console.log('=== Naechste Schritte ===');
    for (const step of steps) console.log(`  -> ${step}`);
  }
}
