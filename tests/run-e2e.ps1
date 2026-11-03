# E2E-Test-Runner: Startet den Dev-Server, führt Playwright-Tests aus, beendet den Server.
param(
  [string]$TestPattern = "tests/*.spec.ts",
  [switch]$Headed = $true,
  [int]$WaitSeconds = 20
)

Write-Host "=== Starte Dev-Server auf Port 3000 ===" -ForegroundColor Cyan

# Dev-Server im Hintergrund starten
$proc = Start-Process -FilePath "powershell" -ArgumentList "-Command", "pnpm run dev --config src/Config/vite.config.ts" -PassThru -RedirectStandardOutput "dev-server.log" -RedirectStandardError "dev-server.err"

Write-Host "Warte ${WaitSeconds}s auf Server-Start..." -ForegroundColor Cyan
Start-Sleep -Seconds $WaitSeconds

# Prüfen ob Server läuft
$portTest = Test-NetConnection -ComputerName localhost -Port 3000 -InformationLevel Quiet
if (-not $portTest) {
  Write-Host "FEHLER: Dev-Server ist nicht auf Port 3000 erreichbar!" -ForegroundColor Red
  Get-Content dev-server.err -Head 20
  Stop-Process -Id $proc.Id -Force
  exit 1
}

Write-Host "Dev-Server läuft. Führe Playwright-Tests aus: $TestPattern" -ForegroundColor Cyan

$headedArg = if ($Headed) { "--headed" } else { "" }
npx playwright test $TestPattern --project=chromium-headed --headed --timeout 60000

$exitCode = $LASTEXITCODE

Write-Host "Beende Dev-Server..." -ForegroundColor Cyan
Stop-Process -Id $proc.Id -Force

exit $exitCode
