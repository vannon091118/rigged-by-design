/** Slot-Telemetrie: Historie, Abweichung, Druck und letzte Symbole ohne Beschönigung. */
import { createSlotMemory, slotDrift, type SlotMemory } from '../core/games/slot-transparency';

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

export function SlotTelemetry({ memory }: { memory?: SlotMemory }) {
  const state = memory ?? createSlotMemory();
  const drift = slotDrift(state);
  const symbols = Object.entries(state.recentSymbolHistogram)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  return (
    <section className="slot-telemetry" aria-label="Slot-Telemetrie">
      <div className="slot-telemetry-head">
        <span className="eyebrow">EHRLICHE TELEMETRIE</span>
        <strong title="Jeder Spin ohne Jackpot lädt den Drucklader. Bei Stufe 7 ist der nächste Spin ein garantierter Treffer.">
          Drucklader Stufe {state.pressureLevel}/7
        </strong>
        <div className={`slot-pressure level-${state.pressureLevel}`} role="meter" aria-label="Drucklader" aria-valuenow={state.pressureLevel} aria-valuemin={0} aria-valuemax={7}>
          <i style={{ width: `${Math.min(100, state.pressureLevel / 7 * 100)}%` }} />
        </div>
      </div>
      <div className="slot-telemetry-stats">
        <div title="Spins seit Tagesbeginn an diesem Automaten."><span>SPINS HEUTE</span><b>{state.spinsToday}</b></div>
        <div title="Spins ohne Jackpot in Folge."><span>SEIT JACKPOT</span><b>{state.spinsSinceLastJackpot}</b></div>
        <div title="Üblicher Abstand zwischen zwei Jackpots in Spins."><span>ÜBLICHER ABSTAND</span><b>{state.averageJackpotInterval}</b></div>
        <div className={drift > 0 ? 'warn' : ''} title="Spins seit dem letzten Jackpot minus üblicher Abstand. Positiv heißt: der Jackpot ist überfällig – keine Garantie."><span>ABWEICHUNG</span><b>{signed(drift)}</b></div>
      </div>
      <div className="slot-telemetry-foot">
        <span>LETZTE 100 SPINS</span>
        {symbols.map(([symbol, count]) => <b key={symbol}>{symbol} {count}</b>)}
        {state.chargeReady && <em className="charged" title="Der nächste Spin gewinnt garantiert.">ENTLADUNG BEREIT</em>}
      </div>
    </section>
  );
}
