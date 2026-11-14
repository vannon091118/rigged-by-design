/** Smartphone-App: Vitter — Stadtfeed aus Erinnerungen und Geruechten. */
import type { GameView } from '../store/types';

function percent(value: number): string {
  return `${Math.round(value * 100)} %`;
}

export function SmartphoneVitter({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const posts = view.vitter;
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Vitter</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <p className="hint">
        Vitter zeigt, was ein Bewohner selbst erlebt hat oder gehoert hat — mit Quelle und Sicherheit.
        Ein Gerücht ist keine bestätigte Tatsache.
      </p>
      <div className="smartphone-list">
        {posts.length === 0 && <p className="hint">Niemand redet. Auch das ist eine Nachricht.</p>}
        {posts.map((post) => (
          <div key={post.id} className={`smartphone-post ${post.source === 'GERUECHT' ? 'is-rumor' : 'is-memory'}`}>
            <div className="smartphone-post-head">
              <strong>{post.author}</strong>
              <span className="post-source">{post.source === 'GERUECHT' ? 'Gerücht' : 'Selbst erlebt'}</span>
            </div>
            <p>
              {post.author} über {post.about} · Sicherheit {percent(post.confidence)} · {post.sentiment >= 0 ? 'wohlwollend' : 'angespannt'}
            </p>
          </div>
        ))}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
