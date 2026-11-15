# Merge-Queue (#913)

> **Status:** Koordinator implementiert; serverseitige Erzwingung am Merge-Punkt
> ist **noch nicht** aktiv (siehe [Offener Teil](#offener-teil-serverseitige-erzwingung)).
> Bis dahin gilt die Uebergangsregel aus Issue #913: kein Merge ohne bestaetigte
> Queue-Revision.

## Warum

Issue-Prioritaet sagt, was als Naechstes bearbeitet wird. Die Merge-Queue sagt,
**welcher gelieferte PR in welcher Reihenfolge** nach `main` darf. Beides zu
vermischen war die Ursache von #909: ein gemeinsamer GitHub-Principal konnte per
API mergen, ohne dass Rolle oder Reihenfolge geprueft wurden.

## Ereignisprotokoll

Der Issue-Verlauf ist der sichtbare Eingang. Jedes Ereignis steht als eigene
Zeile `<EREIGNIS> key=value …` in einem Kommentar; Zeilen, die mit `>` beginnen,
gelten als Zitat und werden ignoriert.

| Ereignis | Pflichtfelder | Bedeutung |
| --- | --- | --- |
| `MERGE_SESSION_JOIN` | `role=maintainer\|worker agent=<id> session=<id>` | Session nimmt teil (optional `claim=<id>`) |
| `MERGE_SESSION_LEAVE` | `session=<id>` | Session verlaesst die Teilnehmermenge ausdruecklich; Timeout entfernt niemanden |
| `MERGE_PLAN` | `rev=<n> main=<sha> prs=<nr>@<head>:<base>,… session=<id>` | Veroeffentlicht eine vollstaendige Revision; **nur eine aktive Maintainer-Session** |
| `MERGE_ACK` | `rev=<n> hash=<plan-hash> main=<sha> session=<id>` | Bestaetigung genau dieser Revision |
| `MERGE_STARTED` | `pr=<nr> head=<sha>` | Beginn des Merges |
| `MERGE_COMPLETED` | `pr=<nr> merge=<sha> main=<sha>` | Merge-Beleg; erzwingt eine neue Revision |
| `MERGE_BLOCKED` | `pr=<nr> reason=<code>` | Abweichung oder Blocker |

Der **Plan-Hash** ist SHA-256 ueber die kanonische, nach PR-Nummer sortierte
Form `{rev, main, prs:[{number, head, base}]}`. Zwei Geraete, die denselben
Verlauf lesen, erhalten denselben Hash — unabhaengig von der Schreibreihenfolge
im Kommentar.

**Plan-Autoritaet:** `MERGE_PLAN` muss die `session` einer aktiven
Maintainer-Session nennen. Ein Plan ohne Session, mit unbekannter Session, mit
verlassener Session oder von einer Worker-Session wird verworfen und ist HOLD.
Sonst koennte ein Worker eine Revision veroeffentlichen und selbst bestaetigen —
die Reihenfolge waere koordiniert, die Autoritaet nicht.

## HOLD statt Zustimmung

`buildMergeState()` liefert `ready: false` und Gruende in `hold`, wenn:

- der externe Kettenkopf fehlt (die Kette ist dann nur erkennend),
- kein `MERGE_PLAN` existiert oder die Queue leer ist,
- ein `PLAN` keine aktive Maintainer-Session nennt,
- eine aktive Session kein ACK zur aktuellen Revision hat,
- ein ACK vor dem Plan entstand, zu einer anderen Revision gehoert oder eine
  unbekannte Session nennt,
- dieselbe Session eine Revision mit zwei verschiedenen Hashes bestaetigt
  (Duplikate mit identischem Hash sind idempotent),
- ein `JOIN` keine gueltige Rolle (`maintainer`/`worker`) oder keine Session nennt,
- ein `PLAN` nicht neuer ist als der vorherige,
- der letzte Plan bereits abgeschlossen ist,
- die Hash-Kette gebrochen ist oder der erwartete Kettenkopf abweicht.

`evaluateMerge()` prueft zusaetzlich PR-Nummer (nur der erste Eintrag), Head,
Base und `main` exakt gegen den bestaetigten Plan.

## Benutzung

```sh
# Kommentarverlauf des Issues als JSON (gh oder REST-Fallback)
node scripts/merge-queue.mjs --comments comments.json --expected-chain <sha256>
# Exit 0 = READY, Exit 1 = HOLD, Exit 2 = Eingabe nicht lesbar

# Abgeleiteten Snapshot schreiben (Cache, nie Quelle)
node scripts/merge-queue.mjs --comments comments.json --expected-chain <sha256> \
  --write .lane-claims/merge-queue.json
```

Ohne `--expected-chain` bleibt die Queue HOLD und der Snapshot traegt
`chainVerified: false`. Ein Snapshot ohne geprueften Anker ist kein Anker.

## Integritaet

Issue-Kommentare sind editierbar. Die Hash-Kette (`parseEvents` → `hashChain`)
macht jede Aenderung sichtbar: ein editierter Kommentar aendert seinen Payload,
damit seinen Hash und alle folgenden `prev`-Verweise. Der erwartete Kettenkopf
muss deshalb **ausserhalb** des Kommentarverlaufs liegen (geschuetzter Git-Ref
oder GitHub-App-Speicher). Fehlt er, ist die Kette nur manipulationserkennend,
nicht manipulationsresistent — dieser Unterschied wird nicht verdeckt: das Feld
`chainVerified` und der HOLD-Grund nennen ihn ausdruecklich.

Zeitvergleiche laufen ueber `Date.parse`, nicht ueber den String: `createdAt`
darf einen Offset tragen, ohne dass die Reihenfolge kippt.

## Offener Teil: serverseitige Erzwingung

Die Abnahmekriterien verlangen einen erforderlichen Statuscheck auf `main` und
getrennte Credentials fuer Worker und Maintainer. Das braucht Repository-Admin-
Rechte (Ruleset/Branch-Protection) und eine GitHub-App mit eigenem Schluessel.
Beides ist in dieser Umgebung nicht verfuegbar: es gibt weder ein Admin-Token
noch `RBD_APP_ID`/`RBD_APP_PRIVATE_KEY`.

Konkreter naechster Schritt fuer den Maintainer mit Admin-Rechten:

1. GitHub-App installieren, die `scripts/merge-queue.mjs --comments … --expected-chain …`
   als Check `merge-queue/ready` ausstellt.
2. Ruleset auf `main`: `merge-queue/ready` als required status check,
   `enforce_admins: true`, keine Bypass-Liste.
3. Worker-Token ohne `contents:write` auf `main` und ohne `pull_requests:write`
   fuer Merge/Close; Merge nur ueber die Maintainer-App.
4. Erwarteten Kettenkopf in einen geschuetzten Ref schreiben (App-only).

Session-IDs sind selbst deklariert. Die Plan-Autorisierung prueft die Rolle der
genannten Session, nicht die kryptografische Identitaet ihres Autors — erst der
App-Check unter 1. bindet beides an einen echten Principal.
