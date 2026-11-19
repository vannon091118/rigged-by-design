/**
 * Guard fuer Screenshot-Saat: schuetzt die unter .shot-data/ abgelegten
 * Weltzustands-Dateien vor verseuchtem Überschreiben oder Löschen.
 * Die Dateien sind lokale Test-Werkzeuge (nur bei RBD_SHOT=1 aktiv),
 * aber sobald sie existieren, sind sie Referenzzustande für Abnahmen.
 */
import * as fs from "node:fs";
import * as path from "node:path";

const SHOT_DIR = path.join(process.cwd(), ".shot-data");

/** Liste aller existierenden Screenshot-Dateien (ohne Verzeichnis). */
export function shotFiles(): string[] {
  try {
    return fs.readdirSync(SHOT_DIR).filter((name) => name.endsWith(".json"));
  } catch {
    return [];
  }
}

/** Prüft, ob eine Screenshot-Datei bereits existiert. */
export function shotExists(name: string): boolean {
  return shotFiles().includes(name);
}

/**
 * Schreibt eine Screenshot-Datei nur, wenn sie noch nicht existiert.
 * Ein bestehender Referenz-Zustand wird nicht stillschweigend ersetzt.
 * Gibt true zurück, wenn geschrieben wurde; false bei Überschreib-Schutz.
 */
export function writeShot(name: string, payload: unknown): boolean {
  if (shotExists(name)) {
    return false;
  }
  try {
    fs.mkdirSync(SHOT_DIR, { recursive: true });
    fs.writeFileSync(path.join(SHOT_DIR, name), JSON.stringify(payload, null, 2));
    return true;
  } catch {
    return false;
  }
}

/** Löscht eine Screenshot-Datei nur mit explizitem Bestätigungs-Flag. */
export function deleteShot(name: string, confirm: boolean): boolean {
  if (!confirm) return false;
  try {
    fs.unlinkSync(path.join(SHOT_DIR, name));
    return true;
  } catch {
    return false;
  }
}
