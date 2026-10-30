/** Ein Ort für Begriffe, die der Spieler sieht: kurze Erklärung statt Branchenjargon. */
export const HELP = {
  hauskonto: 'Das Geld des Casinos. Einsätze kommen hier an, Auszahlungen, Löhne und Einkäufe gehen hier ab.',
  portemonnaie: 'Dein privates Bargeld. Damit spielst du in fremden Casinos und hebst Gewinne vom Hauskonto ab.',
  kasse: 'Wechselkasse der Gäste: Bargeld wird zu Chips und wieder zurück. Kein Gewinn, nur Durchlauf.',
  offen: 'Gewinne, die Gäste erspielt haben, aber noch nicht abgeholt. Erst „Auszahlen“ macht daraus Chips.',
  ruf: 'Zulauf in Prozent. Steigt mit Sauberkeit und gutem Angebot, sinkt mit Dreck, Streit und kaputten Geräten.',
  bar: 'Getränkebestand. Eine leere Bar kostet Laune, und Gäste gehen früher.',
  teile: 'Ersatzteile. Jede Reparatur kostet genau 1 Teil, egal wie kaputt das Gerät ist.',
  kiste: 'Bestellte Ware kommt als Kiste am Eingang an. Abholen, tragen, auf freie Fläche stellen.',
  laune: 'Laune: unter 40 wird der Gast gereizt, unter 25 randaliert er. Zureden oder ein Drink hilft.',
  geduld: 'Geduld: läuft beim Warten ab. Bei 0 verlässt der Gast das Haus, ohne zu spielen.',
  sucht: 'Sucht: hoch heißt länger bleiben und mehr spielen – aber auch mehr Laune verlieren, wenn nichts kommt.',
  anziehung: 'Anziehung: wie attraktiv dein Angebot für neue Gäste ist. Höher heißt mehr Zulauf.',
  hausvorteil: 'Hausvorteil: der Anteil jedes Einsatzes, der im Schnitt beim Betreiber bleibt. Der Rest geht als Gewinn zurück.',
  tick: 'Ein Takt ist ein Spielschritt von etwa einer halben Sekunde.',
} as const;

/** Anziehung ist ein Rohwert; für Spieler zählt die Größenordnung. */
export function attractionBand(value: number): string {
  if (value >= 2500) return 'sehr hoch';
  if (value >= 1500) return 'hoch';
  if (value >= 700) return 'mittel';
  return 'niedrig';
}

/** Aus Basispunkten wird der Satz, den ein Spieler versteht: VC pro 100 VC Einsatz. */
export function houseEdgeText(edgeBps: number): string {
  const perHundred = edgeBps / 100;
  return `Von 100 VC Einsatz bleiben dem Haus im Schnitt ${perHundred.toFixed(2)} VC.`;
}
