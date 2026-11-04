/** NAR-14: Besucherprofil aus dem Snapshot; Rechnungen bleiben im Core. */
import type { NarrativeProfileView, NarrativeView } from '../core/sim/narrative/view-types';

const VALENCE_LABEL: Record<string, string> = { GOOD: 'gut', NEUTRAL: 'neutral', BAD: 'schlecht' };
const ACTOR_LABEL: Record<string, string> = { player: 'du', '': 'unbekannt' };

function actorName(ref: string, narrative: NarrativeView): string {
  if (ACTOR_LABEL[ref]) return ACTOR_LABEL[ref]!;
  const visitorId = /^visitor:(\d+)$/.exec(ref);
  if (visitorId) {
    const id = Number(visitorId[1]);
    return narrative.profiles.find((profile) => profile.visitorId === id)?.name ?? `Besucher #${id}`;
  }
  if (ref.startsWith('staff:')) return 'Personal';
  if (ref.startsWith('rival:')) return `Rivale ${ref.slice('rival:'.length)}`;
  return ref;
}

interface Props {
  readonly narrative: NarrativeView;
  readonly visitorId: number | null;
  readonly onSelect: (visitorId: number) => void;
}

export function NarrativeProfile({ narrative, visitorId, onSelect }: Props) {
  const profile: NarrativeProfileView | null =
    narrative.profiles.find((entry) => entry.visitorId === visitorId)
      ?? (visitorId === null ? narrative.profiles[0] ?? null : null);
  if (!profile) {
    return (
      <p className="empty">
        {visitorId === null
          ? 'Noch keine Profile. Bekannte Figuren entstehen beim neuen Spiel und bei jedem Besuch.'
          : 'Zu dieser Figur liegt noch kein Profil vor.'}
      </p>
    );
  }
  return (
    <>
      <div className="profile-picker">
        {narrative.profiles.map((entry) => (
          <button
            key={entry.visitorId}
            type="button"
            className={`journal-tab${entry.visitorId === profile.visitorId ? ' active' : ''}`}
            aria-pressed={entry.visitorId === profile.visitorId}
            onClick={() => onSelect(entry.visitorId)}
          >
            {entry.name}
          </button>
        ))}
      </div>
      <article className="profile-card" aria-label={`Profil ${profile.name}`}>
        <header className="profile-head">
          <strong>{profile.name}</strong>
          <span className={`persona persona-${profile.persona}`}>{profile.persona}</span>
          <small>{profile.visits} Besuch{profile.visits === 1 ? '' : 'e'} · {profile.memories.length} Erinnerung{profile.memories.length === 1 ? '' : 'en'}</small>
        </header>
        {profile.stories.length > 0 ? (
          <p className="profile-stories">
            <span className="journal-label">Laufende Geschichten</span> {profile.stories.join(' · ')}
          </p>
        ) : (
          <p className="hint">Keine offene Geschichte mit dieser Figur.</p>
        )}
        <h3>Erinnerungen</h3>
        {profile.memories.length === 0 ? (
          <p className="hint">Noch keine Erinnerung – Erlebnisse entstehen am Besuchsende.</p>
        ) : (
          <ul className="profile-memories">
            {profile.memories.map((memory) => (
              <li key={memory.factId} className={`memory memory-${memory.valence.toLowerCase()}`}>
                <b>{VALENCE_LABEL[memory.valence] ?? memory.valence}</b>
                <span>Takt {memory.tick}</span>
                <small>Gewicht {Math.round(memory.score)}</small>
              </li>
            ))}
          </ul>
        )}
        <h3>Beziehungen</h3>
        {profile.relationships.length === 0 ? (
          <p className="hint">Noch keine gerichtete Beziehung zu dieser Figur.</p>
        ) : (
          <ul className="profile-relations">
            {profile.relationships.map((edge) => (
              <li key={`${edge.to}-${edge.updatedTick}`}>
                <b>{actorName(edge.to, narrative)}</b>
                <span>Vertrauen {edge.trust} · Sympathie {edge.sympathy}</span>
                <span>Konflikt {edge.conflict} · Einfluss {edge.influence}</span>
              </li>
            ))}
          </ul>
        )}
      </article>
    </>
  );
}
