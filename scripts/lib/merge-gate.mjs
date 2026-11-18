/**
 * Merge-Gate: der serverseitige Zustand von `main`, lesbar und pruefbar.
 *
 * GitHub ist die letzte Instanz vor einem Merge. Dieses Modul macht aus der
 * Branch-Protection-Antwort und der Ruleset-Liste einen Befund: existiert der
 * Schutz, sind direkte Pushes und Force-Pushes blockiert, gilt er auch fuer
 * Admins — und welche Status-Checks verlangt er?
 *
 * Der Bericht „keine serverseitige Merge-Sperre" ist damit reproduzierbar:
 * entweder das Gate ist gruen, oder es nennt den fehlenden Punkt mit Befehl.
 * Rein rechnend, ohne Netz; der Aufrufer liefert die Antworten.
 */

/** Liest die klassische Branch-Protection; `null` heisst „kein Schutz". */
export function parseProtection(data) {
  if (!data || typeof data !== 'object' || data.present === false) return null;
  const reviews = data.required_pull_request_reviews;
  const checks = data.required_status_checks;
  return {
    prRequired: Boolean(reviews),
    approvals: Number(reviews?.required_approving_review_count ?? 0),
    enforceAdmins: Boolean(data.enforce_admins?.enabled),
    forcePushBlocked: !data.allow_force_pushes?.enabled,
    deletionsBlocked: !data.allow_deletions?.enabled,
    requiredChecks: Array.isArray(checks?.contexts) ? checks.contexts.map(String) : [],
    strictChecks: Boolean(checks?.strict),
  };
}

/** Rulesets sind die zweite moegliche Sperre; hier zaehlt nur, ob es welche gibt. */
export function parseRulesets(data) {
  return Array.isArray(data) ? data.map((rule) => String(rule?.name ?? rule?.id ?? 'ruleset')) : [];
}

/**
 * Verdikt: gruen nur, wenn GitHub direkte Merges nach `main` serverseitig
 * verhindert und der Schutz nicht durch Admins umgangen werden kann.
 * Fehlende Required-Status-Checks zaehlen als Blocker, da sonst ein Merge
 * ohne gruenen Verify-Lauf moeglich ist.
 */
export function mergeGateVerdict({ protection, rulesets = [], branch = 'main' }) {
  const parsed = parseProtection(protection);
  const findings = [];
  if (!parsed) {
    findings.push(`main-Schutz fehlt: GitHub erzwingt keinen Pull Request fuer '${branch}'`);
  } else {
    if (!parsed.prRequired) findings.push(`kein Pull-Request-Zwang auf '${branch}'`);
    if (!parsed.enforceAdmins) findings.push('enforce_admins ist aus: Admins koennen den Schutz umgehen');
    if (!parsed.forcePushBlocked) findings.push('Force-Push auf main ist erlaubt');
    if (!parsed.deletionsBlocked) findings.push('Loeschen von main ist erlaubt');
    if (parsed.requiredChecks.length === 0) findings.push('keine Required-Status-Checks konfiguriert: Merge ohne gruenen Verify-Lauf moeglich');
  }
  const names = parseRulesets(rulesets);
  if (names.length === 0) findings.push('keine serverseitige Ruleset-Erzwingung auf main: direkter Merge ohne Prüfung möglich');
  const facts = {
    branch,
    protection: Boolean(parsed),
    prRequired: parsed?.prRequired ?? false,
    approvals: parsed?.approvals ?? 0,
    enforceAdmins: parsed?.enforceAdmins ?? false,
    forcePushBlocked: parsed?.forcePushBlocked ?? false,
    deletionsBlocked: parsed?.deletionsBlocked ?? false,
    requiredChecks: parsed?.requiredChecks ?? [],
    rulesets: names.length,
  };
  return {
    ok: findings.length === 0,
    state: findings.length === 0 ? 'VERIFIED' : 'BLOCKED',
    findings,
    facts,
    step: findings.length === 0
      ? ''
      : 'Branch-Schutz fuer main mit Pull-Request-Zwang, enforce_admins und blockierten Force-Pushes/Deletes setzen (Administration-Rechte noetig).',
  };
}
