/** Bausteine der Werkstatt: Rasterkarte, Steuerung und ein ehrlicher Live-FPS-Wert. */
import { useEffect, useState } from 'react';

interface WorkshopTileProps {
  readonly index: string;
  readonly label: string;
  readonly note: string;
  readonly meta: string;
  readonly onOpen: () => void;
}

export function WorkshopTile({ index, label, note, meta, onOpen }: WorkshopTileProps) {
  return (
    <button type="button" className="workshop-tile" onClick={onOpen}>
      <span className="workshop-index">{index}</span>
      <strong>{label}</strong>
      <small>{note}</small>
      <em className="workshop-meta">{meta}</em>
    </button>
  );
}

export function WorkshopBack({ onBack }: { readonly onBack: () => void }) {
  return (
    <button type="button" className="btn tiny ghost workshop-back" onClick={onBack}>
      ‹ ZURÜCK ZUM RASTER
    </button>
  );
}

/** Ein Sekundenfenster aus echten Browser-Frames; keine Weltuhr, keine zweite Simulation. */
export function useFps(): number {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    if (typeof requestAnimationFrame !== 'function') return undefined;
    let frames = 0;
    let started = 0;
    let raf = 0;
    const tick = (now: number): void => {
      if (started === 0) started = now;
      frames += 1;
      const elapsed = now - started;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        started = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return fps;
}

export function FpsPanel({ fps }: { readonly fps: number }) {
  const tone = fps >= 55 ? 'ok' : fps >= 30 ? 'warn' : 'bad';
  return (
    <section className="fps-panel" aria-label="Bildrate">
      <div className={`fps-value ${tone}`}>
        <strong>{fps > 0 ? fps : '—'}</strong>
        <span>FPS</span>
      </div>
      <div className="fps-track" aria-hidden="true">
        <i style={{ width: `${Math.min(100, (fps / 60) * 100)}%` }} />
      </div>
      <dl className="fps-facts">
        <div><dt>Ziel</dt><dd>60 fps</dd></div>
        <div><dt>Frame</dt><dd>{fps > 0 ? `${(1000 / fps).toFixed(1)} ms` : '—'}</dd></div>
        <div><dt>Fenster</dt><dd>0,5 s</dd></div>
      </dl>
      <p className="hint">
        Gemessen wird der Browser-Frame-Takt in diesem Fenster. Der Wert zeigt, ob die Oberfläche
        flüssig läuft; er ist kein Benchmark der Simulation.
      </p>
    </section>
  );
}

const CONTROLS: readonly (readonly [string, string])[] = [
  ['Klick / Tipp', 'auf freie Fläche: in Casino, Wohnung und Stadt hinlaufen; im fremden Casino nur Menü'],
  ['Klick / Tipp', 'auf Gast, Möbel oder Kiste: Aktionen nur im eigenen Casino, dort läuft die Figur hin'],
  ['E', 'Ziel in Reichweite wählen oder Hauptaktion ausführen'],
  ['Pfeile / WASD', 'in Casino, Wohnung und Stadt laufen; im fremden Casino gesperrt'],
  ['Mausrad', 'auf eigenem Floor, in Wohnung und Stadt zoomen; im fremden Casino gesperrt'],
  ['Rechte Maus', 'ziehen: schwenken; im fremden Casino gesperrt'],
  ['+ / − / 0', 'zoomen, Übersicht; im fremden Casino gesperrt'],
  ['Enter', 'getragene Kiste im eigenen Casino nutzen'],
  ['Esc', 'Auswahl abbrechen, Fenster schließen'],
];

export function ControlsPanel() {
  return (
    <section className="workshop-controls">
      <p className="hint">
        Die Steuerung gilt auf dem Floor. Die Werkstatt selbst öffnet nur über die Marke oder
        Strg+Shift+D; sie hat keinen sichtbaren Knopf.
      </p>
      <ul className="help-controls">
        {CONTROLS.map(([key, text]) => (
          <li key={key}><kbd>{key}</kbd>: {text}</li>
        ))}
      </ul>
    </section>
  );
}
