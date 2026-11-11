/**
 * Kompakte Werkzeugausgabe: eine Bildschirmseite statt eines Logs.
 *
 * Der Agent soll aus einer Ausgabe den Befund, die Ursache, den Fix und den
 * Repro-Befehl lesen koennen - ohne Exit-Code-Raten und ohne Logsuche. Alles,
 * was nur beim Debuggen gebraucht wird, haengt an `RBD_VERBOSE=1`.
 *
 * Format ist bewusst stabil:
 *   <STATUS> · <Kopfzeile>
 *   <Feld>   <Wert>        (Feldbreite 9, ein Feld je Zeile)
 *   <Befund>              (immer sichtbar, ungekuerzt)
 *
 * Es gibt keine zweite Formatierung: `check:loc`, `agent:cause`, `pretask`,
 * `agent:context` und `verify-lane-claims` schreiben denselben Vertrag.
 */

/** Details nur auf ausdrueckliche Anforderung; Standard ist die Kurzfassung. */
export function isVerbose() {
  return process.env.RBD_VERBOSE === '1';
}

/** Ein Wert wird nie ueber die Zeilenbreite hinaus aufgeblasen. */
export function clip(value, max = 160) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const LABEL = 9;

/** Ein Feld je Zeile; leere Werte und leere Listen verschwinden. */
export function field(label, value) {
  const text = Array.isArray(value) ? value.filter(Boolean).join('; ') : value;
  if (text === undefined || text === null || String(text).trim() === '') return null;
  // Ein Trenner, damit ein neunzeichenlanges Label nicht am Wert klebt.
  return `${String(label).padEnd(LABEL)} ${clip(text)}`;
}

/**
 * Der Vertrag: Status, Kopfzeile, Fakten, Befunde, naechster Schritt.
 *
 * `facts` sind Felder, die immer erscheinen, `findings` sind Befunde, die
 * immer und ungekuerzt erscheinen; `details` nur im Verbose-Modus. Der
 * Rueckgabewert ist ein String, damit jeder Aufrufer ihn in einem
 * `console.log` ausgeben kann - keine verstreuten Einzelzeilen.
 */
export function compact({
  status = 'INFO',
  headline = '',
  facts = [],
  findings = [],
  details = [],
  maxDetails = 12,
}) {
  const lines = [`${String(status).toUpperCase()}${headline ? ` · ${clip(headline, 200)}` : ''}`];
  for (const entry of facts) {
    const line = Array.isArray(entry) ? field(entry[0], entry[1]) : entry;
    if (line) lines.push(line);
  }
  // Ein Befund ist der Grund fuer den Lauf: keine Kuerzung, kein Verbose-Zwang.
  for (const entry of findings) {
    if (entry === undefined || entry === null || String(entry).trim() === '') continue;
    lines.push(String(entry));
  }
  if (isVerbose()) {
    for (const entry of details.slice(0, maxDetails)) {
      const line = Array.isArray(entry) ? field(entry[0], entry[1]) : entry;
      if (line) lines.push(line);
    }
    const hidden = details.length - maxDetails;
    if (hidden > 0) lines.push(`${'Details'.padEnd(LABEL)}+${hidden} weitere (RBD_VERBOSE=1 zeigt sie)`);
  }
  return lines.join('\n');
}

/** Tabelle nur fuer echte Listen; eine Zeile je Eintrag, sonst nichts. */
export function table(header, rows) {
  if (!rows || rows.length === 0) return '';
  const width = Math.max(header[0].length, ...rows.map((row) => String(row[0]).length));
  const line = (cells) => cells.map((cell, index) => (index === 0 ? String(cell).padEnd(width) : String(cell))).join('  ');
  return [line(header), ...rows.map(line)].join('\n');
}
