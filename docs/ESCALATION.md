# Eskalation statt Fail-Closed

Ein Fehlschlag ist kein Urteil, sondern eine Stufe. Die Leiter ist global und
gilt fuer Pipeline, Hooks, CI und Import-Befunde.

## Die Leiter

| Stufe | Bedeutung | Wer handelt |
| --- | --- | --- |
| `AUTO_FIX` | Automatisch reparierbar: Doku-Marker, Format, Matrix, Katalog. | `npm run fix` oder der Pre-Commit-Hook |
| `LOCAL_GATE` | Ausserhalb des Scopes: kein Blocker, wird verworfen. | niemand |
| `REMOTE_CI` | Netz, Registry oder Runner: lokal nicht reproduzierbar. | CI erneut starten |
| `AGENT` | Struktur, Sektion oder Zustaendigkeit fehlt. | Agent nach `AGENTS.md` |
| `BLOCKED` | Geld, Ledger, RNG, Save-Integritaet oder Rechte. | Mensch, fail-closed |

Die Reihenfolge ist bindend: erst reparieren, dann wiederholen, erst danach ein
Agent. `BLOCKED` wird nie automatisch uebersprungen.

## Klassifikation

`scripts/lib/escalation.mjs` ordnet einen Befundtext einer Stufe zu:

- Geld, Ledger, Buchung, VaCoin, RNG, PRNG, Save-Integritaet -> `BLOCKED`.
- `ERR-0911`, Doku-Marker, "nicht synchron", Matrix, Katalog -> `AUTO_FIX`.
- `ECONN*`, Timeout, Rate Limit, 5xx, Registry -> `REMOTE_CI`.
- "ausserhalb des Scopes" -> `LOCAL_GATE`.
- Alles andere -> `AGENT` (Struktur).

`npm run escalation:plan` liest den letzten Gate-Befund und nennt die Stufe.
Die Import-Engine uebersetzt dieselbe Idee: `FATAL -> BLOCKED`,
`REPAIR -> AUTO_FIX`, `IGNORE -> LOCAL_GATE`.

## Wo eskaliert wird

- **Pre-Commit** schreibt Doku-Marker, Matrix und Katalog; LOC bleibt ein
  lokales Gate, weil ein zu grosses Modul nicht automatisch splittbar ist.
- **Commit-Msg** blockiert nicht mehr: fehlende Pflichtsektionen loesen
  `PR Escalation` aus.
- **GitHub CI** (`pr-escalation.yml`) baut den PR-Body aus Subject und Body und
  legt den PR an oder aktualisiert ihn. Ohne `gh` bleibt der Lauf gruen und der
  Body liegt in `.git/rbd-pr-body.md`.
- **Pipeline** hat kein schreibendes Gate; Reparaturen laufen ueber `npm run fix`.
- **Promotion** (`promote.yml`) ist die Stufe danach: gruen mergt automatisch,
  rot landet auf der permanenten Branch `integration` und wird dort repariert.
  Ein Textkonflikt wird gelabelt (`integration/konflikt`), nicht erzwungen; die
  Leiter bleibt damit auch beim Merge dieselbe.

## Connector als Eskalationsweg

Wenn `gh` fehlt oder nicht angemeldet ist (typisch fuer Agenten ohne CLI-Token),
bleibt der Lauf gruen und `scripts/lift-commit-body.mjs` gibt den Plan aus:

```bash
node scripts/lift-commit-body.mjs --json
```

Der Plan nennt `level`, `channel`, `branch`, `base`, `title`, `bodyFile` und
`body`. Ein Agent mit GitHub-Connector legt damit den PR an oder aktualisiert
seinen Body; der Connector ersetzt `gh`, nicht die Regel. Der Level kommt aus
derselben Leiter (`AGENT`), es gibt keine zweite Klassifikation.

Reihenfolge: CI mit `gh` versucht zuerst; scheitert das, uebernimmt der
Connector. Beide Wege schreiben denselben Body aus derselben Datei.

## Nicht verhandelbar

- Kein Gate schreibt im Verify-Lauf.
- Keine Ausnahme fuer Geld-, Ledger- oder Save-Regeln.
- Keine lokalen Testlaeufe waehrend der Arbeit; Tests laufen am Turn-Ende oder
  in GitHub Actions.
- Keine zweite Wahrheit: eine Leiter, ein Marker, eine Doku-Liste.
