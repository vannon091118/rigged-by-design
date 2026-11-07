# Runbook: Auto-Resolve aktivieren und prüfen

**Gültig ab:** v0.3.183 · 2026-11-07

**Gilt für:** `vannon091118/rigged-by-design`

**Vertrag:** `.github/workflows/auto-resolve.yml`, `scripts/auto-resolve.mjs`, `scripts/lib/repair-plan.mjs`

Dieses Runbook ist die zentrale Aktivierungs- und Prüfanleitung für Auto-Resolve. Es beschreibt den Schalter, das Push-Token, die benötigten Berechtigungen, den ersten Lauf und die Nachweise. Jeder Schritt nennt einen Befehl und ein erwartetes Ergebnis; ein Schritt ohne Nachweis gilt nicht als erledigt.

## Zweck und Grenzen

Auto-Resolve reagiert auf einen **abgeschlossenen roten `CI Verify`-Lauf**. Es ordnet den Befund ein, wiederholt rein transiente Fehler höchstens einmal, repariert ausschließlich mechanische Doku-/Generat-Pfade in einem temporären Worktree und legt erst danach ein dedupliziertes Issue an.

Bewusste Grenzen:

- **`main` wird nie automatisch repariert.** Dort entsteht nur ein Issue; der Branch-Schutz bleibt die letzte Instanz.
- **Fork-PRs werden nie automatisch repariert.** Dafür fehlt die vertrauenswürdige Steuerung.
- **Produktcode und Tests bleiben beim Agenten.** Mechanisch sind nur Doku-Marker, Dependency-Matrix, Testkatalog und Inventur.
- **Ein Versuch pro SHA, und nur bei `run_attempt=1`.** Ein `gh run rerun` des CI-Laufs erzeugt Versuch 2 und blockiert die Reparatur; ein zweiter Versuch braucht einen neuen Lauf oder Commit.
- **Kein Force-Push.** Ist der Branch weitergelaufen, wird der Push abgelehnt und ein Issue angelegt.
- **`workflow_dispatch` ist kein End-to-End-Test.** Ohne `workflow_run.id` fehlt `RUN_ID`; der Lauf endet mit `kein RUN_ID, nichts zu tun`.
- **Keine rückwirkende Verarbeitung.** Bereits rote Läufe werden nicht nachträglich eingesammelt; es braucht einen neuen abgeschlossenen Lauf.

## Aktivierungscheckliste

| # | Schritt | Nachweis |
| --- | --- | --- |
| 1 | Governance-Stand nach `main` mergen | `gh workflow list` zeigt `Auto-Resolve` |
| 2 | Repository-Variable `RBD_AUTO_RESOLVE=1` setzen | `gh variable get` liefert `1` |
| 3 | Optional zuerst Patch-Modus testen | Auto-Resolve-Log: `Patch bereitgestellt` |
| 4 | `AUTOFIX_TOKEN` als Repository-Secret setzen | `gh secret list` zeigt den Namen |
| 5 | Workflow-Berechtigungen prüfen | `issues: write`, `actions: write` für Retries |
| 6 | Roten `CI Verify`-Lauf auf einem Same-Repo-Branch auslösen | neuer Auto-Resolve-Lauf |
| 7 | Reparatur oder Patch prüfen | Artefakt bzw. Commit auf dem Branch |
| 8 | Kein Doppel-Issue und kein stilles Skip | `pr-watcher` schweigt; Issue nur bei Eskalation |

## 0. Voraussetzung: Merge nach `main`

Auto-Resolve ist an `workflow_run` gebunden:

```yaml
on:
  workflow_run:
    workflows: ["CI Verify"]
    types: [completed]
```

Der Workflow muss deshalb auf dem Default-Branch liegen. Der Job checkt `main` aus und führt die Steuerung aus `main` aus; die zu reparierende Branch ist nur das Prüfobjekt im temporären Worktree.

```bash
git fetch origin
git show origin/main:.github/workflows/auto-resolve.yml >/dev/null \
  && echo "Workflow auf main vorhanden"

gh workflow list --repo vannon091118/rigged-by-design
```

**Erwartung:** `Auto-Resolve` ist gelistet und nicht deaktiviert. Actions müssen im Repository aktiviert sein, und die Repo-/Org-Policy darf `issues: write` für Actions nicht blockieren. Erst danach die Variable setzen — vor dem Merge liest GitHub die Workflow-Datei noch nicht von `main`.

## 1. Repository-Variable setzen

**UI:** `Repository → Settings → Secrets and variables → Actions → Variables → New repository variable`

- **Name:** `RBD_AUTO_RESOLVE`
- **Value:** `1`

**CLI:**

```bash
gh variable set RBD_AUTO_RESOLVE \
  --repo vannon091118/rigged-by-design \
  --body "1"

gh variable get RBD_AUTO_RESOLVE \
  --repo vannon091118/rigged-by-design
```

**Erwartung:** `1` — exakt die Zeichenkette `1`, nicht `true`.

Die Variable wird an zwei Stellen gelesen:

- `.github/workflows/auto-resolve.yml`: `vars.RBD_AUTO_RESOLVE == '1'`
- `.github/workflows/pr-watcher.yml`: `${{ vars.RBD_AUTO_RESOLVE || '0' }}`, danach `process.env.RBD_AUTO_RESOLVE === '1'`

Damit unterdrückt `pr-watcher` bei aktivem Auto-Resolve seine eigenen Gate-Issues; sonst würden zwei Stellen denselben Befund melden. Die Variable ist eine **Repository-Variable**, kein Secret und keine Environment-Variable.

Zum Deaktivieren: `RBD_AUTO_RESOLVE=0` setzen oder die Variable löschen. Wird nur der Workflow deaktiviert, aber die Variable auf `1` gelassen, schweigt `pr-watcher` weiterhin — beides gemeinsam abschalten.

## 2. `AUTOFIX_TOKEN` als Repository-Secret

Das Secret ist für den ersten Test **optional**. Ohne `AUTOFIX_TOKEN` repariert Auto-Resolve im temporären Worktree, pusht aber nicht, sondern stellt den verifizierten Patch als Artefakt `autofix-patch` bereit. Das ist der sichere erste Schritt.

Das Secret wird nur für den Git-Push verwendet. Der Workflow-eigene `GITHUB_TOKEN` bleibt für Checkout, Issues und Actions zuständig.

### Variante A: Fein granulierter PAT (kürzester Weg ohne Workflow-Änderung)

**Token erstellen:** `Personal Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token`

- **Resource owner:** `vannon091118`
- **Repository access:** `Only select repositories` → `rigged-by-design`
- **Repository permissions:**
  - `Contents: Read and write` — für den Push des Reparatur-Commits
  - `Metadata: Read-only` — zwingend, wird automatisch ergänzt

Mehr braucht der Token nicht. Issues, Actions und PR-Lesen laufen über den workflow-eigenen `GITHUB_TOKEN`.

**Secret setzen:** `Repository → Settings → Secrets and variables → Actions → Secrets → New repository secret`

- **Name:** `AUTOFIX_TOKEN`
- **Value:** der PAT

**CLI** (interaktiv, damit der Token nicht in der Shell-History landet):

```bash
gh secret set AUTOFIX_TOKEN --repo vannon091118/rigged-by-design
gh secret list --repo vannon091118/rigged-by-design | grep AUTOFIX_TOKEN
```

**Erwartung:** `AUTOFIX_TOKEN` ist gelistet; der Wert wird nie angezeigt. Den Token niemals in Dateien, Commits oder Chat kopieren; er gehört ausschließlich in das Repository-Secret. Ein jemals in Chat, Log oder Commit geposteter PAT gilt als kompromittiert: widerrufen und durch einen neuen mit Ablaufdatum ersetzen.

Classic PAT funktioniert alternativ mit dem Scope `repo` (privat) bzw. `public_repo` (öffentlich), ist aber breiter als nötig. Bei SSO muss der Token für die Organisation autorisiert sein.

### Variante B: GitHub App

Die App braucht:

- **Repository permissions:** `Contents: Read and write`, `Metadata: Read-only`
- Installation auf `rigged-by-design`

Der aktuelle Workflow liest nur `secrets.AUTOFIX_TOKEN`; er erzeugt **kein** App-Installationstoken. Ein manuell erzeugtes Installationstoken läuft nach einer Stunde ab und ist als Secret nicht praktikabel. Für eine App muss deshalb ein Mint-Schritt ergänzt werden:

```yaml
- name: App-Token erzeugen
  id: app-token
  uses: actions/create-github-app-token@<sha>
  with:
    app-id: ${{ vars.AUTOFIX_APP_ID }}
    private-key: ${{ secrets.AUTOFIX_APP_PRIVATE_KEY }}
    owner: ${{ github.repository_owner }}
    repositories: ${{ github.event.repository.name }}
```

Danach in der Auto-Resolve-Stufe:

```yaml
AUTOFIX_TOKEN: ${{ steps.app-token.outputs.token }}
```

App-ID als Repository-Variable `AUTOFIX_APP_ID`, Private Key als Secret `AUTOFIX_APP_PRIVATE_KEY` speichern. Den Private Key **nicht** als `AUTOFIX_TOKEN` hinterlegen. Die Action wie im Repo üblich per SHA pinnen.

App-Token und PAT-Pushes lösen — anders als ein Push mit `GITHUB_TOKEN` — neue Workflow-Läufe aus. Genau deshalb pusht Auto-Resolve nur mit `AUTOFIX_TOKEN`: Der Reparatur-Commit soll wieder `CI Verify` starten.

### PAT oder App?

| Kriterium | Fein granulierter PAT | GitHub App |
| --- | --- | --- |
| Workflow-Änderung nötig | nein | ja, Mint-Schritt |
| Laufzeit | bis zum Ablaufdatum | Installationstoken, 1 Stunde |
| Rechte | Contents RW, Metadata R | Contents RW, Metadata R |
| Push startet CI | ja | ja |
| Empfehlung | für den aktuellen Stand | für organisationsweite Rotation |

## 3. Workflow-Berechtigungen

Der Workflow setzt aktuell:

```yaml
permissions:
  contents: read
  issues: write
  actions: write
  pull-requests: read
```

| Berechtigung | Zweck |
| --- | --- |
| `contents: read` | Checkout von `main` und des Prüfobjekts |
| `issues: write` | Gate-Issues und Labels anlegen |
| `actions: write` | Jobs/Logs und `ci-plan`-Artefakt lesen; `POST /rerun` für transiente Befunde |
| `pull-requests: read` | vorhanden; für Auto-Resolve selbst nicht kritisch |

**Retry-Recht:** Der Code ruft für rein transiente Befunde `POST /actions/runs/{runId}/rerun` auf. Dafür ist `actions: write` gesetzt; `workflow-hardening.test.ts` hält die Berechtigung fest. Fehlt das Recht in einer älteren Workflow-Version, loggt das Skript `Wiederholung fehlgeschlagen (403)` und beendet den Job mit Exit 0; der Befund bleibt dann REMOTE_CI.

Zusätzlich prüfen:

- `AUTOFIX_TOKEN` braucht **Contents: Read and write** auf dem Zielrepo.
- Bei geschützten Feature-Branches muss die Identität des Tokens push-berechtigt sein bzw. eine Bypass-Regel haben.
- `main` wird nie gepusht; dort entsteht nur ein Issue.
- Der Push ist ein normaler `git push HEAD:<branch>`, kein Force-Push.

## 4. Ersten Lauf verifizieren

### Stufe A — Patch-Modus, noch ohne `AUTOFIX_TOKEN`

Stufe A setzt voraus, dass `AUTOFIX_TOKEN` noch nicht gesetzt ist. Ist das Secret bereits gesetzt, wird gepusht; dann Stufe A überspringen oder einen separaten Test-Clone verwenden.

1. Branch nach `main` mergen.
2. `RBD_AUTO_RESOLVE=1` setzen.
3. Einen **neuen** roten `CI Verify`-Lauf auf einem Same-Repo-Feature-Branch ohne offenen PR starten. **Nicht** `gh run rerun` verwenden: Das erhöht `run_attempt`; Auto-Resolve repariert nur bei Versuch 1.
   ```bash
   gh workflow run "CI Verify" --ref <branch> \
     --repo vannon091118/rigged-by-design
   gh run list --workflow="CI Verify" --branch <branch> --limit 3 \
     --repo vannon091118/rigged-by-design
   ```
4. Nach Abschluss des CI-Laufs triggert `workflow_run` Auto-Resolve. Im Log erwarten:
   ```text
   auto-resolve: repair - mechanische Doku-/Generat-Pfade
   auto-resolve: Patch bereitgestellt (artifacts/autofix-<sha12>.patch); kein Push ohne AUTOFIX_TOKEN
   ```
5. Artefakt prüfen:
   ```bash
   gh run download <auto-resolve-run-id> -n autofix-patch \
     -D .verify-cache/autofix \
     --repo vannon091118/rigged-by-design
   find .verify-cache/autofix -name 'autofix-*.patch'
   git apply --stat .verify-cache/autofix/autofix-<sha12>.patch
   ```
   Der Patch liegt direkt im Download-Ordner; sein Name kürzt die SHA auf zwölf Zeichen.

**Akzeptanz Stufe A:** Der Lauf ist nicht `skipped`; das Log nennt `Patch bereitgestellt`; das Artefakt enthält einen Patch; es wurde **kein** Commit auf den Branch gepusht.

### Stufe B — Push-Modus, mit `AUTOFIX_TOKEN`

1. Secret setzen.
2. Einen weiteren **neuen** roten Lauf auf einem Same-Repo-Branch auslösen — neuer Commit oder erneut `gh workflow run "CI Verify"`, nicht `gh run rerun`. Ein neuer SHA ist sauberer, weil pro SHA nur ein Reparaturversuch erlaubt ist.
3. Erwartung im Log:
   ```text
   auto-resolve: repariert und gepusht (docs/..., docs/INVENTORY.md, ...)
   ```
4. Reparatur-Commit prüfen:
   ```bash
   git fetch origin <branch>
   git log --oneline -3 origin/<branch>
   git show --stat --format=fuller origin/<branch>
   ```
   Erwartet: Autor `rbd-autofix <autofix@users.noreply.github.com>`, Betreff `chore(autofix): mechanische Doku- und Generat-Pfade`, nur mechanische Pfade.
5. Prüfen, dass der Push wieder CI ausgelöst hat:
   ```bash
   gh run list --workflow="CI Verify" --branch <branch> --limit 5 \
     --repo vannon091118/rigged-by-design
   ```

**Akzeptanz Stufe B:** Das Log nennt `repariert und gepusht`; auf dem Branch liegt genau ein Reparatur-Commit; für dessen SHA existiert ein neuer `CI Verify`-Lauf.

### Manueller Dispatch — nur Wiring-Test

```bash
gh workflow run auto-resolve.yml \
  -f sha=<40-zeichen-sha> \
  -f branch=<branch> \
  --repo vannon091118/rigged-by-design
```

Der manuelle Dispatch setzt **keine** `workflow_run.id`. Damit ist `RUN_ID` leer und `scripts/auto-resolve.mjs` beendet sofort mit:

```text
auto-resolve: kein RUN_ID, nichts zu tun
```

Das prüft Workflow, Variable und Checkout — **nicht** Reparatur oder Push. Für den echten Nachweis braucht es einen abgeschlossenen roten `CI Verify`-Lauf.

### Lauf und Ergebnis prüfen

```bash
gh run list --workflow="Auto-Resolve" --limit 5 \
  --repo vannon091118/rigged-by-design
gh run view <auto-resolve-run-id> --log \
  --repo vannon091118/rigged-by-design
```

Typische Logzeilen:

| Logzeile | Bedeutung |
| --- | --- |
| `kein RUN_ID, nichts zu tun` | Manueller Dispatch; kein echter Lauf |
| `repair - mechanische Doku-/Generat-Pfade` | Reparaturpfad |
| `Patch bereitgestellt ...` | Kein `AUTOFIX_TOKEN`; nur Artefakt |
| `repariert und gepusht` | Token funktioniert; Commit auf dem Branch |
| `issue - main oder ohne Branch: kein Autofix, Branch-Schutz entscheidet` | `main` wird bewusst nie repariert |
| `issue - Fork-PR: keine vertrauenswuerdige Steuerung, kein Autofix` | Fork-PRs werden bewusst nicht repariert |
| `issue - Befund ist nicht mechanisch: Produktcode bleibt beim Agenten` | Produktcode/Testfehler; Agent nötig |
| `issue - Autofix fuer diesen SHA bereits versucht` | Ein Versuch pro SHA verbraucht; `run_attempt=2` blockiert ebenfalls |
| `Wiederholung fehlgeschlagen (403)` | `actions: write` fehlt |

### Doppel-Issue ausschließen

```bash
gh issue list --label gate-failure --state open \
  --repo vannon091118/rigged-by-design
```

Bei aktivem Auto-Resolve legt `pr-watcher` keine eigenen Gate-Issues an; Auto-Resolve eskaliert nur, wenn es nicht reparieren kann. Ein erfolgreicher Reparaturlauf erzeugt **kein** Issue. Ein Eskalations-Issue trägt `gate-failure`, `agent-action` und den Scope-Label; der Fingerprint dedupliziert weitere Läufe.

## 5. Abnahmekriterien

- [ ] `RBD_AUTO_RESOLVE` ist eine Repository-Variable mit Wert `1`.
- [ ] `AUTOFIX_TOKEN` ist als Repository-Secret vorhanden (für Push-Modus).
- [ ] `Auto-Resolve` ist auf `main` vorhanden und nicht deaktiviert.
- [ ] Ein roter `CI Verify`-Lauf hat einen Auto-Resolve-Lauf ausgelöst.
- [ ] Stufe A: Patch-Artefakt vorhanden, kein Push.
- [ ] Stufe B: Reparatur-Commit auf dem Branch, `CI Verify` für den neuen SHA gestartet.
- [ ] Kein Doppel-Issue; Eskalation nur bei nicht mechanischem Befund.
- [ ] Deaktivierung wurde geprüft: `RBD_AUTO_RESOLVE=0` stoppt den Job und gibt `pr-watcher` den Issue-Pfad zurück.

## 6. Fehlerbilder

| Befund | Prüfung | Maßnahme |
| --- | --- | --- |
| Auto-Resolve-Lauf ist `skipped` | Variable exakt `1`? Workflow auf `main`? CI-Lauf erfolgreich? | Variable/Workflow korrigieren; bei grünem CI ist Skip korrekt |
| `kein RUN_ID` | Wurde `workflow_dispatch` benutzt? | Für den echten Test roten `CI Verify`-Lauf verwenden |
| `issue - main` | Lief der CI-Lauf auf `main`? | Kein Auto-Resolve auf `main`; Branch-Schutz |
| `issue - Fork-PR` | Kommt der PR aus einem Fork? | Same-Repo-Branch für den Test |
| `issue - nicht mechanisch` | Produktcode/Test betroffen? | Agent repariert; Auto-Resolve ist kein Code-Autofix |
| `issue - bereits versucht` | Wurde derselbe SHA schon repariert, oder ist `run_attempt=2`? | Neuen CI-Lauf starten oder neuen Commit erzeugen |
| `Patch bereitgestellt` | Fehlt `AUTOFIX_TOKEN`? | Für Push-Modus Secret setzen |
| `Wiederholung fehlgeschlagen (403)` | Workflow auf `main` hat `actions: write`? | Workflow-Version prüfen; Berechtigung ergänzen |
| Push schlägt fehl / Issue | Token-Rechte, Branch-Schutz, Branch weitergelaufen? | Contents-RW prüfen; Bypass oder neuen Lauf auf aktuellem SHA |
| Kein Artefakt | Wurde ein Issue statt Reparatur erzeugt? | Log und Issue prüfen; kein Patch ohne mechanische Änderung |

## 7. Deaktivieren und zurückrollen

```bash
gh variable set RBD_AUTO_RESOLVE \
  --repo vannon091118/rigged-by-design \
  --body "0"
```

Oder löschen:

```bash
gh variable delete RBD_AUTO_RESOLVE \
  --repo vannon091118/rigged-by-design
```

Danach ist der Auto-Resolve-Job aus, und `pr-watcher` legt wieder die bisherigen Gate-Issues an. `AUTOFIX_TOKEN` kann bestehen bleiben oder separat rotiert werden. Wird nur der Workflow deaktiviert, die Variable aber auf `1` gelassen, schweigt `pr-watcher` weiterhin — deshalb immer beides zusammen zurückrollen.

## 8. Quellen im Repo

- `.github/workflows/auto-resolve.yml` — Trigger, Schalter, Permissions, Secret-Anbindung, Artefakt
- `scripts/auto-resolve.mjs` — Einordnung, Patch/Push, Issue-Erzeugung
- `scripts/lib/repair-plan.mjs` — mechanische Allowlist, ein Versuch pro SHA, Fork-/Main-Ausschluss
- `scripts/pr-watcher.mjs` und `.github/workflows/pr-watcher.yml` — derselbe Schalter, Issue-Unterdrückung
- `docs/ARCHITECTURE.md#ci-eskalation` — Einordnung in die Eskalationsleiter
