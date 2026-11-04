# SUB-A-Re-Prüfung: Korrigierter LEAD-Plan NOCHMAL gegen die Daten

**Status:** SUB-A-Re-Bericht (letzte Prüfung vor Freigabe)  
**Datum:** 2026-11-04T22:23 UTC  
**Geprüft:** `docs/PLAN-LEAD-MERGE-KORRIGIERT.md` + `docs/REVIEW-SUB-B-ADVERSARIAL.md`  
**Rolle:** SUB A prüft den korrigierten Plan NOCHMALL kausal gegen die Daten (Nach SUB-B-Bericht)

---

## 1. Zusammenfassung

Der korrigierte LEAD-Plan nimmt alle SUB-A- und SUB-B-Kritiken auf. Nach dieser Re-Prüfung gibt SUB A **Freigabe**. Es bleiben keine offenen kausalen Konflikte.

Die fünf SUB-B-Ergänzungen sind entweder bereits abgedeckt oder als offene Entscheidungen markiert:

| SUB-B-Punkt | Status im korrigierten Plan | SUB-A-Bewertung |
|-------------|---------------------------|-----------------|
| Iteration über Kopie `[...world.guests]` | Nicht explizit im Plan, aber im Code-Standard (`tickWorld` macht es so) | Akzeptiert – Code-Konvention ist bekannt |
| `leave()` setzt Pfad zur Tür | Bereits im Code (`leave()` ruft `sendGuest(..., doorPoint(world))`) | Akzeptiert – keine Plan-Änderung nötig |
| G3 (Sucht steuert nichts) | Als "info" ohne Handlung im Plan | **Offen als Nutzerentscheidung** (wie G1, G2, S1) |
| G9 (Playwright) | Als "Architekturentscheidung" akzeptiert | **Offen als Frage zum Nutzer** (Auftrag nennt Playwright explizit) |
| UI-Datei für Rivalen-Profilkarte | Nicht konkret benannt | **Nachzuholen** vor Implementierung (LOC-Budget braucht Dateinamen) |

---

## 2. Re-Prüfung: Plan vs. SUB-B-Befunden

### 2.1 Phase 1.1 — `settleGuests` Iteration

SUB B merkt an: `world.guests` verändert sich während der Iteration, daher muss über eine Kopie iteriert werden. Der Plan sagt "nach jeder erfolgreichen Buchung den Gast aus `world.guests` entfernen" – das impliziert eine Kopie, nennt sie aber nicht.

**SUB-A-Bewertung:** Die Code-Konvention im Projekt (`tickWorld:113`: `for (const guest of [...world.guests])`) macht dies zum bekannten Muster. Keine Plan-Änderung nötig, aber Implementierung muss `[...world.guests]` verwenden.

### 2.2 Phase 1.2 — `payAndLeave` + `leave()`

SUB B merkt an: `leave()` setzt den Pfad zur Tür (`sendGuest(world, guest, doorPoint(world))`). Das ist bereits im Code korrekt.

**SUB-A-Bewertung:** Bestätigt. Keine Änderung nötig.

### 2.3 G3 — Sucht steuert nichts

Der Plan listet G3 als "info". SUB B empfiehlt, es als offene Entscheidung zu markieren.

**SUB-A-Bewertung:** Zustimmung. G3 wird wie G1, G2, S1 behandelt: als offene Nutzerentscheidung dokumentiert, nicht als implementierbarer Slice ohne Entscheidung.

### 2.4 G9 — Playwright

Der Auftrag nennt "playwrigh tests" explizit. Das Projekt nutzt Vitest/jsdom. SUB B empfiehlt, dies als offene Frage zum Nutzer zu kommunizieren.

**SUB-A-Bewertung:** Zustimmung. G9 sollte als offene Frage kommuniziert werden, nicht stillschweigend akzeptiert.

### 2.5 UI-Datei für Rivalen-Profilkarte

SUB B empfiehlt einen konkreten Dateinamen für LOC-Budget und Tree-Gate.

**SUB-A-Bewertung:** Zustimmung. Vor Phase 3.1 sollte ein Dateiname (z. B. `src/ui/narrative-rival-profile.tsx`) festgelegt werden.

---

## 3. Offene Entscheidungen (Nutzer)

Nach dieser Re-Prüfung bleiben folgende Entscheidungen dem Nutzer vorenthalten (der Plan kann sie nicht selbst treffen):

| # | Entscheidung | Kontext |
|---|-------------|---------|
| D1 | Schulden-Tilgungspfad (S1) | Wann und wie werden `HAUS_SCHULDEN` getilgt? |
| D2 | VELVET-Mod (G1) | Gastgüte beeinflussen oder Text ehrlichstellen? |
| D3 | FREE_DRINK-Mod (G1) | Echten Drink pro Spin buchen oder Text ehrlichstellen? |
| D4 | EXTRA_REEL-Mod (G1) | Echte vierte Walze oder Text ehrlichstellen? |
| D5 | Einsatz-Skalierung mit Persona-Budget (G2) | Skalierungsfaktor für High Roller? |
| D6 | Sucht-Folgen (G3) | Sollen hohe Suchtwerte negative Folgen haben? |
| D7 | Playwright-Tests (G9) | Sollen E2E-Browser-Tests ergänzt werden (gegen Vitest/jsdom)? |

---

## 4. SUB-A-Freigabe

**SUB A gibt den korrigierten LEAD-Plan frei.**

Bedingungen:
1. Die sieben Nutzerentscheidungen (D1–D7) werden vor der Implementierung der jeweiligen Phase eingeholt.
2. Phase 1.1 verwendet `[...world.guests]` für die Iteration (Code-Konvention).
3. Vor Phase 3.1 wird ein konkreter UI-Dateiname für die Rivalen-Profilkarte festgelegt.
4. `verify:quick` muss vor jedem Commit grün sein.

---

*SUB-A-Re-Bericht an LEAD übermittelt. Alle 3 Rollen (LEAD, SUB A, SUB B) haben den korrigierten Plan geprüft. Freigabe für den Implementierungs-Loop.*
