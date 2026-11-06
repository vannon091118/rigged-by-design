/** Der eine Umschalter zwischen Spieler- und Betreiberblick. */
import type { Perspective } from './app-model';

interface Props {
  readonly perspective: Perspective;
  readonly onChange: (next: Perspective) => void;
}

const OPTIONS: readonly { readonly id: Perspective; readonly label: string; readonly hint: string }[] = [
  { id: 'guest', label: 'GAST', hint: 'Portemonnaie, Einsätze, Regeln und eigene Spiele' },
  { id: 'operator', label: 'BETRIEB', hint: 'Hauskonto, Gäste, Personal, Geräte und Wartung' },
];

export function PerspectiveSwitch({ perspective, onChange }: Props) {
  return (
    <div className="perspective-switch">
      <span>ANSICHT</span>
      <div role="group" aria-label="Perspektive">
        {OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={perspective === option.id}
            title={option.hint}
            onClick={() => onChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
