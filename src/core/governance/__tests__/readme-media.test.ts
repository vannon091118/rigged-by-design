/**
 * @test-target: scripts/lib/readme-media.mjs
 * @error-code: ERR-4017
 *
 * Die README ist die Praesentation des Projekts. Jedes Bild braucht einen
 * sprechenden Alt-Text und einen existierenden Pfad; ein Dateiname oder ein
 * leerer Text ist kein Alt-Text. Der Test deckt die echte README und drei
 * Fehlerfaelle ab, damit ein spaeterer Bildtausch nicht still die Beschreibung
 * verliert.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkReadmeMedia, readmeImages, verifyReadmeMedia } from '../../../../scripts/lib/readme-media.mjs';

const root = process.cwd();
const readme = readFileSync(resolve(root, 'README.md'), 'utf8');

describe('README-Bilder und Alt-Texte', () => {
  it('findet alle Bilder der echten README', () => {
    expect(readmeImages(readme).length).toBeGreaterThanOrEqual(10);
  });

  it('akzeptiert die echte README (Alt-Texte und Pfade)', () => {
    expect(verifyReadmeMedia(root)).toEqual([]);
  });

  it('erkennt einen leeren Alt-Text', () => {
    const problems = checkReadmeMedia('<img src="docs/banner.svg" alt="">', { exists: () => true });
    expect(problems.join('\n')).toContain('Alt-Text zu kurz');
  });

  it('erkennt einen Alt-Text, der nur der Dateiname ist', () => {
    const problems = checkReadmeMedia('![spielwelt](docs/banners/spielwelt.svg)', { exists: () => true });
    expect(problems.join('\n')).toContain('nur der Dateiname');
  });

  it('erkennt einen toten Bildpfad', () => {
    const problems = checkReadmeMedia('![Stadtansicht mit Gehwegen und Tabs](docs/fehlt.png)', { exists: () => false });
    expect(problems.join('\n')).toContain('Bild fehlt: docs/fehlt.png');
  });
});
