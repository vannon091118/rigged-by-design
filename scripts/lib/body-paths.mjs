/**
 * Pfadklassen der Commit-/PR-Bodies. Eigene Datei, weil `body-sync.mjs` sonst
 * die Hot-Zone reisst; die Semantik bleibt unveraendert.
 */
export const VERSION_PATH = /^(?:package\.json|pnpm-lock\.yaml)$/;
export const TEST_PATH = /(?:^|\/)__tests__\/|\.test\.tsx?$|\.bench\.ts$/;
export const RUNTIME_PATH = /^src\//;
export const CONTENT_PATH = /^(?:content|public)\//;
export const GOVERNANCE_PATH = /^(?:AGENTS\.md|\.github\/|\.githooks\/|\.lane-claims\/|\.mailmap$|CODEOWNERS$)/;
export const DOCS_PATH = /^(?:README\.md|docs\/)/;
export const TOOLING_PATH = /^scripts\//;
