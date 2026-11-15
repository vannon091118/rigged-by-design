/**
 * @test-target: scripts/lib/doc-anchors.mjs
 * @error-code: ERR-4017
 *
 * #860: Interne Markdown-Anker muessen gegen die tatsaechlichen Heading-Slugs
 * aufloesen. Der Fehler, der das ausgeloest hat: `#mission-profil-maintainer`
 * zeigte ins Leere, weil die Ueberschrift `mission-profil-maintainer-global`
 * erzeugt.
 */
import { describe, expect, it } from 'vitest';
import {
  checkDocAnchors, collectAnchors, extractInternalLinks, parseLinkTarget, slugifyHeading,
} from '../../../../scripts/lib/doc-anchors.mjs';

describe('slugifyHeading', () => {
  it('bildet die Slugs, die GitHub fuer die echten Ueberschriften erzeugt', () => {
    expect(slugifyHeading('Mission-Profil `maintainer` (global)')).toBe('mission-profil-maintainer-global');
    expect(slugifyHeading('Board-Status & Review-Status (Pflicht)')).toBe('board-status--review-status-pflicht');
    expect(slugifyHeading('Zehn unverhandelbare Regeln')).toBe('zehn-unverhandelbare-regeln');
  });

  it('entfernt HTML und satzzeichen, behaelt Umlaute', () => {
    expect(slugifyHeading('Prioritäten <em>kanonisch</em>')).toBe('prioritäten-kanonisch');
    expect(slugifyHeading('  Rand  ')).toBe('rand');
  });
});

describe('collectAnchors', () => {
  it('nummeriert doppelte Ueberschriften wie GitHub', () => {
    const anchors = collectAnchors('# Foo\n\n## Foo\n\n### Foo\n');
    expect([...anchors]).toEqual(['foo', 'foo-1', 'foo-2']);
  });

  it('ignoriert Ueberschriften in Code-Fences', () => {
    const anchors = collectAnchors('# Echt\n\n```md\n# Beispiel\n```\n');
    expect([...anchors]).toEqual(['echt']);
  });
});

describe('extractInternalLinks', () => {
  it('liest Links mit Zeilennummer und laesst Code-Fences aus', () => {
    const markdown = '# Kopf\n\n[Anker](#kopf) und [Datei](OTHER.md#teil)\n\n```\n[ignoriert](#gibt-es-nicht)\n```\n';
    expect(extractInternalLinks(markdown)).toEqual([
      { target: '#kopf', line: 3 },
      { target: 'OTHER.md#teil', line: 3 },
    ]);
  });
});

describe('parseLinkTarget', () => {
  it('trennt interne von externen und nicht-Markdown-Zielen', () => {
    expect(parseLinkTarget('#kopf')).toEqual({ path: '', anchor: 'kopf' });
    expect(parseLinkTarget('docs/A.md#teil')).toEqual({ path: 'docs/A.md', anchor: 'teil' });
    expect(parseLinkTarget('A.md')).toEqual({ path: 'A.md', anchor: null });
    expect(parseLinkTarget('https://example.com/A.md#x')).toBeNull();
    expect(parseLinkTarget('screenshots/current/')).toBeNull();
  });
});

describe('checkDocAnchors', () => {
  const documents = [
    {
      path: 'AGENTS.md',
      text: 'Der Vertrag steht in [Governance](docs/GOVERNANCE.md#mission-profil-maintainer-global).\n',
    },
    {
      path: 'docs/GOVERNANCE.md',
      text: '### Mission-Profil `maintainer` (global)\n\nZurueck zur [Wurzel](../AGENTS.md).\n',
    },
  ];

  it('akzeptiert gueltige Anker ueber Dateigrenzen', () => {
    expect(checkDocAnchors(documents)).toEqual([]);
  });

  it('meldet einen toten Anker mit Datei und Zeile', () => {
    const broken = [
      { path: 'AGENTS.md', text: '\n\n[Mission](docs/GOVERNANCE.md#mission-profil-maintainer)\n' },
      documents[1],
    ];
    expect(checkDocAnchors(broken)).toEqual([
      'AGENTS.md:3 Anker fehlt in docs/GOVERNANCE.md: #mission-profil-maintainer',
    ]);
  });

  it('meldet ein fehlendes Linkziel', () => {
    const broken = [{ path: 'AGENTS.md', text: '[Weg](../packages/gamescout/AGENTS.md)\n' }];
    expect(checkDocAnchors(broken)).toEqual([
      'AGENTS.md:1 Linkziel fehlt: ../packages/gamescout/AGENTS.md',
    ]);
  });
});
