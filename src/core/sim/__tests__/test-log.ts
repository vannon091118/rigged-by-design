/**
 * Strukturierte Testausgabe (#998): genau eine JSON-Zeile je Ereignis.
 *
 * Sim-Tests belegen ihren Verlauf mit Ausgabe. Damit diese Ausgabe lesbar
 * bleibt und nicht am 500-Token-Budget kratzt, schreibt jede Station ein
 * kompaktes Ereignis mit festen Feldern statt freiem Text. Mehrzeilige
 * Tabellen gehen als Bericht nach `.verify-cache/output/`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export type TestEventFields = Record<string, unknown>;

/** Ein Ereignis: eine JSON-Zeile auf stdout; die Reihenfolge bleibt die Abnahme. */
export function testEvent(scope: string, event: string, fields: TestEventFields = {}): void {
  process.stdout.write(`${JSON.stringify({ scope, event, ...fields })}\n`);
}

/** Mehrzeiliger Bericht unter `.verify-cache/output/<name>.log`; gibt den Pfad zurueck. */
export function writeTestReport(name: string, lines: readonly string[]): string {
  const target = resolve(process.cwd(), '.verify-cache/output', `${name}.log`);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${lines.join('\n')}\n`);
  return target;
}
