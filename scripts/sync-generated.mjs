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

// 1. Testkatalog: derselbe Lauf, damit die Inventur nicht zweimal entsteht.
if (catalog) run('test-catalog.mjs', check ? ['--check'] : []);

// 2. Inventur: vollstaendig aus `git ls-files`.
run('build-inventory.mjs');

// 3. Doku-Marker: alte Versionsmarker werden kanonisch, fehlende ergaenzt.
run('doc-sync.mjs', check ? ['--check'] : staged ? ['--staged'] : []);

// 4. Narrative Registry: nur aus Beitraegen, nur wenn Quellen betroffen sind.
const narrativeTouched = all || [...before].some((file) => file.startsWith(NARRATIVE_SOURCE_PREFIX));
if (narrativeTouched) {
  run('compile-narrative-content.mjs', check ? ['--check'] : ['--write']);
}

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
  const dirty = [...new Set([...changedPaths(), ...stale])].filter(Boolean);
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
