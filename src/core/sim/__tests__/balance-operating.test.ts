/**
 * @test-target: src/core/sim/tick.ts
 * @error-code: ERR-2001
 *
 * Betriebs-Messlauf (nur mit RBD_BALANCE=1): Ankuenfte, Warteschlangen, Wartezeiten,
 * Aufenthalt, Runden, Auslastung, Abbrueche, Rueckkehr, Laune/Ruf und die echten
 * Ledger-Kosten pro Spieltag. Standard: 40 Tage vom frischen Casino bis KONZERN.
 */
import { describe, expect, it } from 'vitest';
import { runBalance, type DayRow } from './balance-harness';

const DAYS = Number(process.env.RBD_DAYS ?? 40);
const SEED = Number(process.env.RBD_SEED ?? 12345);
const HEADER = 'day stufe tpl games nachfrage gaeste/min aktiv max aussen innen wTuer wKasse wGeraet aufenthalt runden auslastung abWarte abChips abWut ohneSpiel rueckkehr laune ruf umsatz hausgewinn service loehne miete betrieb kapital netto';

const f = (value: number, digits = 1): string => (Number.isFinite(value) ? value.toFixed(digits) : '-');
const utilization = (row: DayRow): string =>
  Object.entries(row.util).map(([id, value]) => `${id}${Math.round(value)}`).join(',') || '-';

function line(row: DayRow): string {
  const eco = row.economy;
  return [
    row.day, row.tier, row.template, row.games, Math.round(row.demand),
    f(row.arrivals), f(row.perMin), f(row.active), row.activeMax,
    f(row.outside), f(row.inside), f(row.waitDoor, 0), f(row.waitDesk, 0), f(row.waitDevice, 0),
    f(row.staySec, 0), f(row.rounds), utilization(row),
    row.abWait, row.abBroke, row.abAngry, row.neverPlayed, f(row.returnRate, 0),
    f(row.satisfaction, 0), f(row.reputation, 0),
    eco.stakeVolume, eco.retainedGamingWin, eco.serviceRevenue, eco.wages, eco.rent,
    eco.operatingRepairs + eco.goods, row.capital, eco.operatingProfit,
  ].join(' ');
}

describe('Betriebs-Messlauf', () => {
  it.skipIf(!process.env.RBD_BALANCE)('misst den Betrieb vom frischen Casino bis KONZERN', { timeout: 900_000 }, () => {
    const { rows } = runBalance(DAYS, SEED);
    expect(rows).toHaveLength(DAYS);
    console.log(`seed=${SEED}\n${HEADER}`);
    for (const row of rows) console.log(line(row));
    console.log('phasen: stufe tage gaeste/min aktiv maxWartende wKasse wGeraet runden abbWarte chipsLeer netto/tag miete/tag loehne/tag');
    for (const tier of ['BUDE', 'KASSE', 'SAAL', 'KONZERN']) {
      const phase = rows.filter((row) => row.tier === tier);
      if (phase.length === 0) { console.log(`${tier} 0`); continue; }
      const mean = (pick: (row: DayRow) => number): number => phase.reduce((sum, row) => sum + pick(row), 0) / phase.length;
      console.log([
        tier, phase.length, f(mean((row) => row.perMin)), f(mean((row) => row.active)),
        Math.max(...phase.map((row) => row.activeMax)), f(mean((row) => row.waitDesk), 0),
        f(mean((row) => row.waitDevice), 0), f(mean((row) => row.rounds)),
        phase.reduce((sum, row) => sum + row.abWait + row.abAngry, 0),
        phase.reduce((sum, row) => sum + row.abBroke, 0),
        f(mean((row) => row.economy.operatingProfit)), f(mean((row) => row.economy.rent)),
        f(mean((row) => row.economy.wages)),
      ].join(' '));
    }
  });
});
