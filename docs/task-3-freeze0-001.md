# Kontext-Chain-Eintrag: FREEZE-0 Gap #3 — promote-merge fail-closed

<!-- rbd-doc: managed -->

## Metadaten

| Feld | Wert |
|---|---|
| entry_id | task-3-freeze0-001 |
| task_id | 3 |
| priorität | P0 |
| status | implementiert_dokumentiert_verifikationsblockiert |
| erstellt_am | 2026-11-20 |
| erstellt_von | maintainer (FREEZE-0 ACCEPT) |
| current_agent | jenova |
| next_agent | governance-office (Re-Review) |
| cycle_id | 1 |
| stop.flag_geprüft | true (nicht vorhanden → Loop läuft) |
| blocker | node/pnpm nicht ausführbar — pnpm verify nicht lauffähig, keine Testnachweise |
| implementiert_von | jenova |
| implementiert_am | 2026-11-20 |
| repo_sha | bd5e3ca06be246d721e2f0ad02791722e1c4e518 |
| branch | fix/1188-verify-all-test-quality |
| handoff_kette | jenova → lillith → shinon → governance-office → maintainer → hermes |

## Fix: FREEZE-0 Gap #3 (promote-merge.mjs Zeile 30-32)

### Problem
`promote-merge.mjs` erlaubte einen Legacy-Merge bei fehlendem Task-Vertrag (nur Warnung, keine Blockade). Das untergräbt den FREEZE-0-Schutz und ermöglicht indirekte Umgehung der Branch-Protection.

### Code-Stelle (vor dem Fix)
```javascript
} else {
  warn(`PR #${number}: kein Task-Vertrag am Kopf; Legacy-Merge mit Warnung`);
}
```

### Code-Stelle (nach dem Fix)
```javascript
} else {
  return holdPromotion(number, null, 'FEHLGESCHLAGEN: kein Task-Vertrag am Kopf des Branches (fail-closed)');
}
```

### Auswirkung
Bei fehlendem Task-Vertrag wird der Merge nicht mehr mit Warnung fortgeführt, sondern mit `holdPromotion` blockiert. Dies ist konsistent mit allen anderen Prüfstellen in `promote-merge.mjs` (Zeile 18-19, 24-26, 27-29, 36-37, 40-43, 46-51, 54-55, 57-58, 61-67, 71), die alle `holdPromotion` verwenden.

## stop.flag-Prüfung (vor jedem Schritt)
- Schritt 1 (Lesen Audit-Dokument): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 2 (Fix implementieren): stop.flag nicht vorhanden → Loop läuft ✓
- Schritt 3 (Ergebnis zurückschreiben): stop.flag nicht vorhanden → Loop läuft ✓

## Implementierung im Claim-Scope
Der Claim-Scope dieses Eintrags ist Governance-Fix für FREEZE-0 (kein Spiel-Code in `src/core/`). Keine isolierten Attrappen, keine Ersatzarchitekturen. Ein einziger, präziser Zeilen-Fix.

## Verifikation (BLOCKIERT)
`pnpm rbd verify light` und `pnpm rbd verify fast` können in dieser Umgebung nicht ausgeführt werden: `node` und `pnpm` sind nicht ausführbar (Android-Terminal, Symbol-Fehler bei node, `pnpm: command not found`). Keine Testnachweise vorhanden. Dies ist ein dokumentierter Blocker, kein Loop-Stopp.

## Bekannte Einschränkungen
- Keine ausführbaren Tests (kein node/pnpm)
- Kein git Push/PR möglich (kein arbeitender node/pnpm-Toolchain, Maintainer-Merge erforderlich)
- Fix ist konzipiert und geschrieben, nicht ausführbar getestet

## Nächste Schritte nach jenova
1. governance-office: Re-Review des FREEZE-0 Fixes (offizielle Handoff-Kette: jenova → governance-office)
2. governance-office → Handoff an maintainer
3. maintainer: PR-Review, Merge/Close, Tag (nach Bereitstellung der Umgebung)
4. hermes: Status-Check, Loop-Vollständigkeit, Nutzer-Info

## Invarianten (gültig für den gesamten Loop)
- stop.flag wird vor jedem Schritt geprüft
- Kontext-Chain-Eintrag ist einzige externe Wahrheit (überlebt Autocompact)
- Kein Agent startet ohne Handoff oder Cron-Trigger
- Jeder Schritt schreibt Ergebnis vor Handoff
- Nach Kompaktierung: Fortsetzung beim gespeicherten status
- Kein direkter Push auf main (immer Branch + PR + Maintainer-Merge)
- Handoff-Kette: jenova → lillith → shinon → governance-office → maintainer → hermes
