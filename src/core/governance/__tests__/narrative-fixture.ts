/** Gemeinsamer Bestand und Temp-Fixture der Narrative-Content-Tests (NAR-09). */
import { cpSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  buildCompiledRegistry,
  renderRegistry,
  renderRuntimeRegistry,
  renderSlotMap,
} from '../../../../scripts/lib/narrative-compiler.mjs';
import { loadNarrativeContent, validateContribution } from '../../../../scripts/lib/narrative-content.mjs';

export const ROOT = resolve(process.cwd());
export const report = loadNarrativeContent(ROOT);
export const first = report.contributions[0];
export const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
export const messages = (issues: readonly { message: string }[]): string =>
  issues.map((entry) => entry.message).join(' | ');
export const schema = (data: unknown, path: string = first.path) =>
  validateContribution(data, report.vocabulary, path);

export const fixture = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'rbd-narrative-fixture-'));
  cpSync(join(ROOT, 'content/narrative'), join(root, 'content/narrative'), { recursive: true });
  const document = buildCompiledRegistry(report.contributions, report.vocabulary).document;
  const generated = join(root, 'src/core/sim/narrative/composer');
  mkdirSync(generated, { recursive: true });
  writeFileSync(join(root, 'content/narrative/registry/fragments.json'), renderRegistry(document));
  writeFileSync(join(generated, 'registry.generated.ts'), renderRuntimeRegistry(document));
  writeFileSync(join(generated, 'slot-map.generated.ts'), renderSlotMap(report.vocabulary));
  return root;
};
