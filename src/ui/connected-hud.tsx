/** HUD-Verdrahtung: Perspektivwechsel, Skills und Welt-Einstieg an einer Stelle. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Perspective, Popup } from './app-model';
import { useBrandTaps } from './dock';
import { Hud } from './hud';

interface Props {
  readonly view: GameView;
  readonly perspective: Perspective;
  readonly onPerspective: (next: Perspective) => void;
  readonly onOpen: (popup: Popup) => void;
}

export function ConnectedHud({ view, perspective, onPerspective, onOpen }: Props) {
  const onBrandTap = useBrandTaps(() => onOpen({ kind: 'workshop' }));
  return (
    <Hud
      view={view}
      perspective={perspective}
      onPerspective={onPerspective}
      onSkill={(attribute) => worldStore.spendSkill(attribute)}
      onBrandTap={onBrandTap}
      onGuests={() => onOpen({ kind: 'guests', guestId: null })}
    />
  );
}
