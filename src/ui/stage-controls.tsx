/** Buehnenrand: nur die Kamera-Knoepfe. Tastenkuerzel stehen in der Werkstatt. */
interface StageControlsProps {
  readonly zoom: (factor: number) => void;
  readonly overview: () => void;
}

export function StageControls({ zoom, overview }: StageControlsProps) {
  return (
    <div className="stage-zoom" role="group" aria-label="Kamera">
      <button type="button" className="zoom-btn" onClick={() => zoom(0.82)} title="Herauszoomen" aria-label="Herauszoomen">−</button>
      <button type="button" className="zoom-btn fit" onClick={overview} title="Ganzes Haus zeigen (0)" aria-label="Übersicht">FIT</button>
      <button type="button" className="zoom-btn" onClick={() => zoom(1.22)} title="Hineinzoomen" aria-label="Hineinzoomen">+</button>
    </div>
  );
}
