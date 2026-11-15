/** DOM-Ortsziele der Stadt: dieselben Tuereffekte wie der Pixi-Tap, nur fokussierbar. */
import type { MenuAction } from '../render/floor-actions';
import { doorTap, type FloorTap } from '../render/floor-input';
import type { GameView } from '../store/types';
import type { Perspective, Popup } from './app-model';

interface CityDoorAccessEntry {
  readonly id: string;
  readonly label: string;
  readonly enabled: boolean;
  readonly reason?: string;
}

/**
 * Leitet die Eintraege aus demselben `doorTap` ab, den der sichtbare Klick
 * nutzt. Tueren ohne Aktion (Rohbau) sind keine erreichbaren Ortsziele und
 * bleiben draussen; gesperrte Ziele bleiben dagegen fokussierbar.
 */
export function cityDoorAccessEntries(view: GameView): readonly CityDoorAccessEntry[] {
  if (view.scene.kind !== 'CITY') return [];
  const entries: CityDoorAccessEntry[] = [];
  for (const edge of view.layout.edges) {
    if (edge.kind !== 'DOOR' || edge.id === null) continue;
    const tap = doorTap(view, edge.id);
    const action: MenuAction | undefined = tap?.actions[0];
    if (!action) continue;
    entries.push({
      id: edge.id,
      label: action.label,
      enabled: action.enabled,
      ...(action.reason ? { reason: action.reason } : {}),
    });
  }
  return entries;
}

interface CityDoorAccessProps {
  readonly view: GameView;
  readonly onActivate: (doorId: string) => void;
}

/**
 * Eine semantische Liste statt eines zweiten Trefferpfads. Der Button ruft
 * denselben Callback wie der Pixi-Tap; Enter/Space werden explizit behandelt,
 * damit Tastatur und Screenreader nicht auf eine Browser-Sonderregel warten.
 */
export function CityDoorAccess({ view, onActivate }: CityDoorAccessProps) {
  const entries = cityDoorAccessEntries(view);
  if (entries.length === 0) return null;

  return (
    <nav className="city-door-access" aria-label="Türen und Ortsziele">
      <span className="city-door-access-title">Ortsziele</span>
      <ul className="city-door-access-list">
        {entries.map((entry) => {
          const reasonId = `city-door-reason-${entry.id}`;
          const activate = (event: { readonly key: string; readonly preventDefault: () => void }): void => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            event.preventDefault();
            onActivate(entry.id);
          };
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-label={entry.label}
                aria-disabled={!entry.enabled}
                aria-describedby={entry.reason ? reasonId : undefined}
                onClick={() => onActivate(entry.id)}
                onKeyDown={activate}
              >
                <b>{entry.label}</b>
                {entry.reason && <small id={reasonId}>{entry.reason}</small>}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

interface CityDoorAccessLayerProps {
  readonly view: GameView;
  readonly interaction: { readonly tap: (tap: FloorTap) => void };
  readonly perspective: Perspective;
  readonly popup: Popup;
  readonly buildOpen: boolean;
  readonly editorOpen: boolean;
}

/**
 * Die Sichtbarkeitsregel der DOM-Ortsziele bleibt an einem Ort: nur Stadt,
 * nur Operator, nur ohne offenes Fenster. `App` ruft damit ein Overlay auf,
 * statt Buehnenbedingungen in der Einstiegsdatei zu duplizieren.
 */
export function CityDoorAccessLayer({ view, interaction, perspective, popup, buildOpen, editorOpen }: CityDoorAccessLayerProps) {
  if (view.scene.kind !== 'CITY' || perspective !== 'operator' || popup !== null || buildOpen || editorOpen) return null;
  return (
    <CityDoorAccess
      view={view}
      onActivate={(doorId) => {
        const tap = doorTap(view, doorId);
        if (tap) interaction.tap(tap);
      }}
    />
  );
}
