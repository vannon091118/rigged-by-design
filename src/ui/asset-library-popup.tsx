/** Asset-Bibliothek: alles, was im Paket liegt, ist im Spiel sichtbar und anhoerbar. */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import manifest from '../render/assets/manifest.json';
import { PopupShell } from './popup-shell';

const BASE = manifest.base;

const IMAGE_GROUPS: readonly { readonly key: 'symbols' | 'machines' | 'decor' | 'plinko' | 'ui' | 'characters' | 'environment'; readonly label: string }[] = [
  { key: 'symbols', label: 'Symbole' },
  { key: 'machines', label: 'Maschinen & Tische' },
  { key: 'decor', label: 'Deko' },
  { key: 'plinko', label: 'Plinko' },
  { key: 'ui', label: 'UI & Rollen' },
  { key: 'characters', label: 'Figuren' },
  { key: 'environment', label: 'Raum' },
];

const MUSIC_LABEL: Readonly<Record<string, string>> = {
  floor: 'Floor (Tag)',
  night: 'Fremdes Haus (Nacht)',
  menu: 'Menü & Hilfe',
  background: 'Protokoll & Prüfung',
  games: 'Spiele',
  slot: 'Slot',
};

const nameOf = (path: string): string => path.split('/').pop()?.replace(/\.(png|ogg)$/i, '') ?? path;

function AnimationPreview({ id, frames: framePaths, fps, loop }: {
  readonly id: string;
  readonly frames: readonly string[];
  readonly fps: number;
  readonly loop: boolean;
}) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    if (framePaths.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setFrame((current) => (current + 1) % framePaths.length);
    }, Math.max(35, 1000 / Math.max(1, fps)));
    return () => window.clearInterval(timer);
  }, [fps, framePaths.length]);
  const source = framePaths[frame] ?? framePaths[0];
  return (
    <figure className="asset-animation">
      {source && <img src={`${BASE}${source}`} alt={`${id} Frame ${frame + 1}`} width="96" height="96" />}
      <figcaption>
        <strong>{id}</strong>
        <span>{framePaths.length} Frames · {fps} fps · {loop ? 'Schleife' : 'einmalig'}</span>
      </figcaption>
    </figure>
  );
}

function EmitterPreview({ id, textures, count, lifetimeMs, source }: {
  readonly id: string;
  readonly textures: readonly string[];
  readonly count: number;
  readonly lifetimeMs: readonly number[];
  readonly source: string;
}) {
  const particles = useMemo(() => Array.from({ length: Math.min(18, count) }, (_, index) => {
    const angle = index * 2.39996;
    const distance = 38 + (index % 5) * 8;
    return {
      texture: textures[index % textures.length] ?? textures[0],
      dx: Math.cos(angle) * distance,
      dy: Math.sin(angle) * distance - 16,
      delay: index * 42,
    };
  }), [count, textures]);
  return (
    <figure className="asset-emitter">
      <div className="asset-emitter-stage" aria-hidden="true">
        {particles.map((particle, index) => particle.texture && (
          <img
            key={`${id}-${index}`}
            src={`${BASE}${particle.texture}`}
            alt=""
            width="22"
            height="22"
            style={{
              '--dx': `${particle.dx}px`,
              '--dy': `${particle.dy}px`,
              animationDelay: `${particle.delay}ms`,
            } as CSSProperties}
          />
        ))}
      </div>
      <figcaption>
        <strong>{id}</strong>
        <span>{count} Partikel · {lifetimeMs.join('–')} ms · {nameOf(source)}</span>
      </figcaption>
    </figure>
  );
}

export function AssetLibraryPopup({ onClose }: { readonly onClose: () => void }) {
  const fxGroups = useMemo(() => {
    const groups = new Map<string, [string, string][]>();
    for (const entry of Object.entries(manifest.fx)) {
      const group = entry[0].split('/')[1] ?? 'sonstiges';
      const list = groups.get(group) ?? [];
      list.push(entry);
      groups.set(group, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, []);
  const imageCount = IMAGE_GROUPS.reduce((sum, group) => sum + Object.keys(manifest[group.key]).length, 0)
    + Object.keys(manifest.fx).length;

  return (
    <PopupShell eyebrow="PAKET · 539 TEXTUREN" title="Asset-Bibliothek" onClose={onClose} full>
      <p className="hint">
        {imageCount} Bilder, {Object.keys(manifest.animations).length} Frame-Animationen,
        {' '}{Object.keys(manifest.emitters).length} Emitter und {Object.keys(manifest.music).length} Tonspuren.
        Die Bodentexturen der markierten Kategorien werden auch im Spiel verwendet; hier ist der vollständige Bestand prüfbar.
      </p>

      {IMAGE_GROUPS.map((group) => {
        const entries = Object.entries(manifest[group.key]) as [string, string][];
        return (
          <section key={group.key} className="asset-section">
            <h3>{group.label} <small>{entries.length}</small></h3>
            <div className="asset-grid">
              {entries.map(([id, path]) => (
                <figure key={`${group.key}-${id}`} className="asset-tile" title={path}>
                  <img src={`${BASE}${path}`} alt={nameOf(path)} loading="lazy" width="64" height="64" />
                  <figcaption>{nameOf(path)}</figcaption>
                </figure>
              ))}
            </div>
          </section>
        );
      })}

      <section className="asset-section">
        <h3>FX <small>{Object.keys(manifest.fx).length}</small></h3>
        {fxGroups.map(([group, entries]) => (
          <details key={group} className="asset-details">
            <summary>{group} <small>{entries.length}</small></summary>
            <div className="asset-grid">
              {entries.map(([id, path]) => (
                <figure key={`fx-${id}`} className="asset-tile" title={path}>
                  <img src={`${BASE}${path}`} alt={nameOf(path)} loading="lazy" width="56" height="56" />
                  <figcaption>{nameOf(path)}</figcaption>
                </figure>
              ))}
            </div>
          </details>
        ))}
      </section>

      <section className="asset-section">
        <h3>Animationen <small>{Object.keys(manifest.animations).length}</small></h3>
        <div className="asset-preview-grid">
          {Object.entries(manifest.animations).map(([id, animation]) => (
            <AnimationPreview key={id} id={id} frames={animation.frames} fps={animation.fps} loop={animation.loop} />
          ))}
        </div>
      </section>

      <section className="asset-section">
        <h3>Emitter <small>{Object.keys(manifest.emitters).length}</small></h3>
        <div className="asset-preview-grid">
          {Object.entries(manifest.emitters).map(([id, emitter]) => (
            <EmitterPreview
              key={id}
              id={id}
              textures={emitter.textures}
              count={emitter.count}
              lifetimeMs={emitter.lifetimeMs}
              source={emitter.source}
            />
          ))}
        </div>
      </section>

      <section className="asset-section">
        <h3>Musik & Atmosphäre <small>{Object.keys(manifest.music).length}</small></h3>
        <div className="asset-audio-list">
          {Object.entries(manifest.music).map(([id, path]) => (
            <label key={id} className="asset-audio">
              <span>{MUSIC_LABEL[id] ?? id}</span>
              <audio controls preload="none" src={`${BASE}${path}`} />
            </label>
          ))}
        </div>
      </section>
    </PopupShell>
  );
}
