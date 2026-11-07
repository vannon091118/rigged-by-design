/**
 * @test-target: scripts/lib/body-sync.mjs
 * @error-code: ERR-4006
 *
 * Body-Synchronisation darf vorhandene Inhalte nie ersetzen. Genau diese
 * Grenzen stehen hier: Erhalt, fehlende Sektion, mehrere Commits, Doku gegen
 * Runtime, Idempotenz, eigener Bereich, Abbruch und keine erfundenen Aussagen.
 */
import { describe, expect, it } from 'vitest';
import {
  AUTO_END,
  AUTO_START,
  REQUIRED_SECTIONS,
  describeAutomation,
  mergeAutomation,
  parseNameStatus,
  splitAutomation,
} from '../../../../scripts/lib/body-sync.mjs';

const HUMAN_BODY = [
  '# Handgepflegter PR-Body',
  '',
  'Diese Beschreibung nennt Details, die kein Generator kennt: die Ledger-Buchung',
  'bleibt unveraendert, und die UI zeigt weiterhin den alten Kontostand.',
  '',
  REQUIRED_SECTIONS[0],
  '- Ledger: keine Aenderung am Geldpfad.',
  '',
  REQUIRED_SECTIONS[1],
  '- Die Aenderung betrifft nur die Anzeige.',
  '',
  REQUIRED_SECTIONS[2],
  '- Naechster Schritt: ein Test fuer den Kontostand.',
].join('\n');

const entry = (status: string, path: string) => ({ status, from: null, path });

describe('body-sync', () => {
  it('erhaelt einen ausfuehrlichen PR-Body vollstaendig', () => {
    const payload = describeAutomation({ entries: [entry('M', 'src/ui/hud.tsx')], outside: HUMAN_BODY });
    const merged = mergeAutomation(HUMAN_BODY, payload);
    expect(merged.body).toContain(HUMAN_BODY);
  });

  it('ergaenzt einen fehlenden Pflichtabschnitt ohne Verlust der anderen', () => {
    const original = HUMAN_BODY.slice(0, HUMAN_BODY.indexOf(REQUIRED_SECTIONS[2])).trimEnd();
    const merged = mergeAutomation(original, describeAutomation({ entries: [], outside: original }));
    expect({ kept: merged.body.includes(original), added: merged.body.includes(REQUIRED_SECTIONS[2]) })
      .toEqual({ kept: true, added: true });
  });

  it('wertet mehrere Commits gemeinsam aus', () => {
    const entries = parseNameStatus('M\tsrc/core/ledger.ts\nA\tsrc/core/ledger-view.ts');
    const payload = describeAutomation({ entries, commitText: 'Erster Commit\n\nZweiter Commit' });
    expect([payload.includes('2 Datei(en)'), payload.includes('ledger.ts'), payload.includes('ledger-view.ts')])
      .toEqual([true, true, true]);
  });

  it('laesst Doku die Runtime- und Testaenderung nicht verdecken', () => {
    const entries = parseNameStatus('M\tdocs/CHANGELOG.md\nM\tsrc/core/ledger.ts\nA\tsrc/core/__tests__/ledger.test.ts');
    const payload = describeAutomation({ entries });
    expect({
      runtimeFirst: payload.indexOf('Runtime:') < payload.indexOf('Doku:'),
      tests: payload.includes('Tests: src/core/__tests__/ledger.test.ts'),
    }).toEqual({ runtimeFirst: true, tests: true });
  });

  it('erzeugt bei wiederholten Updates keine Duplikate', () => {
    const payload = describeAutomation({ entries: [entry('M', 'src/core/ledger.ts')], outside: HUMAN_BODY });
    const first = mergeAutomation(HUMAN_BODY, payload);
    const second = mergeAutomation(first.body, payload);
    expect({
      changed: second.changed,
      starts: second.body.split(AUTO_START).length - 1,
      ends: second.body.split(AUTO_END).length - 1,
    }).toEqual({ changed: false, starts: 1, ends: 1 });
  });

  it('ersetzt ausschliesslich den eigenen Automationsbereich', () => {
    const before = 'Vorher von Hand geschrieben.\n\n';
    const after = '\n\nNachher von Hand geschrieben.';
    const merged = mergeAutomation(`${before}${AUTO_START}\nALTE ZUSAMMENFASSUNG\n${AUTO_END}${after}`, 'NEU');
    expect({
      before: merged.body.startsWith(before),
      after: merged.body.endsWith(after),
      dropped: !merged.body.includes('ALTE ZUSAMMENFASSUNG'),
      fresh: merged.body.includes('NEU'),
    }).toEqual({ before: true, after: true, dropped: true, fresh: true });
  });

  it('bricht bei unsicherer Markerlage ohne Schreiboperation ab', () => {
    const doubled = `${AUTO_START}\na\n${AUTO_END}\n${AUTO_START}\nb\n${AUTO_END}`;
    expect({
      duplicate: mergeAutomation(doubled, 'neu').ok,
      unbalanced: mergeAutomation(`Text\n${AUTO_START}\nunfertig`, 'neu').ok,
      state: splitAutomation(doubled).state,
    }).toEqual({ duplicate: false, unbalanced: false, state: 'invalid' });
  });

  it('erfindet ohne Commit-Notes keine technischen Aussagen', () => {
    const payload = describeAutomation({ entries: [entry('M', 'src/core/ledger.ts')], outside: '' });
    expect({
      honest: payload.includes('Keine Commit-Notes'),
      invented: /verbessert|optimiert|behoben|refaktoriert/i.test(payload),
    }).toEqual({ honest: true, invented: false });
  });
});
