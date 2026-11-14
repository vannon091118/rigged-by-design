#!/usr/bin/env node
/**
 * Der eine Regenerationspfad fuer generierte Artefakte.
 *
 * Aufruf:
 *   node scripts/sync-generated.mjs                  # Arbeitsbaum regenerieren
 *   node scripts/sync-generated.mjs --staged         # zusaetzlich nur Generiertes stagen
 *   node scripts/sync-generated.mjs --all            # Narrative immer kompilieren
 *   node scripts/sync-generated.mjs --catalog        # Testkatalog im selben Lauf
 *   node scripts/sync-generated.mjs --check          # nur pruefen, nichts schreiben
 *
 * Regeln:
 * - Jede Datei kommt ausschliesslich aus ihrem Generator (`generated-files.mjs`).
 * - Handgeschriebene Narrative-Beitraege werden gelesen, nie ueberschrieben.
 * - `--check` schreibt nichts und meldet den veralteten Stand mit Exit 1.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './lib/report.mjs';
import {
  GENERATED_PATHS,
  NARRATIVE_SOURCE_PREFIX,
  applyRoadmapProgress,
  registryQuotaCount,
  roadmapProgress,
} from './lib/generated-files.mjs';

const args = process.argv.slice(2);
const check = args.includes('--check');
const staged = args.includes('--staged');
const all = args.includes('--all');
const catalog = args.includes('--catalog') || all;
const quiet = args.includes('--quiet');

const script = (name) => join(ROOT, 'scripts', name);
const run = (name, extra = []) =>
  execFileSync(process.execPath, [script(name), ...extra], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', quiet ? 'ignore' : 'pipe', 'inherit'],
  });

const git = (list) =>
  execFileSync('git', list, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** Geaenderte Pfade: Index im Hook-Betrieb, sonst Arbeitsbaum gegen HEAD. */
function changedPaths() {
  try {
    if (staged) {
      return git(['diff', '--cached', '--name-only', '--diff-filter=ACMR']).split(/\r?\n/).filter(Boolean);
    }
    return git(['status', '--porcelain'])
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => line.slice(3).trim());
  } catch {
    return [];
  }
}

const before = new Set(changedPaths());
const stale = [];

/**
 * Ein Generator meldet seine eigene Veraltung. Im Check-Modus wird der Befund
 * gesammelt, nicht als Abbruch geworfen: der Lauf nennt alle veralteten
 * Artefakte in einem Bericht. Fremde Aenderungen im Arbeitsbaum zaehlen nicht.
 */
function generate(scriptName, extra, outdated) {
  try {
    run(scriptName, extra);
  } catch (error) {
    if (!check) throw error;
    stale.push(...outdated);
  }
}

// 1. Testkatalog: derselbe Lauf, damit die Inventur nicht zweimal entsteht.
if (catalog) generate('test-catalog.mjs', check ? ['--check'] : [], ['docs/TEST-CATALOG.md']);

// 2. Doku-Marker: alte Versionsmarker werden kanonisch, fehlende ergaenzt.
generate('doc-sync.mjs', check ? ['--check'] : staged ? ['--staged'] : [], ['docs (Marker)']);

// 3. Narrative Registry: nur aus Beitraegen, nur wenn Quellen betroffen sind.
//    Vor der Inventur, weil die Inventur die erzeugten Dateien mitzaehlt.
const narrativeTouched = all || [...before].some((file) => file.startsWith(NARRATIVE_SOURCE_PREFIX));
if (narrativeTouched) {
  generate('compile-narrative-content.mjs', check ? ['--check'] : ['--write'], [
    'content/narrative/registry/fragments.json',
    'content/narrative/turns/manifest.json',
    'src/core/sim/narrative/composer/registry.generated.ts',
  ]);
}

// 4. Inventur: vollstaendig aus `git ls-files`, nach allen erzeugten Texten.
//    Im Check-Modus rein lesend.
generate('build-inventory.mjs', check ? ['--check'] : [], ['docs/INVENTORY.md']);

// 5. Roadmap-Fortschritt: die Zahl ist ein Messwert, keine Handarbeit.
const roadmapFile = join(ROOT, 'docs', 'ROADMAP.md');
const count = registryQuotaCount(ROOT);
if (existsSync(roadmapFile) && count !== null) {
  const current = readFileSync(roadmapFile, 'utf8');
  if (roadmapProgress(current) !== null && roadmapProgress(current) !== count) {
    if (check) stale.push('docs/ROADMAP.md');
    else writeFileSync(roadmapFile, applyRoadmapProgress(current, count));
  }
}

// 6. Staging: nur generierte Pfade, nie fremde Arbeit.
if (staged && !check) {
  const present = GENERATED_PATHS.filter((file) => existsSync(join(ROOT, file)));
  if (present.length > 0) {
    try {
      execFileSync('git', ['add', '--', ...present], { cwd: ROOT, stdio: ['ignore', 'ignore', 'ignore'] });
    } catch {
      // Ein Pfad kann in einem flachen Baum fehlen; die anderen bleiben gestaged.
    }
  }
}

if (check) {
  // Nur die Generatoren melden Veraltung; ein schmutziger Arbeitsbaum allein
  // ist kein Befund dieses Gates.
  const dirty = [...new Set(stale)].filter(Boolean);
  if (dirty.length > 0) {
    console.error('sync-generated: generierte Artefakte sind nicht aktuell:');
    for (const file of dirty.slice(0, 20)) console.error(`  - ${file}`);
    console.error('  Reparatur: node scripts/sync-generated.mjs');
    process.exit(1);
  }
  console.log('sync-generated: PASS (Inventur, Marker, Registry und Fortschritt aktuell)');
  process.exit(0);
}

if (!quiet) console.log('sync-generated: Inventur, Marker, Registry und Fortschritt regeneriert');
