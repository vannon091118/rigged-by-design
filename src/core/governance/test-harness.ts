/**
 * Vitest-Reporter fuer den Fail-Closed-Testvertrag: jeder Testfall wird mit
 * Index und registriertem ERR-Code ausgegeben. Der Header der Testdatei
 * liefert den Code; fehlt er, ist der Lauf sofort ERR-0000.
 * @error-code: ERR-4001
 */
import { readFileSync } from 'node:fs';
import type { Reporter, TestCase } from 'vitest/node';
import { formatError, isKnownCode } from './error-codes';

const FALLBACK = 'ERR-0000';

function errorCodeFor(file: string): string {
  try {
    const header = readFileSync(file, 'utf8').slice(0, 600);
    const match = /@error-code:\s*(ERR-\d{4})/.exec(header);
    if (match && isKnownCode(match[1]!)) return match[1]!;
  } catch {
    // Der Testvertrag wird vor dem Lauf von verify-test-quality geprueft.
  }
  return FALLBACK;
}

function emit(index: number, code: string, component: string, message: string): void {
  try {
    console.log(formatError(index, code, component, message));
  } catch (error) {
    console.log(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

export class GovernanceReporter implements Reporter {
  #index = 0;
  readonly #codes = new Map<string, string>();

  onTestCaseResult(testCase: TestCase): void {
    this.#index += 1;
    const file = testCase.module.moduleId;
    let code = this.#codes.get(file);
    if (!code) {
      code = errorCodeFor(file);
      this.#codes.set(file, code);
    }
    // Ein uebersprungener Test ist kein Fehlschlag: er meldet SKIP statt FAIL.
    const state = testCase.result().state;
    const label = state === 'passed' ? 'PASS' : state === 'skipped' || state === 'pending' ? 'SKIP' : 'FAIL';
    emit(this.#index, code, testCase.module.relativeModuleId, `${testCase.fullName}: ${label}`);
  }
}
