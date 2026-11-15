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

6. **Übergabe statt Merge:** PR offen lassen, `RELEASE [A<n>] done <sha>` am Issue kommentieren und Label `review-waiting` setzen. Mergen, schließen und taggen tut ausschließlich der Maintainer.

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
- **Kein Merge und kein Close durch den Agenten.** Die Übergabe ist `RELEASE [A<n>] done <sha>` plus Label `review-waiting`; das Issue bleibt offen, bis der Maintainer oder der User es schließt.
- **Commit-Body muss** die drei Pflichtsektionen enthalten (`### Changes`, `### Technische Basis & Kausalität`, `### Ausblick`).

## ✅ Abschluss

Alles grün und gepusht: `RELEASE [A<n>] done <sha>` kommentieren, `review-waiting` setzen, Issue offen lassen. Schließen ist Maintainer- oder User-Sache.
