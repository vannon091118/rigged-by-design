---
name: Contract-Lane
about: Erstelle einen versionierten Fundament-Vertrag (Contract-Lane) für Phase 0.5
title: "[CONTRACT] <Contract-ID> v1.0"
labels: ["lane", "contract"]
assignees: []
---

## 📄 Contract-Lane

**Contract-ID:** `<actor-id | world-time | domain-event | relationship | factor | save>`  
**Version:** 1.0  
**Owner:** `<benannter Contract-Owner>`  
**Branch:** `lane/contracts/<contract-id>`  
**Basis-SHA:** `<SHA aus 0.1 / vorheriger Contract-Lane>`  
**Status:** `open`

## 📋 Vertragsspezifikation

### Zweck
<Kurzbeschreibung des Vertragszwecks>

### Stabile IDs
Welche IDs definiert dieser Vertrag? (z. B. Actor-ID-Format, Event-Type-IDs, Relationship-Type-IDs)

### Invarianten
Welche Unveränderlichkeiten garantiert dieser Vertrag?

### Leser / Schreiber
| Rolle | Lane-ID | Modus |
|-------|---------|-------|
| Schreiber | `lane/contracts/<id>` | write |
| Leser | `lane/domäne/<task>` | read |

### Kompatibilitätsregel
<Backward-Compatibility-Regel>

### Upgrade-/Deprecation-Strategie
<Wie werden Änderungen versioniert und deprecated?>

### Consumer
Welche Domain-Lanes konsumieren diesen Vertrag?

## 🔗 Dependencies

Welche Contract-Lanes müssen zuerst gemergt sein? (nach topologischer Reihenfolge: Actor-ID → WorldTime → Domain-Event → Relationship → Factor → Save)

- `<vorheriger Contract>` (falls zutreffend)

## ⚙️ Gate-Profil

`quick`

## 📋 Arbeitsschritte

- [ ] Issue-Claim erstellen mit Owner, Basis-SHA, Pfad-Allowlist
- [ ] Branch `lane/contracts/<contract-id>` erstellen
- [ ] Versionierte Contract-Datei unter `docs/contracts/<contract-id>.md` anlegen
- [ ] Minimalen TypeScript-Stub unter `src/core/contracts/<contract-id>.ts` erstellen
- [ ] Vertragstest unter `src/core/contracts/__tests__/<contract-id>.test.ts` erstellen
- [ ] `pnpm run verify:quick` grün
- [ ] PR gegen `main` erstellen und über `promote.yml` fördern
- [ ] Nach Merge: `agent:context` aktualisieren, Consumer-Lanes benachrichtigen

---\nLabel: lane, contract\nPhase: 0\nPriorität: P0
