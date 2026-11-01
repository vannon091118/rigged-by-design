# Changelog

<!-- rbd-doc: v0.3.64 | 2026-11-01 09:23 UTC -->

Kurz, versionsweise, was sich fuer Spieler und Agenten geaendert hat.
Neuester Eintrag oben, jeder Eintrag mit Datum.

## Regeln

- Jede Aenderung bekommt einen Eintrag unter der Version, die `package.json` traegt.
- Kein Eintrag ohne Datum; Uhrzeit steht im `rbd-doc`-Marker am Dateikopf.
- Sichtbare Aenderungen unter "Spiel", interne Umbauten unter "Technik".
- Der Eintrag wird im selben Commit geschrieben wie die Aenderung, nie nachtraeglich.

## [0.3.65] - 2026-11-01

### Spiel

- Import und Export im Pruefungs-Popup: Spielstand als JSON sichern, vor dem Import pruefen und reparierbare Felder automatisch ergaenzen. Blocker verhindern den Import und nennen die Eskalationsstufe.

### Technik

- Globale Eskalations-Leiter `AUTO_FIX -> LOCAL_GATE -> REMOTE_CI -> AGENT -> BLOCKED` in `scripts/lib/escalation.mjs`; `npm run escalation:plan` nennt die Stufe zu einem Befund.
- Doc-Gate `verify:docs` mit Pflichtabschnitten, Marker und flachem Wurzelbaum; Pflege im Pre-Commit-Hook, nicht im Gate.
- Commit-Body blockiert nicht mehr: `.githooks/commit-msg` eskaliert, `pr-escalation.yml` hebt den Body in den PR-Body.
- Dependency-Matrix und Testkatalog sind keine Pipeline-Gates mehr; Matrix, Katalog und Doku-Marker schreibt der Pre-Commit-Hook.
- Neue Fehlercodes `ERR-4017` (Doku), `ERR-4018` (Hooks), `ERR-5001` (Import).
- Import-Engine modular unter `src/core/io/` (Umschlag, Pruefung, Reparatur) mit `src/store/transfer.ts` als Anbindung.
