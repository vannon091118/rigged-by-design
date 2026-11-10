/** Arbeitsqualitaet im Charakterfenster: welche Rolle welches Attribut traegt. */
import type { FloorWorkView } from '../core/sim/floor-work';

interface Props {
  readonly work: FloorWorkView;
}

export function CareerFloor({ work }: Props) {
  return (
    <section className="career-floor" aria-label="Arbeitsqualitaet">
      <div className="career-head">
        <strong>ARBEIT AUF DEM FLOOR</strong>
        <span>{work.rows.length} Rollen</span>
      </div>
      <div className="career-grid" aria-label="Floor-Rollen">
        {work.rows.map((row) => (
          <div key={row.role}>
            <span>{row.label}</span>
            <b>{row.quality} %</b>
            <small>{row.attributeLabel} {row.level} · {row.effect}</small>
          </div>
        ))}
      </div>
      <p className="hint">{work.note}</p>
    </section>
  );
}
