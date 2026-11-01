/**
 * Balance-Spur: macht den 40-Tage-Messlauf nachvollziehbar und pruefbar.
 * Reine Auswertung der Tageszeilen; schreibt auf Wunsch einen Bericht.
 */
import type { DayRow } from './balance-metrics';

interface BalanceViolation {
  readonly day: number;
  readonly field: string;
  readonly detail: string;
}

const PHASES = ['BUDE', 'KASSE', 'SAAL', 'KONZERN'] as const;

const f = (value: number, digits = 1): string => (Number.isFinite(value) ? value.toFixed(digits) : '-');

/**
 * Strukturelle Invarianten statt erfundener Wirtschaftsziele: der Lauf muss vollstaendig,
 * endlich und in sich stimmig sein. Alles, was hier auffaellt, ist ein echter Messfehler.
 */
export function balanceViolations(rows: readonly DayRow[], days: number): readonly BalanceViolation[] {
  const found: BalanceViolation[] = [];
  if (rows.length !== days) {
    found.push({ day: 0, field: 'tage', detail: `${rows.length} statt ${days} Spieltage gemessen` });
  }
  for (const row of rows) {
    const numbers: readonly [string, number][] = [
      ['ankuenfte', row.arrivals], ['aktiv', row.active], ['waende', row.waitDesk],
      ['geraete', row.waitDevice], ['runden', row.rounds], ['kapital', row.capital],
      ['umsatz', row.economy.stakeVolume], ['loehne', row.economy.wages], ['miete', row.economy.rent],
    ];
    for (const [field, value] of numbers) {
      if (!Number.isFinite(value)) found.push({ day: row.day, field, detail: 'nicht endlich' });
    }
    if (row.arrivals < 0 || row.rounds < 0) {
      found.push({ day: row.day, field: 'vorzeichen', detail: 'negative Gaeste oder Runden' });
    }
    if (row.economy.stakeVolume < 0 || row.economy.wages < 0 || row.economy.rent < 0) {
      found.push({ day: row.day, field: 'ledger', detail: 'negativer Umsatz, Lohn oder Miete' });
    }
    // Die Abbruchgruende ueberlappen sich (wer wegen Wartezeit geht, hat auch nie gespielt),
    // deshalb wird jede Gruppe einzeln gegen die Ankuenfte geprueft, nicht ihre Summe.
    const groups: readonly [string, number][] = [
      ['abWarte', row.abWait], ['abChips', row.abBroke], ['abWut', row.abAngry], ['ohneSpiel', row.neverPlayed],
    ];
    for (const [field, value] of groups) {
      if (value < 0) {
        found.push({ day: row.day, field, detail: 'negativ gezaehlt' });
      }
    }
  }
  // Ueber den ganzen Lauf gilt: niemand geht, der nicht gekommen ist. Einzelne Tage
  // taugen nicht als Bezug, weil Gaeste ueber Nacht bleiben und erst spaeter gehen.
  // totalDepartures zaehlt jeden Abgang genau einmal (acc.departures.length), die
  // Kategorien abWait/abBroke/abAngry/neverPlayed duerfen sich ueberlappen.
  const departed = rows.reduce((sum, row) => sum + row.totalDepartures, 0);
  const arrived = rows.reduce((sum, row) => sum + row.arrivals, 0);
  if (departed > arrived) {
    found.push({ day: 0, field: 'abgaenge', detail: `${departed} Abgaenge bei ${arrived} Ankuenften im ganzen Lauf` });
  }
  return found;
}

/** Markdown-Bericht: Phasenmittel, Extremtage und die Rohzeilen — ohne Neuberechnung. */
export function balanceReport(rows: readonly DayRow[], seed: number): string {
  const head = '| Tag | Stufe | Gäste | aktiv | wKasse | wGerät | Runden | Abbrüche | Betrieb | Kapital |';
  const rule = '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |';
  const body = rows.map((row) => `| ${row.day} | ${row.tier} | ${f(row.arrivals)} | ${row.active} | `
    + `${f(row.waitDesk, 0)} | ${f(row.waitDevice, 0)} | ${f(row.rounds)} | `
    + `${row.totalDepartures} | `
    + `${f(row.economy.operatingProfit)} | ${row.capital} |`);
  const phases = PHASES.map((tier) => {
    const phase = rows.filter((row) => row.tier === tier);
    if (phase.length === 0) return `| ${tier} | 0 | - | - | - | - | - |`;
    const mean = (pick: (row: DayRow) => number): number => phase.reduce((sum, row) => sum + pick(row), 0) / phase.length;
    return `| ${tier} | ${phase.length} | ${f(mean((row) => row.perMin))} | ${f(mean((row) => row.rounds))} `
      + `| ${f(mean((row) => row.waitDesk), 0)} | ${f(mean((row) => row.economy.operatingProfit))} `
      + `| ${f(mean((row) => row.economy.rent))} |`;
  });
  return [
    `# Balance-Spur · Seed ${seed} · ${rows.length} Spieltage`,
    '',
    '## Phasen',
    '| Stufe | Tage | Gäste/min | Runden | wKasse | Betrieb/Tag | Miete/Tag |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...phases,
    '',
    '## Tage',
    head,
    rule,
    ...body,
    '',
  ].join('\n');
}
