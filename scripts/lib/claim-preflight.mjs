/**
 * Pre-Push-Claim-Audit: offene Claims und Rest-WIP vor dem Push sichtbar machen.
 *
 * Der Audit ist absichtlich selbsterklaerend. Nach einem Kontextverlust weiss
 * ein Modell nicht, ob ein offener Claim oder ein uncommitted Rest von ihm
 * stammt oder zu einem parallelen Task gehoert. Die Meldung nennt deshalb
 * Claim, Task-Phase, parallele Lanes und Restdateien und sagt, was zu tun ist.
 *
 * Blockierend sind nur Dinge, die der pushende Agent selbst aufloesen kann:
 * uncommitted WIP, ein eigener Claim ohne Issue, ein kaputter Task-Vertrag und
 * ein Bruch der Claim/Task-Paritaet. Ein fremder offener Claim ist eine
 * Warnung, keine Sperre: parallele Arbeit ist erlaubt.
 */
import { auditTaskClaimParity, selectClaim } from './lane-claims.mjs';

const STATUS_LINE = /^(..) (.+)$/;

/** Zerlegt `git status --porcelain`-Zeilen; Renames und Quoting bleiben lesbar. */
export function parseStatusLines(lines = []) {
  const list = Array.isArray(lines) ? lines : String(lines ?? '').split(/\r?\n/);
  return list
    .map((line) => String(line).replace(/\r$/, ''))
    .filter(Boolean)
    .map((line) => {
      const match = STATUS_LINE.exec(line);
      if (!match) return null;
      const code = match[1];
      let path = match[2].trim();
      if (path.includes(' -> ')) path = path.split(' -> ').pop().trim();
      if (path.startsWith('"') && path.endsWith('"')) path = path.slice(1, -1);
      // Die Turn-Arbeitsdatei ist bewusst nie Commit-Inhalt.
      if (!path || path === '.turn-notes.md') return null;
      return { code, path, untracked: code === '??' };
    })
    .filter(Boolean);
}

/** Klassen- und JSON-Claims gleich behandeln. */
function claimView(claim) {
  return typeof claim?.toJSON === 'function' ? claim.toJSON() : claim;
}

/**
 * Bewertet einen Push-Stand. `status` sind die Zeilen aus
 * `git status --porcelain`, `tasks` die Eintraege aus `loadTaskContracts`.
 */
export function inspectClaimPreflight({
  branch = '',
  claims = [],
  tasks = [],
  status = [],
  taskErrors = [],
} = {}) {
  const all = claims.map(claimView);
  const current = branch && branch !== 'main' ? selectClaim(all, branch) : null;
  const open = all.filter((claim) => claim?.status === 'open');
  const parallel = open.filter((claim) => claim?.id !== current?.id);
  const currentTask = current
    ? tasks.find((entry) => entry?.contract?.claimId === current.id) ?? null
    : null;
  const wip = parseStatusLines(status);
  const blockers = [];
  const warnings = [];
  const parity = auditTaskClaimParity({
    claims: all,
    tasks: tasks.map((entry) => entry?.contract).filter(Boolean),
  });

  if (branch && branch !== 'main') {
    if (wip.length > 0) blockers.push(`${wip.length} Restdatei(en) nicht im Push`);
    if (!current) blockers.push('kein Claim fuer diesen Branch');
    if (current && !current.issue) blockers.push(`Claim ${current.id} ohne Issue-Nummer`);
    if (current && !currentTask) warnings.push(`Claim ${current.id} ohne Task-Vertrag`);
    if (taskErrors.length > 0) {
      blockers.push(`${taskErrors.length} Task-Vertrag/Vertraege nicht lesbar`);
    }
    for (const violation of parity.violations) {
      if (current && String(violation).startsWith(`${current.id}:`)) blockers.push(violation);
      else warnings.push(violation);
    }
    if (currentTask) {
      const openBlockers = (currentTask.contract.findings ?? []).filter(
        (finding) => finding.status === 'open' && finding.severity === 'blocker',
      );
      if (openBlockers.length > 0) {
        blockers.push(`${openBlockers.length} offener Blocker im Task-Vertrag`);
      }
    }
  }

  return {
    branch,
    skipped: branch === 'main',
    current,
    currentTask: currentTask?.contract ?? null,
    open,
    parallel,
    wip,
    blockers,
    warnings,
    parity,
  };
}

/** Kompakte, selbsterklaerende Meldung fuer Hook, Turn-Ende und Menschen. */
export function formatClaimPreflight(result) {
  const lines = [`claim-preflight: ${result.branch || '(unbekannt)'}`];
  if (result.skipped) {
    lines.push('  main: Branch-Schutz, kein Lane-Claim noetig.');
    return lines.join('\n');
  }
  if (result.current) {
    const issue = result.current.issue ? `#${result.current.issue}` : 'ohne Issue';
    const phase = result.currentTask?.phase ?? 'ohne Task-Vertrag';
    lines.push(
      `  Claim: ${result.current.id} (${result.current.owner}, ${issue}) · ${phase} · ${result.current.status}`,
    );
  } else {
    lines.push('  Claim: keiner fuer diesen Branch');
  }
  if (result.parallel.length > 0) {
    const preview = result.parallel
      .slice(0, 3)
      .map((claim) => `${claim.id}${claim.issue ? ` #${claim.issue}` : ' ohne Issue'}`);
    const rest = result.parallel.length - preview.length;
    lines.push(`  Parallel offen: ${preview.join(', ')}${rest > 0 ? `, +${rest} weitere` : ''}`);
  }
  if (result.wip.length > 0) {
    const untracked = result.wip.filter((entry) => entry.untracked).length;
    lines.push(`  Rest-WIP: ${result.wip.length} Datei(en), davon ${untracked} untracked`);
  }
  if (result.blockers.length > 0) lines.push(`  Push blockiert: ${result.blockers.join('; ')}`);
  if (result.warnings.length > 0) {
    const preview = result.warnings.slice(0, 2);
    const rest = result.warnings.length - preview.length;
    lines.push(`  Hinweis: ${preview.join('; ')}${rest > 0 ? `; +${rest} weitere` : ''}`);
  }
  if (result.parallel.length > 0 || result.wip.length > 0 || result.blockers.length > 0) {
    lines.push('  Pruefe: Ist der Rest-WIP deine Arbeit oder ein paralleler Task?');
    lines.push('  - Deine: abschliessen/committen; Claim bei Abschluss schliessen.');
    lines.push('  - Parallel: nicht anfassen; Claim und Issue pruefen.');
    lines.push('  - Offene Arbeit ohne Issue: Issue anlegen und verlinken.');
  }
  if (result.blockers.length === 0 && result.warnings.length === 0) {
    lines.push('  OK: Claim und Arbeitsbaum sind push-bereit.');
  }
  return lines.join('\n');
}
