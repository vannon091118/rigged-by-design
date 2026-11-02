/** Buehnenrand: Steuerungshilfe als Tastenkuerzel und die Kamera-Knoepfe an einem Ort. */
interface StageControlsProps {
  readonly zoom: (factor: number) => void;
  readonly overview: () => void;
}

/** Was ein Zeiger tut, in der Reihenfolge, in der man es braucht. */
const CUES: readonly (readonly [string, string])[] = [
  ['Klick', 'hinlaufen'],
  ['Rechts ziehen', 'schwenken'],
  ['Rad', 'zoomen'],
  ['WASD', 'laufen'],
  ['Enter', 'Kiste'],
  ['Gast', 'Fenster'],
];

export function StageControls({ zoom, overview }: StageControlsProps) {
  return (
    <>
      <div className="stage-legend">
        {CUES.map(([key, label]) => (
          <span key={key}><kbd>{key}</kbd>{label}</span>
        ))}
      </div>
      <div className="stage-zoom" role="group" aria-label="Kamera">
        <button type="button" className="zoom-btn" onClick={() => zoom(0.82)} title="Herauszoomen" aria-label="Herauszoomen">−</button>
        <button type="button" className="zoom-btn fit" onClick={overview} title="Ganzes Haus zeigen (0)" aria-label="Übersicht">FIT</button>
        <button type="button" className="zoom-btn" onClick={() => zoom(1.22)} title="Hineinzoomen" aria-label="Hineinzoomen">+</button>
      </div>
    </>
  );
}
