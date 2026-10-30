/** Slot-Telemetrie: Historie, Drift, Druck und letzte Symbole ohne Beschönigung. */
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
        <strong>Drucklader Stufe {state.pressureLevel}/7</strong>
        <div className={`slot-pressure level-${state.pressureLevel}`} role="meter" aria-label="Drucklader" aria-valuenow={state.pressureLevel} aria-valuemin={0} aria-valuemax={7}>
          <i style={{ width: `${Math.min(100, state.pressureLevel / 7 * 100)}%` }} />
        </div>
      </div>
      <div className="slot-telemetry-stats">
        <div><span>SPINS HEUTE</span><b>{state.spinsToday}</b></div>
        <div><span>SEIT JACKPOT</span><b>{state.spinsSinceLastJackpot}</b></div>
        <div><span>ERWARTUNG</span><b>{state.averageJackpotInterval}</b></div>
        <div className={drift > 0 ? 'warn' : ''}><span>DRIFT</span><b>{signed(drift)}</b></div>
      </div>
      <div className="slot-telemetry-foot">
        <span>LETZTE 100 SPINS</span>
        {symbols.map(([symbol, count]) => <b key={symbol}>{symbol} {count}</b>)}
        {state.freeSpins > 0 && <em>GRATIS-SPIN BEREIT</em>}
        {state.chargeReady && <em className="charged">ENTLADUNG BEREIT</em>}
      </div>
    </section>
  );
}
