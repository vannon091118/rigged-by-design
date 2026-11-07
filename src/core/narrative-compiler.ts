/**
 * Narrative Compiler — Phase 4
 * Kompiliert Narrative-Templates zu ausführbaren Narratives.
 * Fix: normalizeEol ersetzt jetzt auch einzelne \r (nicht nur \r\n).
 */

import type { Narrative } from "./narrative-engine";

/**
 * Rohes Narrative-Template vor der Kompilierung.
 */
export interface RawNarrativeTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly domain: string;
  readonly version: string;
  readonly conditions: unknown; // rohe Bedingungen
  readonly consequences: unknown; // rohe Konsequenzen
  readonly weight: number;
  readonly cooldownTicks: number;
  readonly tags: string[];
}

/**
 * Kompiliertes Narrative.
 */
export interface CompiledNarrative extends Narratic {
  readonly compiledAt: number;
  readonly validationErrors: string[];
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
interface Narratic extends Narrative {}

/**
 * Validierungsfehler während der Kompilierung.
 */
export interface CompilationError {
  readonly templateId: string;
  readonly field: string;
  readonly message: string;
}

/**
 * Narrative Compiler — validiert und kompiliert Templates.
 */
export class NarrativeCompiler {
  private errors: CompilationError[] = [];

  /**
   * Kompiliert ein rohes Template zu einem validierten Narrative.
   * Gibt null zurück wenn Validierung fehlschlägt.
   */
  compile(template: RawNarrativeTemplate): { narrative: Narrative | null; errors: CompilationError[] } {
    this.errors = [];

    // Pflichtfelder prüfen
    if (!template.id || typeof template.id !== "string") {
      this.errors.push({ templateId: template.id ?? "unknown", field: "id", message: "Missing or invalid id" });
    }
    if (!template.title || typeof template.title !== "string") {
      this.errors.push({ templateId: template.id, field: "title", message: "Missing or invalid title" });
    }
    if (!template.domain || typeof template.domain !== "string") {
      this.errors.push({ templateId: template.id, field: "domain", message: "Missing or invalid domain" });
    }
    if (!template.version || typeof template.version !== "string") {
      this.errors.push({ templateId: template.id, field: "version", message: "Missing or invalid version" });
    }
    if (typeof template.weight !== "number" || template.weight < 0 || template.weight > 10000) {
      this.errors.push({ templateId: template.id, field: "weight", message: "Weight must be 0..10000" });
    }
    if (typeof template.cooldownTicks !== "number" || template.cooldownTicks < 0) {
      this.errors.push({ templateId: template.id, field: "cooldownTicks", message: "cooldownTicks must be >= 0" });
    }

    if (this.errors.length > 0) {
      return { narrative: null, errors: [...this.errors] };
    }

    const narrative: Narrative = {
      id: template.id,
      title: template.title,
      description: template.description,
      domain: template.domain,
      version: template.version,
      conditions: Array.isArray(template.conditions) ? template.conditions as any : [],
      consequences: Array.isArray(template.consequences) ? template.consequences as any : [],
      weight: template.weight,
      cooldownTicks: template.cooldownTicks,
      lastExecutedTick: undefined,
      executionCount: 0,
      tags: Array.isArray(template.tags) ? template.tags : [],
    };

    return { narrative, errors: [] };
  }

  /**
   * Kompiliert mehrere Templates auf einmal.
   */
  compileAll(templates: RawNarrativeTemplate[]): {
    compiled: Narrative[];
    errors: CompilationError[];
  } {
    const compiled: Narrative[] = [];
    const allErrors: CompilationError[] = [];

    for (const template of templates) {
      const result = this.compile(template);
      if (result.narrative) {
        compiled.push(result.narrative);
      }
      allErrors.push(...result.errors);
    }

    return { compiled, errors: allErrors };
  }

  getErrors(): CompilationError[] {
    return [...this.errors];
  }
}

export const narrativeCompiler = new NarrativeCompiler();

// ──────────────────────────────────────────────────────────────────────────────
// EOL-Normalisierung (CRLF-Fix)
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Normalisiert Zeilenumbrüche: ersetzt \r\n, \r und \n durch \n.
 *
 * FIX: Die vorherige Implementation ersetzte nur \r\n, nicht einzelne \r.
 * Jetzt werden alle drei Varianten behandelt:
 *   \r\n (Windows) → \n
 *   \r  (altes Mac)  → \n
 *   \n  (Unix)       → \n (unverändert)
 */
export function normalizeEol(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Prüft ob Text Windows-CRLF Zeilenumbrüche enthält.
 */
export function hasCRLF(text: string): boolean {
  return /\r\n/.test(text);
}

/**
 * Prüft ob Text einzelne \r (ohne \n) enthält.
 */
export function hasLonelyCR(text: string): boolean {
  return /\r(?!\n)/.test(text);
}

/**
 * Gibt alle EOL-Varianten im Text zurück (für Diagnose).
 */
export function detectEOLVariants(text: string): string[] {
  const variants: string[] = [];
  if (hasCRLF(text)) variants.push("CRLF (\\r\\n)");
  if (hasLonelyCR(text)) variants.push("Lonely CR (\\r)");
  if (/\n/.test(text)) variants.push("LF (\\n)");
  return variants;
}