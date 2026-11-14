/**
 * @test-target: src/Config/eslint.config.mjs
 * @proof-class: contract
 * @error-code: ERR-4001
 *
 * Die Determinismus-Sperre wird ueber den echten ESLint-Lauf geprueft, nicht
 * ueber eine Kopie der Selektoren. Computed Keys, Namespace-Wege, Aliase und
 * Destructuring muessen fail-closed sein; die benannte Entropie-Quelle bleibt
 * erlaubt.
 */
import { join } from 'node:path';
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: join(root, 'src/Config/eslint.config.mjs'),
});

async function lintGameplay(code: string, file = 'src/core/lint-probe.ts'): Promise<string[]> {
  const results = await eslint.lintText(code, { filePath: join(root, file) });
  const result = results[0];
  if (!result) throw new Error(`ESLint lieferte kein Ergebnis fuer ${file}`);
  return result.messages
    .filter((message) => message.ruleId?.startsWith('no-restricted-'))
    .map((message) => message.ruleId ?? '');
}

describe('Determinismus-Sperre gegen computed Property Access', { timeout: 30_000 }, () => {
  const forbidden: readonly [string, string][] = [
    ['Math computed', "const draw = Math['random']();"],
    ['globalThis computed namespace', "const draw = globalThis['Math']['random']();"],
    ['window computed namespace', "const draw = window['Math']['random']();"],
    ['Date computed', "const now = Date['now']();"],
    ['globalThis Date computed', "const now = globalThis['Date']['now']();"],
    ['performance computed', "const now = performance['now']();"],
    ['new computed Date', "const now = new globalThis['Date']();"],
    ['destructured Math.random', 'const { random } = Math; random();'],
    ['destructured globalThis.Date.now', "const { now } = globalThis['Date'];"],
    ['destructured performance.now', "const { now: clock } = window['performance'];"],
    ['Math alias', 'const m = Math; m.random();'],
  ];

  it.each(forbidden)('verbietet %s', async (_name, code) => {
    const rules = await lintGameplay(code);
    expect(rules.length).toBeGreaterThan(0);
  });

  it('laesst unkritische Math-Nutzung und PI-Destructuring zu', async () => {
    const rules = await lintGameplay(
      'const max = Math.max(1, 2);\nconst { PI } = Math;\nconst value = max * PI;',
    );
    expect(rules).toEqual([]);
  });

  it('laesst entropySeed() an der benannten Entropie-Stelle zu', async () => {
    const rules = await lintGameplay(
      'export const seed = entropySeed();',
      'src/core/rng/streams.ts',
    );
    expect(rules).toEqual([]);
  });

  it('verbietet computed getRandomValues ausserhalb der Entropie-Stelle', async () => {
    const rules = await lintGameplay(
      "const buffer = new Uint8Array(4); globalThis['crypto']['getRandomValues'](buffer);",
    );
    expect(rules.length).toBeGreaterThan(0);
  });
});
