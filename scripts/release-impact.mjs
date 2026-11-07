#!/usr/bin/env node
/**
 * Release-Relevanz: braucht dieser Stand wirklich ein APK?
 *
 * Bisher entschied eine pauschale Pfadliste (`scripts/`), dass jedes
 * CI-Skript einen Android-Bau ausloest. Hier zaehlt nur das ausgelieferte
 * Produkt: Runtime-Code, Content, Assets, Capacitor-Konfiguration und die
 * Build-Abhaengigkeiten. CI, Governance, Doku und Claims loesen keinen Bau aus.
 *
 * Aufruf: `node scripts/release-impact.mjs --prev=<tag> [--head=HEAD]`
 * Ausgabe: `apk=true|false` und eine Begruendung; mit `--github-output` auch
 * als Workflow-Output.
 */
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { ROOT } from './lib/report.mjs';
import { dependencyChangedBetween } from './lib/dependency-change.mjs';

const arg = (name) => {
  const hit = process.argv.slice(2).find((value) => value.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

// Ausgeliefertes Produkt. Tests, CI, Governance und Doku sind es nicht.
const PRODUCT = [/^src\//, /^content\//, /^public\//, /^index\.html$/, /^capacitor\.config\.json$/];
const TEST_FILE = /((^|\/)__tests__\/|\.(test|spec|bench)\.[cm]?[jt]sx?$)/;

const prev = arg('prev') ?? '';
const head = arg('head') ?? 'HEAD';
const outputFile = arg('github-output');
const git = (args) => {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
};

let files = null;
let reason = '';
if (!prev) {
  reason = 'kein Vorgaenger-Tag: Produktstand unbekannt, APK wird gebaut';
} else {
  const diff = git(['diff', '--name-only', `${prev}..${head}`]);
  if (diff === null) {
    reason = `Diff ${prev}..${head} nicht lesbar: konservativ APK bauen`;
  } else {
    files = diff.split(/\r?\n/).filter(Boolean);
    if (files.length === 0) reason = 'keine Aenderung seit dem letzten Tag';
  }
}

const relevant = files === null
  ? []
  : files.filter((file) => !TEST_FILE.test(file) && PRODUCT.some((pattern) => pattern.test(file)));
// Manifest/Lockfile nur bei echter Dependency-Aenderung; der Versionsbump
// allein ist kein Produktstand und braucht kein APK.
if (files !== null && dependencyChangedBetween(prev, head)) relevant.push('package.json');
const apk = files === null ? true : relevant.length > 0;
if (!reason) {
  reason = apk
    ? `Produktpfade geaendert (${relevant.slice(0, 4).join(', ')}${relevant.length > 4 ? `, +${relevant.length - 4}` : ''})`
    : `nur CI/Doku/Governance seit ${prev} (${files.length} Dateien)`;
}

if (outputFile) appendFileSync(outputFile, `apk=${apk}\nreason=${reason}\n`);
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Release-Relevanz\n\n- APK: \`${apk}\`\n- Grund: ${reason}\n`);
}
process.stdout.write(`apk=${apk}\nreason=${reason}\n`);
