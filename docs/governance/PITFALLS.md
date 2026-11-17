# Pitfalls

<!-- rbd-doc: managed -->

## Kern
Fuenf Fallen kosten am meisten Zeit. Jede nennt die Regel und das Gate, das sie haelt.

## Fallen
| Falle | Regel | Gate |
| --- | --- | --- |
| Gate-Zahl schaetzen | Zahl aus [CI](../CI.md) lesen | `rbd verify docs` |
| Fremdes WIP loeschen | Adoptieren und fertigbauen | `rbd claim preflight` |
| Generiertes editieren | Generator aendern, `rbd sync generated` | `rbd verify generated` |
| Selbst mergen oder schliessen | Nur Maintainer oder User | `rbd shell watch` |
| Zweite Wahrheit | Issue vor Datei, Code vor Prosa | Review |

## Doku-Regeln
- Pflichtdokus bleiben knapp: Kern ≤500 Token, Tiefe in Referenzdateien.
- Jede Code-Aenderung traegt eine Zeile in [LAST-CHANGES](LAST-CHANGES.md); Hot-Zone zusaetzlich in [ROADMAP](ROADMAP.md).
- Erst `rbd docs read`, dann Werkzeuge; der PreToolUse-Hook blockiert sonst.
- Fehlt eine Doku-Aktualisierung, blockiert der Drift-Check in pre-commit und pre-push.
