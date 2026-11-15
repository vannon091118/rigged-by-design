/**
 * Fixture fuer die Testdatei-Erkennung des Headless-Core-Scanners (#916).
 *
 * Die Datei liegt bewusst **ohne** `__tests__/` im Baum und importiert aus
 * `src/store/`. Ohne die `.spec.`-Regel in `isTestFile` meldet
 * `scanHeadlessCore` hier `relativer Import … verlaesst src/core`; mit der
 * Regel ist sie als Testdatei erlaubt. Vitest sammelt sie nicht, weil
 * `test.include` nur `src/**\/*.test.{ts,tsx}` umfasst.
 */
export { worldStore } from '../../../store/world-store';
