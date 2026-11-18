#!/usr/bin/env node
import { readFileSync, existsSync, unlinkSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';

// Finde den Skill-Ordner relativ zu diesem Script
const scriptFile = new URL(import.meta.url).pathname;
// Windows: "/D:/Projekte/..." -> "D:/Projekte/..."
const skillPath = scriptFile.replace(/^\/([a-zA-Z]):\//, '$1:/').replace(/\/$/, '');
const SKILL_DIR = join(skillPath, '..');
const REPORTS_DIR = join(SKILL_DIR, 'reports');
const FINAL_REPORT = join(REPORTS_DIR, 'AUDIT-FINAL.md');
const ROOT = join(SKILL_DIR, '..', '..', '..');

const PHASE_FILES = [
  { file: 'phase-0-drift.md',       label: 'Phase 0 — Drift Tracker (History)' },
  { file: 'phase-1-governance.md',  label: 'Phase 1 — Governance' },
  { file: 'phase-2-gamedesign.md',  label: 'Phase 2 — Gamedesign' },
  { file: 'phase-3-tooling.md',     label: 'Phase 3 — Tooling' },
];

const GRADE_ORDER = ['A', 'B', 'C', 'D', 'E', 'F'];

function gradeValue(g) {
  const v = GRADE_ORDER.indexOf(String(g).toUpperCase().trim());
  return v < 0 ? 3 : v;
}

function gradeLetter(v) {
  if (v < 0) return '?';
  if (v >= GRADE_ORDER.length) return 'F';
  return GRADE_ORDER[v];
}

function findReportFile(name) {
  try {
    const files = readdirSync(REPORTS_DIR);
    const target = name.toLowerCase().replace(/\.md$/, '');
    for (const f of files) {
      if (f.toLowerCase().replace(/\.md$/, '') === target) {
        return join(REPORTS_DIR, f);
      }
    }
  } catch {}
  return null;
}

function parseGradesFromReport(text) {
  const candidates = [];
  const lines = text.split('\n');
  let currentDecision = null, currentGrade = null, currentBefund = null, currentQuelle = null;

  function flush() {
    if (currentDecision) {
      candidates.push({ decision: currentDecision, grade: currentGrade || '?', befund: currentBefund || '', quelle: currentQuelle || '' });
    }
    currentDecision = null; currentGrade = null; currentBefund = null; currentQuelle = null;
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Decision start: "Entscheidung N: ...", "- Entscheidung N: ...", with optional "— **Note X**" on same line
    const decMatch = trimmed.match(/^(?:#{1,6}\s*)?(?:\*\*)?(?:-?\s*)?(?:Entscheidung|Design|Decision)\s*\d*\s*(?:—|-|:)\s*(.+)/i);
    if (decMatch) {
      const carriedGrade = currentGrade;  // grade from preceding "**Note X**" header line
      flush();
      const raw = decMatch[1];
      const sameLineGrade = raw.match(/\*\*?Note\s*([A-F])\*\*?/i);
      const decisionText = sameLineGrade
        ? raw.replace(/\s*—\s*\*\*?Note\s*[A-F]\*\*?/i, '').replace(/\*\*/g, '').trim()
        : raw.replace(/\*\*/g, '').trim();
      currentDecision = decisionText;
      if (sameLineGrade) {
        currentGrade = sameLineGrade[1].toUpperCase();
      } else if (carriedGrade) {
        currentGrade = carriedGrade;
      }
      continue;
    }

    // "- Note X: description" — grade and decision text on same line (Phase 1 summary format)
    const noteDescMatch = trimmed.match(/^(?:-?\s*)\*\*?Note\*\*?\s*([A-F])\*\*?:\s*(.+)/i);
    if (noteDescMatch) {
      flush();
      currentGrade = noteDescMatch[1].toUpperCase();
      currentDecision = noteDescMatch[2].replace(/\*\*/g, '').trim();
      continue;
    }

    // Grade on its own line: "Note X:", "**Note X:**", "**Note X (text):**", "— **Note X**"
    const gradeMatch = trimmed.match(/\*\*?Note\*\*?(?:\s*\([^)]*\))?:\s*([A-F])/i) ||
                       trimmed.match(/\*\*?Note\s+([A-F])\b/i) ||
                       trimmed.match(/—\s*\*\*?Note\s*([A-F])\*\*?/i);
    if (gradeMatch) {
      const g = gradeMatch[1] || gradeMatch[gradeMatch.length - 1];
      currentGrade = g.toUpperCase();
      continue;
    }

    // Befund
    const befundMatch = trimmed.match(/\*\*?Befund\*\*?:\s*(.*)/i);
    if (befundMatch) { currentBefund = befundMatch[1].trim(); continue; }

    // Quelle
    const quelleMatch = trimmed.match(/\*\*?Quelle\*\*?:\s*(.*)/i);
    if (quelleMatch) { currentQuelle = quelleMatch[1].trim(); continue; }

    // Continuation line for Befund (starts with -)
    if (currentBefund !== null && trimmed.startsWith('-') && !trimmed.match(/^(Note|Befund|Quelle|Entscheidung):/i)) {
      currentBefund += ' ' + trimmed.replace(/^-/, '').trim();
    }

    // Table row: | # | Bereich | Note X | Befund | Quelle |
    const tableMatch = trimmed.match(/^\|\s*\d+\s*\|\s*([^|]+?)\s*\|\s*\*\*?\s*([A-F])\s*\*\*?\s*\|\s*([^|]*?)\s*\|\s*([^|]*?)\s*\|/i);
    if (tableMatch) {
      candidates.push({
        decision: tableMatch[1].trim(),
        grade: tableMatch[2].toUpperCase(),
        befund: tableMatch[3].trim(),
        quelle: tableMatch[4].trim()
      });
      continue;
    }
  }
  flush();

  // Canonical key: all significant words, hyphens collapsed to spaces, punctuation stripped
  function canonKey(dec) {
    return dec
      .toLowerCase()
      .replace(/^(entscheidung|design|decision)\s*\d*\s*[:—-]\s*/i, '')
      .replace(/[-—]/g, ' ')
      .replace(/[^\w\säöüß]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .split(/\s+/)
      .filter(w => w.length > 2)
      .join(' ')
      .slice(0, 120);
  }

  function wordSet(key) {
    return new Set(key.split(/\s+/));
  }

  // Deduplicate: same decision = >=80% word overlap, keep the one with a grade
  const unique = [];
  for (const c of candidates) {
    const key = canonKey(c.decision);
    const ws = wordSet(key);
    const existingIdx = unique.findIndex(u => {
      const uk = canonKey(u.decision);
      const uws = wordSet(uk);
      const inter = new Set([...ws].filter(w => uws.has(w)));
      return inter.size / Math.min(ws.size, uws.size) >= 0.8;
    });
    if (existingIdx === -1) {
      unique.push(c);
    } else if (c.grade !== '?' && unique[existingIdx].grade === '?') {
      unique[existingIdx] = c;
    }
  }

  return unique;
}

function readReport(name) {
  const path = findReportFile(name);
  const found = !!path;
  if (!path) return { text: '(Report nicht gefunden: ' + name + ')', grades: [], found: false };
  try {
    const text = readFileSync(path, 'utf-8');
    return { text, grades: parseGradesFromReport(text), found: true };
  } catch { return { text: '(Report nicht lesbar: ' + name + ')', grades: [], found: false }; }
}

function averageGrade(allGrades) {
  if (allGrades.length === 0) return '?';
  const sum = allGrades.reduce((acc, g) => acc + gradeValue(g.grade), 0);
  return gradeLetter(Math.round(sum / allGrades.length));
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Adversarial Code Review — Driver\nUsage: node driver.mjs --consolidate\n--consolidate   4 Phase-Berichte -> AUDIT-FINAL.md, dann löschen');
    return;
  }
  if (!args.includes('--consolidate')) { console.error('Unbekannte Option. Nutze --consolidate oder --help.'); process.exit(1); }

  const phases = {};
  let allPresent = true;
  for (const { file, label } of PHASE_FILES) {
    const rep = readReport(file);
    phases[file] = { label, ...rep };
    if (!rep.found) { allPresent = false; console.warn('WARNUNG: Phase-Bericht nicht gefunden: ' + file); }
  }

  if (!allPresent) {
    console.error('Nicht alle 4 Phase-Berichte vorhanden.');
    process.exit(1);
  }

  const allDecisions = [];
  for (const { file, label } of PHASE_FILES) {
    for (const g of phases[file].grades) { allDecisions.push({ phase: label, file, ...g }); }
  }
  const overallGrade = averageGrade(allDecisions);

  const phaseAvg = {};
  for (const { file, label } of PHASE_FILES) {
    phaseAvg[label] = phases[file].grades.length > 0 ? averageGrade(phases[file].grades) : '?';
  }

  const critical = allDecisions.filter(d => ['D', 'E', 'F'].includes(d.grade));
  const medium = allDecisions.filter(d => d.grade === 'C');

  const lines = [];
  lines.push('# Adversarial Code Review — Finale Audit (Rigged by Design)');
  lines.push('');
  lines.push('Erstellt: ' + new Date().toISOString());
  lines.push('Repository: ' + ROOT);
  lines.push('Methode: 4 sequentielle Phasen (Drift Tracker → Governance → Gamedesign → Tooling), konsolidiert zu einem Report.');
  lines.push('');
  lines.push('## Gesamtergebnis');
  lines.push('| Phase | Note | Entscheidungen |');
  lines.push('|-------|------|----------------|');
  for (const { file, label } of PHASE_FILES) {
    lines.push('| ' + label + ' | ' + phaseAvg[label] + ' | ' + phases[file].grades.length + ' |');
  }
  lines.push('');
  lines.push('| **Gesamt-Durchschnitt** | **' + overallGrade + '** | **' + allDecisions.length + '** |');
  lines.push('');
  lines.push('## Alle Designentscheidungen (mit Note, Befund und zurückverfolgbarer Quelle)');
  lines.push('| # | Phase | Entscheidung | Note | Befund | Quelle |');
  lines.push('|---|-------|--------------|------|--------|--------|');
  let i = 0;
  for (const d of allDecisions) {
    i++;
    const befund = d.befund ? d.befund.slice(0, 100) + (d.befund.length > 100 ? '…' : '') : '—';
    const quelle = d.quelle ? d.quelle.slice(0, 60) + (d.quelle.length > 60 ? '…' : '') : '—';
    lines.push('| ' + i + ' | ' + d.phase + ' | ' + d.decision + ' | ' + d.grade + ' | ' + befund + ' | ' + quelle + ' |');
  }
  lines.push('');
  lines.push('## Kritische Befunde (Note D–F) — muss vor Merge behoben werden');
  lines.push('');
  if (critical.length > 0) {
    for (const d of critical) {
      lines.push('### ' + d.phase + ' — ' + d.decision);
      lines.push('- **Note:** ' + d.grade);
      lines.push('- **Befund:** ' + (d.befund || '—'));
      lines.push('- **Quelle:** ' + (d.quelle || '—'));
      lines.push('');
    }
  } else { lines.push('Keine kritischen Befunde. ✅'); lines.push(''); }
  lines.push('## Mittlere Befunde (Note C) — Verbesserungsbedarf');
  lines.push('');
  if (medium.length > 0) {
    for (const d of medium) {
      lines.push('- [' + d.phase + '] ' + d.decision + ' — **' + d.grade + '**');
      if (d.befund) lines.push('  Befund: ' + d.befund);
      if (d.quelle) lines.push('  Quelle: ' + d.quelle);
    }
    lines.push('');
  } else { lines.push('Keine mittleren Befunde. ✅'); lines.push(''); }
  lines.push('## Detail-Berichte (konsolidiert aus allen 4 Phasen)');
  lines.push('');
  for (const { file, label } of PHASE_FILES) {
    lines.push('### ' + label + ' (Note: ' + phaseAvg[label] + ')');
    lines.push('');
    lines.push(phases[file].text.trim());
    lines.push('');
  }
  lines.push('## Methode & Zurückverfolgbarkeit');
  lines.push('- 4 sequentielle Phasen: Drift Tracker (History) → Governance → Gamedesign → Tooling.');
  lines.push('- Phase 0 (Drift Tracker) läuft immer zuerst und deckt parallele Wahrheiten, doppelte Systeme, widersprüchliche Systeme, falsche Takt-Logiken und redundante Arbeitsschritte auf.');
  lines.push('- Jede Designentscheidung ist mit Code-Stelle (Datei:Zeile), Issue, Claim und/oder Commit belegt.');
  lines.push('- Jede Entscheidung hat eine Note (A–F) mit Befunde-Erklärung.');
  lines.push('- Dieser finale Report ist konsolidiert aus den 4 Phase-Berichten.');
  lines.push('- Die Phase-Berichte wurden nach der Konsolidierung gelöscht (keine Rest-Artefakte).');
  lines.push('- Ein späterer Lauf auf demselben Code-Stand muss dieselben Befunde liefern (Reproduzierbarkeit).');

  writeFileSync(FINAL_REPORT, lines.join('\n') + '\n', 'utf-8');

  let deleted = 0;
  for (const { file } of PHASE_FILES) {
    const path = join(REPORTS_DIR, file);
    if (existsSync(path)) { try { unlinkSync(path); deleted++; } catch {} }
  }

  console.log('=== Adversarial Code Review — Konsolidierung abgeschlossen ===');
  console.log('Gesamtnote: ' + overallGrade + ' (' + allDecisions.length + ' Entscheidungen)');
  console.log('Phasen:');
  for (const { file, label } of PHASE_FILES) {
    console.log('  ' + label + ': ' + phaseAvg[label] + ' (' + phases[file].grades.length + ' Entscheidungen)');
  }
  console.log('Kritisch (D–F): ' + critical.length);
  console.log('Mittel (C): ' + medium.length);
  console.log('Rest-Artefakte gelöscht: ' + deleted + ' von ' + PHASE_FILES.length);
  console.log('Finaler Report: ' + FINAL_REPORT);
}

main();