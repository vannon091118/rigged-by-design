/**
 * Ein Ausgabevertrag fuer das Lane-Claims-Gate: ROT auf stderr, GRUEN auf
 * stdout, Befunde immer sichtbar.
 */
import { compact } from './compact.mjs';

export function report({ status, headline, facts = [], findings = [], details = [] }) {
  const text = compact({ status, headline, facts, findings, details });
  if (String(status).toUpperCase() === 'ROT') console.error(text);
  else console.log(text);
}

/** Der eine GRUEN-Block des Lane-Gates; Pfadbelege nur mit RBD_VERBOSE=1. */
export function reportLaneGreen({
  branch, staged, ci, range, merging, diffBase, claim, baseRef, headRef,
  registerAudited, inherited, handedOver, mergedNotes, notes, allowedBySystem, generatedMeta,
}) {
  const systemNote = [
    allowedBySystem.length > 0 ? `${allowedBySystem.length} Meta-Datei(en) nur mit Marker/Version` : '',
    generatedMeta.length > 0 ? `${generatedMeta.length} generierte Inventur` : '',
  ].filter(Boolean).join(', ');
  const scope = ci ? `CI-Diff ${range}` : (merging ? `Merge-Diff ${diffBase}` : 'gestagte Dateien');
  report({
    status: 'GRUEN',
    headline: `${branch} · ${staged.length} Datei(en) · ${scope}`,
    facts: [
      ['Claim', `${claim.id} (${claim.owner}) · ${claim.status} · ${claim.pathAllowlist.length} Pfad(e)`],
      ['Basis', baseRef],
      ['Ref', ci ? headRef : 'HEAD'],
      ['Register', registerAudited ? 'gegen Basis geprueft' : ''],
      ['Belege', inherited.length > 0 || handedOver.length > 0 || mergedNotes.length > 0
        ? `${inherited.length} uebernommen · ${handedOver.length} zurueckgegeben · ${mergedNotes.length} gemergt`
        : ''],
      ['Meta', systemNote],
    ],
    details: [
      ...notes,
      ...mergedNotes,
      ...inherited.map((entry) => `uebernommen: ${entry}`),
      ...handedOver.map((entry) => `zurueckgegeben: ${entry}`),
      ...allowedBySystem.map((entry) => `Marker/Version: ${entry}`),
    ],
  });
}
