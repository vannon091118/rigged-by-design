/**
 * Board-Nutzung: das Issue ist die Wahrheit, nicht die lokale Datei.
 *
 * `.lane-claims/` spiegelt einen Claim nur mechanisch. Dieses Modul entscheidet,
 * ob eine Lane ihren Auftrag tatsaechlich am Board belegt hat: offenes Issue,
 * eigener `CLAIM`-Kommentar aus dem verifizierten Verlauf, und fuer die
 * Uebergabe ein `RELEASE`-Kommentar plus Label `review-waiting`.
 *
 * Ist das Board nicht lesbar, ist das ein Befund — kein Freibrief. Genau diese
 * Luecke machte aus "Board ist Steuerungswahrheit" eine Behauptung: ohne
 * GitHub lesbarem Verlauf entschied allein eine selbst geschriebene JSON-Datei.
 */

/** Ein Issue, auf dem gearbeitet werden darf. */
const OPEN = 'OPEN';

function labelNames(labels = []) {
  return (Array.isArray(labels) ? labels : [])
    .map((label) => (typeof label === 'string' ? label : label?.name))
    .filter(Boolean);
}

/**
 * Der Uebergabe-Kommentar zu einem Claim (`RELEASE [A1] done <sha>`).
 * Ohne `claimId` zaehlt der erste RELEASE ueberhaupt.
 */
export function releaseForClaim(comments = [], claimId = '') {
  const wanted = String(claimId ?? '').trim().toLowerCase();
  for (const comment of Array.isArray(comments) ? comments : []) {
    const lines = String(comment?.body ?? '').split(/\r?\n/);
    for (const raw of lines) {
      const line = raw.replace(/`/g, '').replace(/^\s*[-*+]\s+/, '').trim();
      const match = /^RELEASE\s+\[([^\]]+)\]\s+(done|abandoned)\b(.*)$/i.exec(line);
      if (!match) continue;
      const id = match[1].trim().toLowerCase();
      if (wanted && id !== wanted) continue;
      return {
        claimId: match[1].trim(),
        result: match[2].toLowerCase(),
        sha: match[3]?.trim() ?? '',
        author: String(comment?.author?.login ?? ''),
        at: String(comment?.createdAt ?? ''),
      };
    }
  }
  return null;
}

/**
 * Bewertet eine Lane gegen das Board.
 *
 * @param {{ branch?: string, claim?: object|null, issueClaim?: object|null,
 *           comments?: object[], requireCloseout?: boolean }} input
 * @returns {{ ok: boolean, skipped: boolean, failures: string[], facts: string[][] }}
 */
export function evaluateBoardUsage({
  branch = '',
  claim = null,
  issueClaim = null,
  comments = [],
  requireCloseout = false,
} = {}) {
  const failures = [];
  const facts = [];
  const result = () => ({ ok: failures.length === 0, skipped: false, failures, facts });

  if (!branch || branch === 'main') {
    return {
      ok: true,
      skipped: true,
      failures,
      facts: [['Board', 'main: Branch-Schutz statt Lane-Claim']],
    };
  }
  if (!claim) {
    failures.push('kein Lane-Claim: ohne Claim gibt es keinen Board-Auftrag');
    return result();
  }
  // Eine gemergte Lane ist abgeschlossen: ihr Board-Beleg wurde beim Merge
  // erbracht. Closeout-Pushes (Claim auf merged, Task DONE) brauchen keinen
  // zweiten Claim am Issue und wuerden sonst dauerhaft blockieren.
  if (claim.status === 'merged') {
    return {
      ok: true,
      skipped: true,
      failures,
      facts: [['Claim', `${claim.id} · merged`], ['Board', 'abgeschlossen, kein neuer Beleg noetig']],
    };
  }
  facts.push(['Claim', claim.id]);
  facts.push(['Issue', claim.issue ? `#${claim.issue}` : 'fehlt']);
  if (!claim.issue) {
    failures.push(`Claim '${claim.id}' traegt keine Issue-Nummer; 'pnpm run claim:register --issue <nr>' nachziehen`);
  }

  // Fail-closed: ohne lesbaren Verlauf gibt es keinen Beleg. Die lokale Datei
  // ist ein Spiegel, keine Quelle.
  if (!issueClaim || issueClaim.checked !== true) {
    failures.push(
      `Issue #${claim.issue ?? '?'} nicht lesbar; ohne Board-Beleg startet und pusht keine Lane ` +
        '(gh auth login oder Token in GH_TOKEN/GITHUB_TOKEN, dann pnpm run verify:board-usage)',
    );
    return result();
  }

  const state = String(issueClaim.state ?? '').toUpperCase();
  const status = String(issueClaim.status ?? 'unknown');
  facts.push(['Board', `${state || 'unbekannt'}${status ? ` · ${status}` : ''}`]);
  if (state !== OPEN) {
    failures.push(`Issue #${claim.issue} ist ${state || 'unbekannt'}: eine Lane braucht ein offenes Issue`);
  }

  if (status === 'free') {
    failures.push(
      `Issue #${claim.issue} hat keinen CLAIM-Kommentar; vor dem ersten Read ` +
        `'CLAIM [A1] <agent> <UTC> scope=<pfade> plan=<ein Satz>' setzen`,
    );
  } else if (status === 'claimed-other') {
    failures.push(
      `Issue #${claim.issue} ist durch ${issueClaim.holder} geclaimt (${issueClaim.claimId}); erst RELEASE/HANDOFF abwarten`,
    );
  } else if (status === 'unknown' || status === 'not-linked') {
    failures.push(`Issue #${claim.issue}: Claim-Lage unbekannt (${issueClaim.error ?? status})`);
  } else if (status === 'stale') {
    // Ein alter Claim bleibt ein Claim; er wird als Hinweis gefuehrt, nicht als
    // Startverbot. Nur fehlender oder fremder Besitz blockiert.
    facts.push(['Hinweis', `Claim aelter als ${issueClaim.ageHours ?? '?'}h`]);
  } else if (status !== 'claimed-self') {
    failures.push(`Issue #${claim.issue}: Claim-Status '${status}' ist kein eigener Board-Claim`);
  }
  facts.push([
    'Board-Claim',
    issueClaim.claimId ? `${issueClaim.claimId} · ${issueClaim.holder ?? 'ohne Halter'}` : 'fehlt',
  ]);

  if (requireCloseout) {
    const labels = labelNames(issueClaim.labels ?? []);
    if (!labels.includes('review-waiting')) {
      failures.push(`Uebergabe ohne Label 'review-waiting' an Issue #${claim.issue}`);
    }
    const release = releaseForClaim(
      Array.isArray(comments) && comments.length > 0 ? comments : (issueClaim.comments ?? []),
      issueClaim.claimId ?? '',
    );
    if (!release) {
      failures.push(`kein RELEASE-Kommentar zu ${issueClaim.claimId ?? 'diesem Claim'} (RELEASE [<id>] done <sha>)`);
    } else if (release.result !== 'done') {
      failures.push(`RELEASE ${release.claimId} steht auf '${release.result}' statt 'done'`);
    } else {
      facts.push(['Uebergabe', `RELEASE ${release.claimId} · ${release.sha || 'ohne SHA'}`]);
    }
  }

  return result();
}
