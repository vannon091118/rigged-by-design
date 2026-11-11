# First-Run-Nachfrage und Slot-Wahrheit

**Ziel:** Der erste Gast erscheint nur, wenn das eigene Casino geöffnet ist und eine Kasse existiert. Die Linien-RTP-Anzeige zählt genau die Läufe, die die Engine zahlt. Eigene Slot-Spins können kein Profil über 100 % ausnutzen; das Label nennt bei einer Deckungskürzung den tatsächlich gezahlten Multiplikator.

## Task 1: Erster Gast nur mit Kasse

- `createNewGame` behält aus dem Blueprint ausschließlich die `EXCHANGE`; der leere Raum und die Starter-Kiste bleiben.
- `spawnGuest` prüft Kasse und Weg, bevor `nextGuestId` oder der PRNG verbraucht wird.
- `tickDemand` läuft nur in `scene.kind === 'OWN'` und mit erreichbarer Kasse. Bereits anwesende Gäste werden weiterhin von `tickWorld` simuliert.
- Tests: neues Spiel mit genau einer Kasse; kein Spawn/PRNG-Verbrauch ohne Kasse; Stadt-Scene hält die erste Ankunft zurück; Wechsel in `OWN` lässt sie zu.

## Task 2: Exakte Linien-Erwartung

- `lineStats` berechnet pro Linie die exakte Verteilung des längsten Laufs. Ein reiner Buch-Lauf zahlt `BOOK` nur, wenn die gesamte Linie aus Büchern besteht. Kürzere Läufe mit reinem Buch-Präfix werden nicht jedem Fremdsymbol gutgeschrieben.
- `modelExpectation('LINES', …)` und `slotChances().lineHitBps`/`linesPerSpin` lesen dieselbe Funktion.
- `BASE_SCALE` bleibt unverändert; die korrigierten Erwartungen sind die neue Wahrheit.
- Tests: 3-Walzen-Erwartung gegen vollständige Enumeration; 3/4/5-Walzen-Anker; exakte Trefferchance je Linie.

## Task 3: Slot-Wahrheit und eigener Geldweg

- `playSlotSession` verbucht den bonus-inklusiven Multiplikator im Drucklader.
- Bei einer Kürzung durch den Deckungspuffer zeigt das Label den tatsächlich gezahlten Multiplikator, nicht den Engine-Wunsch.
- `playOwnRound` sperrt eigene SLOT-Spins mit `payScaleBps > 10_000`, `bonusPayScaleBps > 10_000` oder `multiplier > 1` vor Ledger- und PRNG-Wirkung. Das Debt-Konto bleibt für Gastauszahlungen und echte Unterdeckung bestehen.
- Tests: gekürztes Label; Bonus im Drucklader; drei Guard-Fälle ohne Buchung und ohne RNG-Verbrauch.

## Task 4: Verifikation und Lieferung

- Fokustests: `pnpm exec vitest run --config src/Config/vite.config.ts src/store/__tests__/new-game.test.ts src/core/sim/__tests__/spawn-demand.test.ts src/core/games/__tests__/slot-expectation.test.ts src/core/games/__tests__/slot-session.test.ts src/core/sim/__tests__/own-play.test.ts src/core/games/__tests__/slot-profile.test.ts src/core/games/__tests__/slot-session-rtp.test.ts`
- Gates: `pnpm run typecheck`, `pnpm run verify:light`, `pnpm run test:affected`, `pnpm run verify:claims`, `pnpm run narrative:blocks`.
- Narrative je Code-Commit, danach `node scripts/sync-generated.mjs --all`.
- Abschluss über `pnpm run turn:finish`, PR-CI auf exaktem Kopf und `promote`; kein Force-Push, kein Löschen des Branches.
