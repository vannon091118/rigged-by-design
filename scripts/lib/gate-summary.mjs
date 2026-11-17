/** Schreibt die Markdown-Zusammenfassung eines Gate-Laufs in den Berichtsordner. */
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

export function writeSummary({ rows, failed, dir, root }) {
  if (!dir || rows.length === 0) return;
  const lines = [
    '# Gate-Bericht',
    '',
    `Erstellt: ${new Date().toISOString()}`,
    `Ergebnis: ${failed.length === 0 ? 'PASS' : `FAIL (${failed.join(', ')})`}`,
    '',
    '| Gate | Ergebnis | Dauer | Log |',
    '| --- | --- | --- | --- |',
    ...rows.map((row) => `| ${row.name} | ${row.status} | ${row.seconds}s | ${row.logPath ? `\`${row.logPath}\`` : '—'} |`),
  ];
  try {
    writeFileSync(join(dir, 'summary.md'), `${lines.join('\n')}\n`);
    console.log(`Gate-Bericht: ${relative(root, dir).replaceAll('\\', '/')}/summary.md`);
  } catch {
    // Der Bericht ist Komfort; das Gate-Ergebnis haengt nicht daran.
  }
}
