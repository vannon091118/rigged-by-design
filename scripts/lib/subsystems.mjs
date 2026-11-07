/**
 * Ein Ort fuer Subsysteme und Ordnerregeln.
 *
 * Vier Stellen brauchten dieselbe Einteilung: der Testkatalog (System aus dem
 * @test-target), die Impact-Auswahl (Subsystem einer Aenderung), der
 * Impact-Bericht (Doku und Invarianten) und das Tree-Gate (Ordner, Endungen).
 * Alle vier lesen jetzt hier, statt ihre eigene Liste zu pflegen.
 *
 * Die Reihenfolge ist bedeutsam: die erste Uebereinstimmung gilt. Deshalb steht
 * `src/core/sim/narrative` vor `src/core/sim`.
 */

/** Ordnerregeln des Tree-Gates: erlaubte Endungen je Bereich. */
export const AREAS = Object.freeze([
  { dir: 'src/Config', ext: ['.json', '.mjs', '.ts', '.tsbuildinfo'], note: 'Werkzeug-Configs liegen gesammelt in src/Config' },
  { dir: 'src/core', ext: ['.ts'], note: 'Core bleibt headless und ohne UI' },
  { dir: 'src/store', ext: ['.ts'], note: 'Store besitzt Zustand und Save' },
  { dir: 'src/ui', ext: ['.ts', '.tsx'], note: 'UI enthaelt Komponenten, keine Stylesheets' },
  { dir: 'src/render', ext: ['.ts', '.tsx', '.json'], note: 'Render enthaelt Pixi-Code und Manifeste' },
  { dir: 'src/styles', ext: ['.css'], note: 'Styles liegen gesammelt in src/styles' },
  { dir: 'src/test', ext: ['.ts'], note: 'Test-Helfer gehoeren unter src/test' },
  { dir: 'scripts', ext: ['.mjs', '.sh'], note: 'Werkzeuge sind ESM-Skripte, Bootstrap darf Shell sein' },
  { dir: 'docs', ext: ['.md', '.svg', '.png', '.jpg', '.webp', '.json'], note: 'Doku enthaelt Text und Belege' },
  { dir: 'content', ext: ['.json', '.md'], note: 'Content ist Daten und Text, kein Code' },
  { dir: '.github', ext: ['.yml', '.yaml', '.md'], note: 'Workflows sind YAML' },
  { dir: '.githooks', ext: [''], note: 'Hooks sind ausfuehrbare Shell-Dateien ohne Endung' },
]);

/**
 * Subsysteme mit ihrem Namen und dem, was eine Aenderung dort mitzieht.
 * `catalog: false` heisst: das System ist eine Verfeinerung und bekommt keinen
 * eigenen Katalogeintrag. `impactDocs` fehlt bewusst bei Subsystemen, die im
 * Impact-Bericht keine Doku nennen (heute: sim, games, governance, physics, test).
 */
export const SUBSYSTEMS = Object.freeze([
  {
    prefix: 'src/core/sim/narrative',
    name: 'narrative',
    catalog: false,
    impactDocs: ['ARCHITECTURE'],
    invariants: ['WorldState.narrative ist der einzige persistente Narrativ-Zustand', 'Facts sind der Ereignisstrom, das Journal bleibt Spielerhistorie'],
  },
  { prefix: 'src/core/games', name: 'games', appBuild: true, invariants: [] },
  { prefix: 'src/core/sim', name: 'sim', appBuild: true, invariants: [] },
  {
    prefix: 'src/core/economy',
    name: 'economy',
    appBuild: true,
    impactDocs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['Betraege sind ganzzahlige Mikro-Einheiten; jede Buchung ist eine Ledger-Zeile', 'keine Geldquelle ausser EXTERNAL_WORLD'],
  },
  {
    prefix: 'src/core/rng',
    name: 'rng',
    appBuild: true,
    impactDocs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['kein Math.random/Date.now/new Date; Zufall nur aus dem geseedeten Prng', 'gameplay und presentation teilen nie einen Strom'],
  },
  { prefix: 'src/core/physics', name: 'physics', appBuild: true, invariants: [] },
  { prefix: 'src/core/governance', name: 'governance', appBuild: true, invariants: [] },
  {
    prefix: 'src/render',
    name: 'render',
    appBuild: true,
    impactDocs: ['ARCHITECTURE'],
    invariants: ['Renderer zieht Zufall nur aus src/render/rng.ts'],
  },
  {
    prefix: 'src/ui',
    name: 'ui',
    appBuild: true,
    impactDocs: ['ARCHITECTURE', 'ROADMAP'],
    invariants: ['UI liest Snapshots und haelt keinen zweiten Spielzustand'],
  },
  {
    prefix: 'src/store',
    name: 'store',
    appBuild: true,
    impactDocs: ['ARCHITECTURE', 'INVENTORY'],
    invariants: ['ein Eigentuemer pro Zustand: world, ledger, PRNG und Save liegen im world-store', 'Save-Migration nur vorwaerts, v3/v4 verworfen'],
  },
  { prefix: 'src/test', name: 'test-tools', invariants: [] },
  { prefix: 'src/styles', name: 'styles', appBuild: true, impactDocs: ['ARCHITECTURE'], invariants: [] },
  { prefix: 'content', name: 'content', appBuild: true, impactDocs: ['ARCHITECTURE'], invariants: ['Texte sind Darstellung, nie Spielregel'] },
  { prefix: 'public', name: 'public-assets', appBuild: true, impactDocs: ['ARCHITECTURE'], invariants: [] },
  { prefix: 'index.html', name: 'entry', catalog: false, appBuild: true, impactDocs: [], invariants: [] },
  { prefix: 'src/Config/vite.config.ts', name: 'vite-config', catalog: false, appBuild: true, impactDocs: ['AGENTS', 'ARCHITECTURE'], invariants: [] },
  { prefix: 'package.json', name: 'package-manifest', catalog: false, dependencyManifest: true, impactDocs: [], invariants: [] },
  { prefix: 'pnpm-lock.yaml', name: 'dependency-lock', catalog: false, dependencyManifest: true, impactDocs: [], invariants: [] },
  {
    prefix: 'scripts',
    name: 'pipeline',
    impactDocs: ['ARCHITECTURE', 'AGENTS'],
    invariants: ['kein Gate schreibt im Verify-Lauf'],
  },
  {
    prefix: '.github',
    name: 'ci',
    impactDocs: ['ARCHITECTURE', 'AGENTS'],
    invariants: ['der Pflichtstatus heisst Fail-Closed Gates'],
  },
  {
    prefix: 'src/Config',
    name: 'config',
    impactDocs: ['AGENTS', 'ARCHITECTURE'],
    invariants: ['eine Config, ein Ort in src/Config'],
  },
  { prefix: 'docs', name: 'docs', impactDocs: [], invariants: ['sechs Pflichtdokumente, Marker via docs:sync'] },
]);

/** Katalogsysteme: jede Testdatei gehoert genau einem davon. */
export const CATALOG_SYSTEMS = Object.freeze(
  SUBSYSTEMS.filter((entry) => entry.catalog !== false).map((entry) => [entry.prefix, entry.name]),
);

/** Was eine Aenderung an Doku und Invarianten mitzieht. */
export const IMPACT_AREAS = Object.freeze(
  SUBSYSTEMS.filter((entry) => entry.impactDocs !== undefined)
    .map((entry) => ({ prefix: entry.prefix, docs: entry.impactDocs, invariants: entry.invariants })),
);

/** Praefix des Subsystems, zu dem ein Pfad gehoert, oder null. */
export function subsystemPrefixOf(file) {
  const normalized = String(file ?? '').replaceAll('\\', '/');
  for (const entry of SUBSYSTEMS) {
    if (entry.catalog === false) continue;
    if (normalized === entry.prefix || normalized.startsWith(`${entry.prefix}/`)) return entry.prefix;
  }
  return null;
}
