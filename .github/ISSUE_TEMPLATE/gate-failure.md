---
name: Gate-Fehler / CI-Red
about: Ein CI-Gate ist rot und muss von einem Agenten gelöst werden
title: "[GATE-RED] <Gate-Name> auf <Branch>"
labels: ["gate-failure", "agent-action"]
assignees: []
---

## 🚨 Gate-Fehler erkannt

**Betroffener Branch:** `<branch-name>`  
**Betroffener PR:** `<pr-url>` (falls zutreffend)  
**Rot-Gates:** `<gate-liste>`  
**CI Run URL:** `<run-url>`  
**Erkannt am:** `<timestamp>`  
**Erkannt durch:** `pr-watcher.yml`

## 📋 Was der Agent tun muss

1. **Checkout des betroffenen Branches:**
   ```bash
   git checkout <branch-name>
   git pull origin <branch-name>
   ```

2. **Alle Gates lokal ausführen:**
   ```bash
   pnpm run verify:quick
   # oder bei Bedarf:
   pnpm run verify:all
   ```

3. **Fehler beheben** bis alle Gates grün sind.

4. **Commit mit Pflichtsektionen erstellen:**
   ```text
   <type>: <Kurzbeschreibung>

   ### Changes (Was ist neu)
   ...

   ### Technische Basis & Kausalität
   ...

   ### Ausblick (Nächste Schritte)
   ...
   ```

5. **Auf den Branch pushen** (der CI-Run startet automatisch neu).

6. **Wenn alle Gates grün:** PR zu `main` erstellen und mergen (siehe AGENTS.md § PR+Merge-Pflicht).

## 🔍 Gate-Details

<details>
<summary>Gate-Ausgabe</summary>

```
<gate-output>
```

</details>

## 📎 Regeln (aus AGENTS.md)

- **Vor Beginn jeder Arbeit:** GitHub Issues prüfen. Offene `gate-failure`-Issues haben höchste Priorität.
- **Issue vollständig lösen:** Nicht halbherzig beheben, alle Gates müssen grün sein.
- **Nach jedem Turn/Phase/Slice-Abschluss:** Aufgezwungene PR+Merge-Pflicht.
- **Commit-Body muss** die drei Pflichtsektionen enthalten (`### Changes`, `### Technische Basis & Kausalität`, `### Ausblick`).

## ✅ Issue schließen

Sobald alle Gates grün sind und der PR gemergt wurde, dieses Issue als `completed` schließen.
