# Sicherheit: GITHUB_TOKEN für Maintainer-Cronjob

## Regel

Der `GITHUB_TOKEN` wird **ausschließlich als Umgebungsvariable** bereitgestellt. Er wird **niemals** im Cronjob-Prompt, in Kommentaren oder in irgendeiner Datei im Repository hardcoded.

## Warum

- Der Cronjob-Prompt lebt im `cronjob_manage`-State und ist nicht versionskontrolliert
- Ein im Prompt hardcodeter Token ist für jeden einsehbar, der auf Cron-History oder Delegation-Output zugreifen kann
- Ein im Repo committeter Token würde das gesamte Repository kompromittieren

## Umsetzung

- Der Cronjob liest `GITHUB_TOKEN` aus `process.env`
- Der Prompt verweist lediglich auf die Umgebungsvariable, ohne den Wert zu enthalten
- Keine Datei im Repository enthält den Token-Wert

## Rotation

Bei Verdacht auf Kompromittierung muss der Token sofort über GitHub Settings → Developer settings → Personal access tokens rotiert und die Umgebungsvariable neu gesetzt werden.
