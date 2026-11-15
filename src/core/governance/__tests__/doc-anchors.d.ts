/**
 * Typen fuer das Anker-Gate (#860). Die Datei liegt bewusst neben ihrem Test:
 * `scripts-libs.d.ts` ist in der Hot Zone und waechst nicht mit jedem Modul.
 */
declare module '*/doc-anchors.mjs' {
  export interface DocLink {
    readonly target: string;
    readonly line: number;
  }
  export interface DocDocument {
    readonly path: string;
    readonly text: string;
  }
  export function slugifyHeading(text: string): string;
  export function collectAnchors(markdown: string): Set<string>;
  export function extractInternalLinks(markdown: string): DocLink[];
  export function parseLinkTarget(target: string): { readonly path: string; readonly anchor: string | null } | null;
  export function checkDocAnchors(documents?: readonly DocDocument[]): string[];
}
