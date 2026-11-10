/** @test-target: src/core/sim/player-history.ts | @error-code: ERR-2001 */
import { describe, expect, it } from 'vitest';
import type { JournalEvent } from '../journal';
import { playerHistoryOf } from '../player-history';

function event(
  id: number,
  day: number,
  subject: string,
  effect: string,
  kind: JournalEvent['kind'] = 'GUEST',
): JournalEvent {
  return { id, tick: 0, day, kind, subject, cause: 'x', effect };
}

describe('Spielhistorie', () => {
  it('ist leer, solange das Archiv keine eigene Etappe kennt', () => {
    expect(playerHistoryOf([])).toEqual([]);
    expect(playerHistoryOf([event(1, 1, 'einsatz', 'Gebucht.')])).toEqual([]);
  });

  it('nimmt Gastduell und Hinterhof aus demselben Archiv', () => {
    const events = [
      event(1, 1, 'Duell gegen Rocco', 'Gewonnen: der Raedelsfuehrer ist raus.'),
      event(2, 2, 'Hinterhof gegen Bulle Bernd', 'Gewonnen: KO in Runde 2 · Preisgeld 1,20 VC.'),
    ];
    expect(playerHistoryOf(events)).toEqual([
      { id: 1, day: 1, label: 'Duell gegen Rocco', detail: 'Gewonnen: der Raedelsfuehrer ist raus.' },
      { id: 2, day: 2, label: 'Hinterhof gegen Bulle Bernd', detail: 'Gewonnen: KO in Runde 2 · Preisgeld 1,20 VC.' },
    ]);
  });

  it('nennt den Buden-Kauf beim Namen statt des rohen Subjekts', () => {
    expect(playerHistoryOf([event(7, 3, 'BAR', 'Deine erste Bude gekauft!', 'SYSTEM')])).toEqual([
      { id: 7, day: 3, label: 'Erste Bude gekauft', detail: 'Deine erste Bude gekauft!' },
    ]);
  });

  it('behaelt die Reihenfolge und zeigt nur die letzten Etappen', () => {
    const events = Array.from({ length: 8 }, (_, index) =>
      event(index, index + 1, `Duell gegen Gegner ${index}`,
        index % 2 === 0 ? 'Gewonnen: Sieg.' : 'Verloren: 2,00 VC verloren.'));
    expect(playerHistoryOf(events, 3).map((entry) => entry.id)).toEqual([5, 6, 7]);
    expect(playerHistoryOf(events)).toHaveLength(6);
  });

  it('wertet einen Eintrag ohne Ergebnis nicht als Kampf', () => {
    expect(playerHistoryOf([event(1, 1, 'Duell gegen Rocco', 'Abgebrochen.')])).toEqual([]);
  });
});
