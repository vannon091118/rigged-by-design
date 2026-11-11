/** Deterministische ID-Generierung für GameScout.
 *
 * Krypto-Zufall, Date.now() und Math.random() sind verboten (AGENTS.md Regel 5).
 * Stattdessen wird ein monoton steigender Zähler verwendet.
 */

let _idCounter = 0;

export function createId(prefix = 'id'): string {
  _idCounter++;
  return `${prefix}-${_idCounter}`;
}
