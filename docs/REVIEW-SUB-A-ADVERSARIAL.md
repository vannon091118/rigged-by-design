# SUB-A-Review: Adversarial Prüfung des LEAD-Plans

**Status:** SUB-A-Bericht (adversarial)  
**Datum:** 2026-11-04T22:23 UTC  
**Geprüftes Dokument:** `docs/PLAN-LEAD-MERGE.md` (LEAD-Entwurf)  
**Prüfgegenstand:** Plan vs. Daten (Code, Reports 1-3, INVENTORY, ARCHITECTURE, AGENTS.md)  
**Rolle:** Adversarial Review – kausale Konflikte, Overthinking vermeiden, Machbarkeit prüfen

---

## 1. Zusammenfassung

Der LEAD-Plan ist **strukturiert und korrekt priorisiert**. Kritische Befunde (L2 Doppelauszahlung, L1 CASHOUT-Hänger, S1 Schulden-Tilgung, G6 Dokumentations-Disparitäten) sind identifiziert. Es gibt **keine kausalen Widersprüche** zwischen Plan und Code.

Allerdings gibt **drei Overthinking-Risiken** und **zwei Unterdeckungspunkte**, die vor der Implementierung korrigiert werden sollten:

1. **Overthinking Phase 1.1:** `settleGuests` transaktionell zu machen ist komplexer als nötig; eine einfachere Pro-Gast-Abarbeitung reicht.
2. **Overthinking Phase 1.3:** Schulden-Tilgungspfad erfordert eine Spielregel-Entscheidung (Nutzer), keine technische Entscheidung allein.
3. **Undercovered Phase 2:** Die drei Mods (VELVET, FREE_DRINK, EXTRA_REEL) brauchen nicht nur Code, sondern eine **Spielregel-Entscheidung** des Nutzers – der Plan geht davon aus, dass diese Entscheidung vorliegt.
4. **Undercovered Phase 3.1:** Rivalen-Profilkarte braucht UI-Arbeit, die im Plan nicht mit LOC-Budget veranschlagt ist.
5. **Fehlend:** Kein Test für L1 (CASHOUT-Hänger) und L2 (Doppelauszahlung) ist im Plan explizit als Exit-Kriterium benannt (nur implizit).

---

## 2. Detailprüfung: Plan vs. Daten

### 2.1 Phase 0 — Dokumentation synchronisieren

**Plan:** `INVENTORY.md` §14 auf aktuellen Code-Stand bringen; 6 Pflichtdokumente mit `rbd-doc`-Marker synchronisieren.

**Daten-Check:**
- `INVENTORY.md` §14 listet Befunde 1, 33, 34, 37 als offen → Code zeigt: alle vier bereits gefixt (spinTest einmaliger Aufruf, `barCapacityForLevel` in allen 3 UI-Dateien, korrektes `·` in `table-launcher.tsx:56`, Poker-`streetCommitted` bereits im Code)
- `docs:sync` schreibt Marker automatisch; Pre-Commit-Hook prüft Doku + LOC

**Bewertung: Korrekt.** Kein Overthinking. Dokumentations-Disparitäten sind real und müssen behoben werden.

### 2.2 Phase 1.1 — `settleGuests` transaktionell (`actions.ts:22-30`)

**Plan:** Vor der Schleife alle Buchungen prüfen (Trockenlauf), dann ausführen; oder nach jeder erfolgreichen Buchung Gast aus Array entfernen.

**Daten-Check:**
```typescript
export function settleGuests(world, ledger): void {
  for (const guest of world.guests) {
    payPending(...); exchangeFromVc(...); closeFiat(...);
  }
  world.guests = [];
}
```

**Kritik:** Wenn Gast 3 wirft, sind Gäste 1-2 bereits gebucht (Geld bewegt), aber `world.guests` enthält noch alle. Beim nächsten Versuch werden Gäste 1-2 erneut ausgezahlt → Doppelauszahlung. Das ist der **kritischste Befund (L2, hoch)**.

**Overthinking-Risiko:** Ein vollständiger Trockenlauf aller Buchungen vor der Ausführung ist komplex (Ledger-Zustand müsste gesnapshottet werden). Einfacher und sicherer: nach jeder erfolgreichen Buchung den Gast aus `world.guests` entfernen (oder eine separate Liste "bereits abgewickelte Gäste" führen). Bei Abbruch sind nur die bereits entfernten Gäste weg; die übrigen bleiben für einen erneuten Versuch.

**Empfehlung SUB A:** Statt "transaktionell" (schwer umzusetzen, Overthinking) → "pro-Gast-entfernen-nach-Erfolg" (einfach, idempotent, sicher).

### 2.3 Phase 1.2 — `payAndLeave` Fehlerpfad (`guest-service.ts:49-72`)

**Plan:** Im `catch` nicht ewig in `CASHOUT` lassen, sondern auf `LEAVE` setzen oder nach N Versuchen aufgeben.

**Daten-Check:**
```typescript
export function payAndLeave(world, ledger, guest): void {
  try {
    payPending(...); exchangeFromVc(...); closeFiat(...);
    noteSatisfaction(...);
    leave(world, guest);
  } catch {
    guest.state = 'CASHOUT'; guest.stateTicks = 0; // kein leave()!
    return; // bleibt im Tick als CASHOUT
  }
}
```

**Tick-Handler (`tick.ts:85-100`):** CASHOUT-Gast geht zum Exchange-Punkt, wartet auf Cashier, ruft `payAndLeave` erneut. Wenn es erneut wirft, bleibt er in CASHOUT.

**Kritik:** Die Einzelbuchungen werfen nur bei echter Unterdeckung. In der Praxis ist der `catch`-Pfad tot. Aber die Logik-Lücke ist real: kein Ausweg aus CASHOUT außer erfolgreicher Zahlung.

**Bewertung SUB A:** Korrekt identifiziert. Die Fix-Option "auf LEAVE setzen" ist pragmatisch. Alternative: im catch den Gast entfernen (verlassen ohne Auszahlung) – aber das wäre Geldvernichtung, nicht gewollt. "Auf LEAVE setzen" ist die richtige Wahl.

### 2.4 Phase 1.3 — Schulden-Tilgungspfad (`money.ts` `payOut`, `payOrBorrow`)

**Plan:** Roadmap-Entscheidung: wann und wie werden `HAUS_SCHULDEN` getilgt?

**Daten-Check:** `payOut()` bucht nicht gedeckte Gewinne auf `DEBT_ACCOUNT` (`HAUS_SCHULDEN`). `payOrBorrow()` gleich für laufende Kosten. Es gibt keine Funktion, die Schulden reduziert.

**Kritik SUB A:** Dies ist **keine rein technische Entscheidung**. Der Nutzer muss entscheiden:
- Tilgen Gäste ihre Schulden bei Rückkehr?
- Tilgt das Haus automatisch bei Gewinn?
- Gibt es eine Zins- oder Mahnstufe?

Der Plan geht korrekterweise davon aus, dass dies eine Nutzerentscheidung braucht. Aber der Plan sollte dies als **blockierende Entscheidung** markieren, nicht als "im nächsten Slice umsetzen".

**Overthinking-Risiko:** Kein. Aber: ohne Nutzerentscheidung kann Phase 1.3 nicht implementiert werden.

### 2.5 Phase 2.1 — Mods mit Mechanik (`offers.ts` MODS)

**Plan:** Jeder Mod bekommt entweder dokumentierte Spielwirkung oder ehrlichen Text.

**Daten-Check:**
- `VELVET`: +220 Anziehung, −2 Geduld, kostet 14 VC, Betrieb 0.02 VC
- `FREE_DRINK`: +140 Anziehung, +8 Geduld, kostet 10 VC, Betrieb 0.03 VC
- `EXTRA_REEL`: +300 Anziehung, kostet 18 VC, nur für Slots

**Kritik SUB A:** Der Plan unterschätzt den Aufwand. Jede Mod-Änderung ist eine **Spielregel-Entscheidung**, die der Nutzer treffen muss. Die Implementierung selbst ist einfach (einige Zeilen in `offers.ts` oder `guest-*.ts`), aber die Entscheidung blockiert.

**Empfehlung SUB A:** Phase 2.1 als "wartet auf Nutzerentscheidung" markieren, nicht als implementierbarer Slice.

### 2.6 Phase 2.2 — Einsatz mit Persona-Budget skalieren (`offers.ts` `offerScore`)

**Plan:** High Roller (budgetFactor > 1) setzt höher als Mindesteinsatz.

**Daten-Check:** `offerScore()` verwendet `Math.max(world.prices.slotMinBet, item.baseBet)` als Einsatz. Persona `budgetFactor` existiert (`personas.ts`: LUMPEN 0.45, STREET 1, BUSINESS 2.2, HIGH_ROLLER 5, STAMMGAST 0.85) aber wird in `offerScore` nicht gelesen.

**Bewertung SUB A:** Korrekt identifiziert. Die Änderung ist technisch einfach (`budgetFactor` in `offerScore` einbeziehen), aber die Balancierung (wie viel höher?) ist eine Spielregel-Entscheidung.

### 2.7 Phase 2.3 — `movement-queue.ts`

**Plan:** Entfernen oder integrieren.

**Daten-Check:** `movement-queue.ts` hat außerhalb seines eigenen Tests keinen Importeur. `queue-spots.ts` wird für die Kassenschlange genutzt.

**Bewertung SUB A:** Korrekt. Einfache Entscheidung: entfernen (tot) oder dokumentiert ins Produkt holen.

### 2.8 Phase 3 — UI und UX-Lücken

**3.1 Rivalen-Profilkarte:** Modell existiert (`narrative/rival-context.ts`), UI fehlt. Plan nennt das korrekt, veranschlagt aber kein LOC-Budget für UI-Arbeit.

**3.2 Exchange-Desk ohne Gäste:** `spawnGuest` gibt `null` wenn kein Exchange-Möbel existiert. Plan klärt dies als Entscheidung.

**3.3 Unreachable Dreck:** `cleanerTick` löscht unreachable Dreck still. Plan will stattdessen "als blockiert melden".

**Bewertung SUB A:** Alle korrekt identifiziert. UI-Arbeit braucht LOC-Budget (Budget-Check via `check:loc`).

---

## 3. Overthinking-Erkennung

| Stelle im Plan | Overthinking-Risiko | Einfachere Alternative |
|---------------|---------------------|------------------------|
| Phase 1.1 "transaktionell" | Voller Trockenlauf aller Buchungen vor Ausführung | Pro-Gast-entfernen-nach-Erfolg (idempotent) |
| Phase 1.3 "Tilgungspfad implementieren" | Technische Implementierung ohne Nutzerentscheidung | Erst Nutzerentscheidung einholen, dann implementieren |
| Phase 2.1 "alle 3 Mods mit Mechanik" | Gleichzeitig alle drei Mods ändern | Ein Mod pro Entscheidung, sequenziell |
| Phase 3.1 "Rivalen-Profilkarte" | Volles Profil mit Historie und Indizien | Erst Basiskarte (Haltung, Indizien), dann Historie |

---

## 4. Unterdeckungspunkte (fehlend im Plan)

| # | Fehlend | Warum kritisch |
|---|---------|---------------|
| 1 | Expliziter Test für L1 (CASHOUT-Hänger) | Ohne Test nicht nachweisbar, dass der Fix funktioniert |
| 2 | Expliziter Test für L2 (Doppelauszahlung) | Ohne Test nicht nachweisbar, dass die Doppelauszahlung weg ist |
| 3 | LOC-Budget für Phase 3 UI-Arbeit | `check:loc` kann rot werden bei neuen UI-Dateien |
| 4 | Nutzerentscheidung für Mods (G1) und Schulden (S1) | Ohne Entscheidung kann nicht implementiert werden |

---

## 5. SUB-A-Fazit

**Der LEAD-Plan ist kausal korrekt und adressiert die richtigen Befunde.** Keine Widersprüche zwischen Plan und Code.

**Korrekturen vor Weitergabe an SUB B:**
1. Phase 1.1: "transaktionell" → "pro-Gast-entfernen-nach-Erfolg" (einfacher, sicherer)
2. Phase 1.3: Als blockierende Nutzerentscheidung markieren, nicht als implementierbarer Slice
3. Phase 2.1: Als wartend auf Nutzerentscheidung markieren
4. Explizite Test-Exit-Kriterien für L1 und L2 hinzufügen
5. LOC-Budget für Phase 3 UI-Arbeit veranschlagen

Nach diesen Korrekturen ist der Plan bereit für SUB B.

---

*SUB-A-Bericht an LEAD übermittelt.*
