# First-Run-Messung (T1)

**Stand:** 2026-11-11 · **Basis:** `main` @ `698788d4` + Sprint-1-Arbeitsbaum · **Ziel:** G1 messen, nicht behaupten.

## Befehle

```bash
pnpm install --frozen-lockfile
pnpm run build
pnpm run preview --port 4173 --strictPort
# Browser: http://localhost:4173/ (Vite bindet ::1, nicht 127.0.0.1)
```

Gemessen im lokalen Chromium über das DOM (HUD, Modals, Canvas), nicht über einen Screenshot.

## Drei Messpunkte

| Punkt | Modals | HUD | Canvas |
|---|---|---|---|
| Boot | **genau eins**: „ERÖFFNUNG · TAG 1 – Der erste Abend" | 150,00 VC Hauskonto · Kasse 0,00 · Gäste 0 · Geräte 0/0 | 1263 × 406 |
| nach „LOS" | **genau eins**: „ERSTE SCHRITTE – Die Stadt wartet." | unverändert · Szene `CITY` | 1263 × 406 |
| nach „CASINO BETRETEN" | **genau eins**: „ERSTE SCHRITTE – Der Raum ist dein." | Kasse 0,00 · **Gäste 1** · Geräte 0/0 | 828 × 717 |

**Erster Gast:** 734 ms nach dem Szenenwechsel `CITY → OWN`.

## Befund zu G1

**Widerlegt in der behaupteten Form.** Im Startzustand steht die Kasse bereits im Blueprint
(`new-game.ts` behält die `EXCHANGE`), und `FIRST_ARRIVAL_TICK = 12` bei `TICK_MS = 520` ergibt
6,2 s. Weil die Stadt-Ticks weiterlaufen, war der Ankunftstermin beim Betreten des Casinos schon
verstrichen: der erste Gast stand nach 0,7 s im Raum. „Kasse 0,00 VC" ist der **Kasseninhalt**,
nicht das Fehlen der Kasse.

**Offen ist die Kette danach.** Der Gast kommt, aber die HUD-Zeile zeigt `GERÄTE 0/0`: ohne den
Automat aus der Starter-Kiste hat er kein Ziel. Genau diese Lücke prüft der Kettentest
`src/store/__tests__/first-evening.test.ts` (Kiste aufstellen → Spiel → Buchung → Tagesende).

## Konsequenzen für den Sprint

- Kein „Starter-Kasse"-Feature: die Kasse existiert.
- Kein „erster Gast nach X Minuten"-Umbau: 12 Ticks sind eingehalten und getestet.
- Die zwei Modals beim Boot waren der echte Defekt (D1) und sind mit dem einen Startzustand behoben.
