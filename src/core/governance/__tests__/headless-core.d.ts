declare module '*/headless-core.mjs' {
  export interface HeadlessViolation {
    readonly file: string;
    readonly specifier: string;
    readonly reason: string;
  }
  export interface HeadlessScan {
    readonly files: number;
    readonly violations: readonly HeadlessViolation[];
  }
  export const FORBIDDEN_PACKAGES: readonly string[];
  export function packageNameOf(specifier: string): string | null;
  export function classifySpecifier(specifier: string, fromFile: string, coreDir: string): string | null;
  export function listSourceFiles(dir: string): string[];
  export function scanHeadlessCore(root?: string): HeadlessScan;
}
