/** Mod-Katalog am Automaten: Gaestewirkung und Wirkung auf die echte Engine. */
import type { VaCoinMicro } from '../core/economy/vacoin';
import { MOD_ENGINE_NOTE } from '../core/games/mod-profile';
import { ITEM_RARITY, RARITY_LABEL, activeSynergies } from '../core/sim/item-synergy';
import { MODS, getMod, modAppliesTo } from '../core/sim/offers';
import type { Furniture, ModId } from '../core/sim/types';
import { vc } from './format';

interface Props {
  readonly item: Furniture;
  readonly house: VaCoinMicro;
  readonly onMod: (id: ModId) => void;
}

/** Ausgelagert aus `machine-operator`, damit die Hot Zone nicht weiter waechst. */
export function MachineMods({ item, house, onMod }: Props) {
  const synergies = activeSynergies(item.mods);
  return (
    <>
      <h3>Mods</h3>
      <p className="hint">
        Mods ziehen Gäste an und verändern Laune, Geduld oder Sucht – gegen Betriebskosten. Drei passen auf ein Gerät.
        Werte wie <b>+260 Anziehung</b> sind Rohwerte: mehr ist besser.
      </p>
      <div className="mod-grid">
        {MODS.filter((mod) => modAppliesTo(mod.id, item.gameId)).map((mod) => {
          const installed = item.mods.includes(mod.id);
          const blocked = installed || item.mods.length >= 3 || house < mod.cost;
          return (
            <button key={mod.id} type="button" className={`mod-card${installed ? ' installed' : ''}`}
              disabled={blocked} onClick={() => onMod(mod.id)}>
              <strong>{mod.name}</strong>
              <span>{mod.description}</span>
              <b>{installed ? 'VERBAUT' : vc(mod.cost, 0)}</b>
              <small>
                +{mod.attraction} Anziehung · {mod.patience >= 0 ? '+' : ''}{mod.patience} Geduld · +{mod.addiction} Sucht
                {mod.bonusBps > 0 ? ` · +${(mod.bonusBps / 100).toFixed(1)} % Auszahlung` : ''}
                {MOD_ENGINE_NOTE[mod.id] ? ` · Engine: ${MOD_ENGINE_NOTE[mod.id]}` : ''}
                {' · '}{RARITY_LABEL[ITEM_RARITY[mod.id]]}
              </small>
            </button>
          );
        })}
      </div>
      {synergies.map((synergy) => (
        <p key={synergy.id} className="hint">
          <b>Synergie {synergy.name}</b>: {synergy.advantage} – aber {synergy.drawback}. Beide Items wirken nur zusammen.
        </p>
      ))}
      <p className="hint">Verbaute Mods: {item.mods.length ? item.mods.map((id) => getMod(id).name).join(' · ') : 'keine'}</p>
    </>
  );
}
