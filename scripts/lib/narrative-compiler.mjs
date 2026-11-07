/**
 * Narrative Compiler — Phase 4.2
 * Validiert und kompiliert Narrative-Templates zu ausführbaren Narratives.
 *
 * CRLF-Fix: normalizeEol ersetzt /\r\n|\r/g (nicht nur /\r\n/g),
 * sodass auch einzelne \r (altes Mac) korrekt normalisiert werden.
 */

import { normalizeEol, hasCRLF, hasLonelyCR, detectEOLVariants } from "../../src/core/narrative-compiler.js";

// Re-export for compatibility
export { normalizeEol, hasCRLF, hasLonelyCR, detectEOLVariants };

// Self-test on load
const CR_TEST = "line1\r\nline2\rline3";
const normalized = normalizeEol(CR_TEST);
if (normalized !== "line1\nline2\nline3") {
  throw new Error(
    `normalizeEol CRLF-Fix failed: expected "line1\\nline2\\nline3", got "${normalized}"`
  );
}