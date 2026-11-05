# SUB-B-Review: Unabhängiges adversarial Review des korrigierten LEAD-Plans

**Status:** SUB-B-Bericht (unabhängig, adversarial)  
**Datum:** 2026-11-04T22:23 UTC  
**Geprüftes Dokument:** `docs/PLAN-LEAD-MERGE-KORRIGIERT.md` (korrigierter LEAD-Plan)  
**Prüfgegenstand:** Korrigierter Plan vs. Daten (Code, Reports 1-3, INVENTORY, ARCHITECTURE, AGENTS.md, SUB-A-Bericht)  
**Rolle:** Unabhängiges adversarial Review – keine Absprache mit SUB A, eigene Sicht

---

## 1. Zusammenfassung

Der korrigierte LEAD-Plan ist **konsistent, gut priorisiert und adressiert die kritischen Befunde**. Die SUB-A-Kritiken wurden angemessen aufgenommen (kein "transaktionaler" Overthinking, blockierende Nutzerentscheidungen markiert, explizite Tests, LOC-Budget).

Es gibt **keine neuen kausalen Konflikte** gegenüber SUB A. SUB B bestätigt SUB A in den Hauptpunkten, identifiziert aber **zwei zusätzliche Lücken** und **eine Abhängigkeit**, die vor der Implementierung geklärt werden sollten:

1. **Lücke G3 (Sucht steuert nichts):** Der Plan erwähnt G3 nur als "info" ohne Handlung. Die Sucht beeinflusst bereits `sessionSpins` und `addictedStake` – eine Entscheidung, ob Sucht weitere Folgen haben soll, fehlt.
2. **Lücke G9 (Playwright):** Der Plan behandelt G9 als "Architekturentscheidung, keine Änderung". Aber der Auftrag nennt explizit Playwright-Tests. Dies sollte als offene Frage zum Nutzer kommuniziert werden, nicht stillschweigend akzeptiert.
3. **Abhängigkeit Phase 1.3 → Phase 1.1/1.2:** Schulden-Tilgung (1.3) hängt von `payOut`/`payOrBorrow` ab, die auch von 1.1/1.2 berührt werden. Reihenfolge wichtig: 1.1/1.2 vor 1.3.

---

## 2. Unabhängige Prüfung: Plan vs. Daten

### 2.1 Phase 0 — Dokumentation

**BESTÄTIGT.** `INVENTORY.md` §14 listet Befunde 1, 33, 34, 37 als offen, die bereits gefixt sind. `docs:sync` + Pre-Commit-Hook sichern die Marker. Keine Einwände.

### 2.2 Phase 1.1 — `settleGuests` idempotent

**BESTÄTIGT mit Präzisierung.** Die Korrektur "pro-Gast-entfernen-nach-Erfolg" ist richtig. Ein Detail: `world.guests` wird während der Iteration verändert. Der Code muss vorsichtig sein:

```typescript
// Aktuell (vereinfacht):
for (const guest of world.guests) { ... buchen ... }
// world.guests = [] am Ende

// Korrigiert (nach SUB A):
for (const guest of [...world.guests]) { // Kopie iterieren
  ... buchen ...;
  world.guests = world.guests.filter(g => g.id !== guest.id); // nach Erfolg entfernen
}
```

**SUB-B-Anmerkung:** Die Iteration muss über eine Kopie (`[...world.guests]`) erfolgen, da `world.guests` im Loop verändert wird. Das ist bereits bei `tickWorld` so gelöst (`for (const guest of [...world.guests])`). Der Plan sollte dies explizit nennen.

### 2.3 Phase 1.2 — `payAndLeave` CASHOUT-Exit

**BESTÄTIGT.** "Auf LEAVE setzen" ist die richtige Wahl. Alternative "Gast entfernen" wäre Geldvernichtung (nicht gewollt).

**SUB-B-Anmerkung:** Beim Setzen auf `LEAVE` sollte auch `guest.path` zum Türpunkt gesetzt werden (`sendGuest(world, guest, doorPoint(world))`), sonst bleibt der Gast stehen. `leave()` tut das bereits (`sendGuest(world, guest, doorPoint(world))`). Gut.

### 2.4 Phase 1.3 — Schulden-Tilgung

**BESTÄTIGT als blockierend.** Ohne Nutzerentscheidung keine Implementierung. Die Reihenfolge ist wichtig: 1.1 und 1.2 sollten vor 1.3 kommen, da `payOut`/`payOrBorrow` von beiden berührt werden.

### 2.5 Phase 2.1 — Mods sequenziell

**BESTÄTIGT.** Ein Mod pro Entscheidung ist der richtige Ansatz. Jede Änderung ist eine Spielregel-Entscheidung.

### 2.6 Phase 2.2 — Einsatz mit Persona-Budget

**BESTÄTIGT als blockierend.** `budgetFactor` existiert in `personas.ts` wird aber in `offerScore` nicht gelesen. Skalierungsfaktor ist Nutzerentscheidung.

### 2.7 Phase 2.3 — `movement-queue.ts`

**BESTÄTIGT.** Entfernen oder integrieren. Einfache Entscheidung.

### 2.8 Phase 3 — UI

**BESTÄTIGT mit Ergänzung.** LOC-Budget ist wichtig (`check:loc`). Rivalen-Profilkarte braucht UI-Arbeit, die im Plan nicht mit konkreten Dateien verknüpft ist.

**SUB-B-Anmerkung:** Die Rivalen-Profilkarte sollte als eigene UI-Datei geplant werden (z. B. `src/ui/narrative-rival-profile.tsx`), damit LOC-Budget und Tree-Gate (`tests nur in __tests__`) geprüft werden können.

### 2.9 G3 — Sucht (zusätzliche Lücke)

**SUB-B-Entdeckung:** Der Plan listet G3 als "info" ohne Handlung. Aber `addiction` beeinflusst bereits `sessionSpins` (mehr Spins) und `addictedStake` (höherer Einsatz pro Spin). Die Frage ist: Sollen es auch **negative Folgen** geben (z. B. Spielverbot bei hoher Sucht, therapeutische Kosten)? Das ist eine Spielregel-Entscheidung, die im Plan fehlt.

### 2.10 G9 — Playwright (zusätzliche Lücke)

**SUB-B-Entdeckung:** Der Auftrag nennt explizit "playwrigh tests". Das Projekt nutzt Vitest/jsdom. Es gibt keine Playwright-Konfiguration. Der Plan akzeptiert das stillschweigend als "Architekturentscheidung". SUB B empfiehlt, dies als offene Frage zum Nutzer zu kommunizieren, da der Auftrag Playwright explizit nennt.

---

## 3. Overthinking-Erkennung (SUB-B-eigene Sicht)

| Stelle | Risiko | Einschätzung |
|--------|--------|--------------|
| Phase 1.1 | Iteration über verändertes Array | Mittel – muss über Kopie iterieren, wie in `tickWorld` |
| Phase 1.3 | Technische Implementierung ohne Entscheidung | Vermieden – korrekt als blockierend markiert |
| Phase 2.1 | Alle 3 Mods gleichzeitig | Vermieden – korrekt sequenziell |
| Phase 3.1 | Zu großes UI-Paket auf einmal | Mittel – sollte in Teilschritte (Basis-Karte → Historie) aufgeteilt werden |

---

## 4. Fehlende Exit-Kriterien (SUB-B-Ergänzung)

| # | Fehlend | Warum |
|---|---------|-------|
| 1 | Iteration über Kopie in `settleGuests` | Sonst verändert sich das Array während der Iteration |
| 2 | `leave()` setzt Pfad zur Tür | Sonst bleibt Gast im CASHOUT-Exit stehen |
| 3 | G3-Entscheidung (Sucht-Folgen) | Spiellücke, die nicht adressiert wird |
| 4 | G9-Kommunikation (Playwright) | Auftrag nennt Playwright explizit |
| 5 | UI-Datei für Rivalen-Profilkarte | LOC-Budget und Tree-Gate benötigen konkreten Dateinamen |

---

## 5. SUB-B-Fazit

**Der korrigierte LEAD-Plan ist kausal konsistent und adressiert alle kritischen Befunde.** SUB B bestätigt SUB A in den Hauptpunkten. Keine Widersprüche zwischen SUB-A und SUB-B-Sichten.

**Kleine Korrekturen vor FINAL:**
1. Phase 1.1: Explizit `[...world.guests]` Kopie für Iteration nennen
2. Phase 1.2: `leave()` setzt Pfad zur Tür (bereits im Code, aber im Plan nennen)
3. G3 als offene Entscheidung markieren (nicht nur "info")
4. G9 als offene Frage zum Nutzer kommunizieren
5. UI-Dateiname für Rivalen-Profilkarte nennen (LOC-Budget)

Nach diesen kleineren Korrekturen ist der Plan bereit für die finale SUB-A-Re-Prüfung.

---

*SUB-B-Bericht an LEAD übermittelt.*
