---
name: Lane / Claim
about: Erstelle einen Lane-Claim für parallele Agenten-Arbeit mit Pfad-Allowlist und Contract-Writer-Claims
title: "[LANE] <Lane-ID>: <Kurzbeschreibung>"
labels: ["lane"]
assignees: []
---

## 🛣️ Lane-Klaim

**Lane-ID:** `lane/<domäne>/<task>` (z. B. `lane/contracts/actor-id`)  
**Owner:** `<Name oder Agent>`  
**Branch:** `lane/<domäne>/<task>`  
**Basis-SHA:** `<commit-SHA aus 0.1 Baseline>`  
**Status:** `open`

## 📁 Pfad-Allowlist

Welche Dateipfade darf diese Lane schreiben? Jede Datei außerhalb der Allowlist blockiert den Commit.

```
- pfad/zur/datei1.ts
- pfad/zum/ordner/**
```

## 📄 Contract-IDs / Versionen

Welche Vertrags-IDs schreibt oder liest diese Lane? (read/write)

| Contract-ID | Version | Modus | Owner |
|-------------|---------|-------|-------|
| actor-id    | 1.0     | read  | —     |
| world-time  | 1.0     | write | lane/governance/02-governance |

## 🔗 Dependencies

Welche anderen Lanes müssen zuerst gemergt sein?

- `lane/contracts/actor-id` (basiert auf 0.1)

## ⚙️ Gate-Profil

`quick` oder `full`

## 🛡️ Capability-IDs

Welche Capabilities aus dem Capability-Manifest werden berührt?

- (leer, falls nicht zutreffend)

## 📋 Arbeitsschritte

- [ ] Basis-SHA aus 0.1 verifizieren
- [ ] Pfad-Allowlist erstellen
- [ ] Contract-Writer-Claims eintragen
- [ ] Implementierung
- [ ] `pnpm run verify:quick` grün
- [ ] PR gegen `main` erstellen und über `promote.yml` fördern

---\nLabel: lane\nPhase: 0\nPriorität: P0
