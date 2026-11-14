/**
 * README-Medien: Alt-Texte und Bildpfade.
 *
 * Die README ist die einzige Praesentation im Repo. Ein Bild ohne sprechenden
 * Alt-Text oder mit totem Pfad ist ein Accessibility- und Doku-Fehler, kein
 * Schoenheitsproblem; der Check sitzt deshalb im Doc-Gate.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './report.mjs';

/** Alle Bilder der README: `<img src alt>` und `![alt](src)`. */
export function readmeImages(readmeText) {
  const images = [];
  for (const match of String(readmeText).matchAll(/<img\s+[^>]*?src="([^"]+)"[^>]*?alt="([^"]*)"/g)) {
    images.push({ src: match[1], alt: match[2] });
  }
  for (const match of String(readmeText).matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)) {
    images.push({ src: match[2], alt: match[1] });
  }
  return images;
}

/**
 * Jedes Bild braucht einen beschreibenden Alt-Text und muss existieren. Ein
 * Dateiname oder ein leerer Text ist kein Alt-Text; ein fehlendes Bild ist ein
 * toter Verweis.
 */
export function checkReadmeMedia(readmeText, { exists = () => true } = {}) {
  const problems = [];
  const images = readmeImages(readmeText);
  if (images.length === 0) problems.push('README.md: keine Bilder gefunden');
  for (const { src, alt } of images) {
    const path = String(src).replace(/^\.\//, '');
    if (!/^https?:/i.test(src) && !exists(path)) problems.push(`README.md: Bild fehlt: ${path}`);
    const text = String(alt).trim();
    const stem = path.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '') ?? '';
    if (text.length < 12) problems.push(`README.md: Alt-Text zu kurz fuer ${path}: "${text}"`);
    if (text.toLowerCase() === stem.toLowerCase()) problems.push(`README.md: Alt-Text ist nur der Dateiname fuer ${path}`);
  }
  return problems;
}

/** Liest die README und prueft ihre Bilder gegen den Baum. */
export function verifyReadmeMedia(root = ROOT) {
  return checkReadmeMedia(readFileSync(join(root, 'README.md'), 'utf8'), {
    exists: (path) => existsSync(join(root, path)),
  });
}
