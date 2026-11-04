# Analyse-Report 2: Security Suite — Geld, RNG, Save-Integrität

**Status:** Erstentwurf (LEAD)  
**Datum:** 2026-11-04T22:23 UTC  
**Basis:** `src/core/economy/`, `src/core/rng/`, `src/core/sim/money.ts`, `src/store/save.ts`, `src/store/migrate.ts`, `src/core/io/`, `src/core/governance/`  
**Ziel:** Geld existiert nur als Ledger-Buchung; kein `addVC` außerhalb der Buchungslogik; RNG getrennt in Gameplay/Presentation; Save v10 mit Migration; alles fail-closed.

---

## 1. Zusammenfassung

Das Geldsystem ist durchgängig sicher: Jeder Cent ist eine Ledger-Buchung gegen `EXTERNAL_WORLD` (Minting) oder zwischen realen Konten. Der Ledger ist fail-closed (InsufficientFundsError, Bilanz-Null, Checkpoint-Replay). RNG ist in zwei Namespaces getrennt (gameplay/presentation) mit ESLint-Sperre für Umwege. Save v10 migriert v5–v9, verwirft v3/v4, replays das Ledger beim Laden und prüft die Integrität.

Befunde: **keine kritischen Sicherheitslücken** im Geldweg. Einige Beobachtungen zu Schulden (kein Tilgungspfad), Save-Archive-Duplikat und prüfungspflichtige Randfälle.

---

## 2. Geldweg — VaCoins als Ledger-Wahrheit

### 2.1 Kontenstruktur (`src/core/sim/money.ts`)

| Konto | Bedeutung | Deckungspflicht |
|-------|-----------|-----------------|
| `HAUSKONTO` | Hauskasse | Ja (außer Minting/Liability) |
| `PORTEMONNAIE` | Bargeld | Ja |
| `WECHSELKASSE` | Wechselkasse (Fiat↔Chips) | Ja |
| `SHOP` | Einkäufe/Reparaturen | Ja |
| `STAFF` | Löhne | Ja |
| `UTILITIES` | Nebenkosten | Ja |
| `VISITOR_<id>` | Gast-Chips | Ja |
| `PENDING_<id>` | Offene Gewinne | Ja |
| `FIAT_<id>` | Gast-Bargeld (ungetauscht) | Ja |
| `EXTERNAL_WORLD` / `EXTERNAL` | Aussenwelt (Minting) | **Nein** — einzige Geldquelle |
| `HAUS_SCHULDEN` (`DEBT_ACCOUNT`) | Verbindlichkeiten | **Nein** — darf negativ sein (Liability) |

**Regel:** Kein `addVC` außerhalb einer Buchung. Alle Transaktionen laufen über `ledger.transfer()`, das Unterdeckung für Nicht-Minting/Nicht-Liability-Konten ablehnt.

### 2.2 Geldquellen

- `openHouse()`: `EXTERNAL → HAUSKONTO` (150 VC Startkapital, einmalig bei Neuem Spiel)
- `admitFiat()`: `EXTERNAL → FIAT_<id>` (Gast bringt Fiat beim Spawn)
- `foreignWin()`: `EXTERNAL → PORTEMONNAIE` (Gewinn im fremden Haus)
- `payOut()`: bei Unterdeckung des Hauskontos → `DEBT_ACCOUNT → PENDING_<id>` (Schuld statt Kappung)
- `payOrBorrow()`: gleiche Logik für laufende Kosten

### 2.3 Ledger-Integrität (`src/core/economy/ledger.ts`)

- `transfer()`: Validiert Konto-Namen, Betrag > 0, Tick ≥ 0, Deckung (außer Minting/Liability)
- `verifyIncremental()`: Tickpfad, prüft nur neue Einträge + berührte Konten gegen Checkpoint
- `verifyLedgerIntegrity()`: Voller Replay aller Einträge, `verifyBalanceSheet()` verlangt Summe = 0
- `diagnose()`: Voller Replay auf Anforderung (Diagnose-Popup), nicht im Tickpfad

**Bewertung: Grün.** Jeder Geldweg ist eine verifizierbare Buchung. `ledgerOk` wird im Snapshot jeder Tick-Ausgabe neu geprüft (`snapshot.ts:126`).

### 2.4 Open Liabilities — Schulden ohne Tilgung (`money.ts` `payOut`, `payOrBorrow`)

Wenn `HAUSKONTO` nicht deckt, wird der Rest auf `HAUS_SCHULDEN` gebucht (`openLiability`). Es gibt **keinen Tilgungspfad** für Schulden — sie bleiben als Verbindlichkeit stehen, werden aber nie zurückgezahlt.

**Befund S1 (mittel):** `HAUS_SCHULDEN` kann unbegrenzt wachsen (jede nicht gedeckte Auszahlung, jede nicht gedeckte Reparatur, jeder nicht belegte Drink-Kosten). Es gibt keine Mechanik, die Schulden abbaut oder den Spieler zur Tilgung zwingt. Die Roadmap nennt dies als offenen Punkt ("Schulden haben keinen Tilgungspfad").

**Empfehlung:** Tilgungspfad definieren (z. B. automatische Teilrückführung bei Gewinn, oder Spieler kann Schulden tilgen).

---

## 3. RNG — Zwei Namespaces, keine Umwege

### 3.1 Architektur (`src/core/rng/prng.ts`, `streams.ts`)

- `Prng` (Mulberry32): `nextInt()` mit Rejection-Sampling (kein Modulo-Bias), `nextFloat()`, `getState()/setState()` für Save
- `role: 'gameplay'` bewegt Welt und Spiele; `role: 'presentation'` versorgt Partikel und Sound
- `assertGameplayRng(prng)` wirft bei falschem Strom in `tickWorld` und `playRound`
- `entropySeed()`: Einmaliger Krypto-Zufall (`crypto.getRandomValues`) beim Laufstart
- ESLint blockt: `Math.random`, `Date.now`, `performance.now`, `new Date()`, `getRandomValues`, `randomUUID` in `src/**` und `scripts/**` (Ausnahmen namentlich in `eslint.config.mjs`)

**Bewertung: Grün.** Kein Zugriff auf Umgebungszufall oder Uhr im Spielzustand. `performance.now` nur in 3 Pacing-Dateien unter `src/render/` erlaubt.

### 3.2 Weighted Distribution (`src/core/rng/weighted.ts`)

- `MAX_BIAS_BPS = 9_000` (10,99x Maximalbias), Deadzones, keine Einzelchance ≥ 1
- `pickWeighted()`: abgelehnte Einträge übersprungen, ohne Kandidat → `null`

**Bewertung: Grün.** Bias ist hart begrenzt und dokumentiert.

### 3.3 Karten-Schuh (`src/core/rng/shoe.ts`)

- Ziehen ohne Zurücklegen, partieller Fisher-Yates, Mischen nur bei leerem Schuh
- Save speichert `prngState`; nach Laden wird am gespeicherten Zustand fortgesetzt

**Bewertung: Grün.** Deterministisch und reproduzierbar.

---

## 4. Save v10 — Migration und Integrität

### 4.1 Format (`src/store/save.ts`, `migrate.ts`)

- Version 10, Key `vcoin.casino.v10`
- Persistiert: Welt, Ledger-Einträge, Journal, Look, Narrative-Domäne, Rivalen-Zustand, PRNG-State
- `LEGACY_KEYS`: v5–v9 migrieren (Fiat, offene Gewinne, Journal, Look, Besuchererinnerungen, Rivalen-Zustand erhalten; PRNG-Position fortgesetzt)
- `OLD_KEYS`: v3/v4 werden verworfen

### 4.2 `replaySave()` — Ledger-Replay beim Laden

```typescript
for (const entry of saved.entries ?? []) {
  ledger.transfer(entry.from, entry.to, entry.amount, entry.reason, entry.tick);
}
```

Alle Ledger-Einträge werden beim Laden erneut gebucht. `DEPTH_ACCOUNT` wird vorab als Liability geöffnet, damit Schulden-Einträge nicht als Unterdeckung fehlschlagen. Danach `ledger.verifyLedgerIntegrity()`.

**Bewertung: Grün.** Das Ledger wird beim Laden vollständig revalidiert. Ein korrupter Save führt zu `null` (Laden abgelehnt).

### 4.3 `hydrateWorld()` — Default-Füllung und Heilung

- Fehlende Felder erhalten Defaults (`thirst: 20`, `bladder: 10`, `condition: 100`, `stock: 4` für BAR, `parts: 2`, etc.)
- Verwaiste Referenzen werden geheilt (Crate ohne Träger → `carriedBy: null`, Dispute ohne Gäste → entfernt, Agent ohne Kiste → `carryingCrate: null`)
- `repairDeviceIdentity()` heilt Geräte-Identität aus Katalog

**Bewertung: Grün.** Defensiv und referenzsicher.

### 4.4 Befund S2 (niedrig): Archiv = Journal beim ersten Load

`migrate.ts:106`: `world.archive = (saved.archive ?? world.journal).map(...)`. Wenn kein `archive` existiert, wird der aktuelle `world.journal` als Archiv verwendet. Das Archiv soll die dauerhafte Historie jenseits des 240er-Puffers sein; beim ersten Load ist es identisch mit dem Journal — kein separater dauerhafter Bestand.

**Empfehlung:** Archiv initial leer lassen oder separat auffüllen.

---

## 5. IO / Transfer (`src/core/io/`)

- `issues.ts`: Befund mit Stufe `FATAL`/`REPAIR`/`IGNORE`, Übersetzung in Eskalations-Leiter
- `envelope.ts`: Umschlag mit FNV-1a-Prüfsumme
- `repair.ts`: Nutzlast prüfen, fehlende Pflichtfelder ergänzen, Blocker melden
- `transfer.ts`: Export aus `toSavedGame`, Import über `replaySave`, Trockenlauf vor Anwendung

**Bewertung: Grün.** Trockenlauf, Prüfsumme, kein zweite Save-Wahrheit.

---

## 6. Sicherheit — Ermittelte Befunde

| ID | Schwere | Befund | Datei | Empfehlung |
|----|---------|--------|-------|------------|
| S1 | mittel | `HAUS_SCHULDEN` hat keinen Tilgungspfad; Schulden können unbegrenzt wachsen | `money.ts` `payOut`, `payOrBorrow` | Tilgungspfad definieren |
| S2 | niedrig | Archiv = Journal beim ersten Save-Load (kein separates Archiv) | `migrate.ts:106` | Archiv separat initialisieren |
| S3 | info | `diagnose()` führt vollen Replay durch (teuer), nur auf Anforderung | `ledger.ts:189` | Bereits korrekt — nur auf Klick |
| S4 | info | Kein `addVC` außerhalb von Buchungslogik nachgewiesen | alle | Keine Änderung nötig |
| S5 | info | RNG zwei Namespaces, ESLint-Sperre funktioniert | `rng/`, `eslint.config.mjs` | Keine Änderung nötig |

---

## 7. Fazit Report 2

Das Geldsystem ist durchgängig sicher (Ledger, fail-closed, Bilanz-Null). RNG ist korrekt getrennt und deterministisch. Save v10 migriert und replays das Ledger beim Laden mit Integritätsprüfung.

Der einzige sicherheitsrelevante offene Punkt ist **S1** (Schulden ohne Tilgungspfad), der jedoch von der Roadmap bereits als bekannt aufgeführt ist. Keine kritischen Sicherheitslücken.

---

*Ende Report 2. Nächster Schritt: Report 3 (Spielverhalten, Duplikate, Gaps, Commit-Historie).*
