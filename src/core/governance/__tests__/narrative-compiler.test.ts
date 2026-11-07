/**
 * Narrative Compiler Tests — Phase 4.2
 * Vitest-Tests für den Narrative-Compiler und die EOL-Normalisierung.
 * Pfad: src/core/governance/__tests__/narrative-compiler.test.ts
 *
 * Akzeptanzkriterium: pnpm run vitest run src/core/governance/__tests__/narrative-compiler.test.ts grün
 */

import {
  describe,
  it,
  expect,
} from "vitest";
import {
  narrativeCompiler,
  normalizeEol,
  hasCRLF,
  hasLonelyCR,
  detectEOLVariants,
  type RawNarrativeTemplate,
} from "../../../core/narrative-compiler.js";

describe("Narrative Compiler (Phase 4.2)", () => {
  it("compiles a valid template", () => {
    const template: RawNarrativeTemplate = {
      id: "n-1",
      title: "Test",
      description: "A test narrative",
      domain: "social",
      version: "1.0.0",
      conditions: [],
      consequences: [],
      weight: 5000,
      cooldownTicks: 10,
      tags: ["test"],
    };

    const result = narrativeCompiler.compile(template);
    expect(result.errors).toHaveLength(0);
    expect(result.narrative).toBeDefined();
    expect(result.narrative!.id).toBe("n-1");
  });

  it("rejects template with missing id", () => {
    const template: RawNarrativeTemplate = {
      id: "",
      title: "Test",
      description: "Desc",
      domain: "social",
      version: "1.0.0",
      conditions: [],
      consequences: [],
      weight: 5000,
      cooldownTicks: 10,
      tags: [],
    };

    const result = narrativeCompiler.compile(template);
    expect(result.narrative).toBeNull();
    expect(result.errors.some((e) => e.field === "id")).toBe(true);
  });

  it("rejects template with invalid weight", () => {
    const template: RawNarrativeTemplate = {
      id: "n-1",
      title: "Test",
      description: "Desc",
      domain: "social",
      version: "1.0.0",
      conditions: [],
      consequences: [],
      weight: 15000, // > 10000
      cooldownTicks: 10,
      tags: [],
    };

    const result = narrativeCompiler.compile(template);
    expect(result.narrative).toBeNull();
    expect(result.errors.some((e) => e.field === "weight")).toBe(true);
  });

  it("compiles multiple templates", () => {
    const templates: RawNarrativeTemplate[] = [
      {
        id: "n-1",
        title: "One",
        description: "D1",
        domain: "social",
        version: "1.0.0",
        conditions: [],
        consequences: [],
        weight: 5000,
        cooldownTicks: 10,
        tags: [],
      },
      {
        id: "n-2",
        title: "Two",
        description: "D2",
        domain: "work",
        version: "1.0.0",
        conditions: [],
        consequences: [],
        weight: 3000,
        cooldownTicks: 5,
        tags: [],
      },
    ];

    const result = narrativeCompiler.compileAll(templates);
    expect(result.compiled.length).toBe(2);
    expect(result.errors).toHaveLength(0);
  });

  it("compilation errors are tracked with exact field", () => {
    const template: RawNarrativeTemplate = {
      id: "",
      title: "",
      description: "",
      domain: "",
      version: "",
      conditions: [],
      consequences: [],
      weight: -1,
      cooldownTicks: -5,
      tags: [],
    };

    const result = narrativeCompiler.compile(template);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

describe("EOL Normalization (CRLF Fix)", () => {
  it("normalizes CRLF to LF", () => {
    expect(normalizeEol("line1\r\nline2")).toBe("line1\nline2");
  });

  it("normalizes lonely CR to LF (THE FIX)", () => {
    expect(normalizeEol("line1\rline2")).toBe("line1\nline2");
  });

  it("normalizes mixed EOLs", () => {
    expect(normalizeEol("line1\r\nline2\rline3\nline4")).toBe(
      "line1\nline2\nline3\nline4"
    );
  });

  it("leaves pure LF unchanged", () => {
    expect(normalizeEol("line1\nline2")).toBe("line1\nline2");
  });

  it("detects CRLF", () => {
    expect(hasCRLF("line1\r\nline2")).toBe(true);
    expect(hasCRLF("line1\nline2")).toBe(false);
  });

  it("detects lonely CR", () => {
    expect(hasLonelyCR("line1\rline2")).toBe(true);
    expect(hasLonelyCR("line1\r\nline2")).toBe(false); // \r\n is not lonely
    expect(hasLonelyCR("line1\nline2")).toBe(false);
  });

  it("detects all EOL variants", () => {
    const variants = detectEOLVariants("line1\r\nline2\rline3\n");
    expect(variants).toContain("CRLF (\\r\\n)");
    expect(variants).toContain("Lonely CR (\\r)");
    expect(variants).toContain("LF (\\n)");
  });

  it("empty string has no variants", () => {
    expect(detectEOLVariants("")).toHaveLength(0);
  });
});