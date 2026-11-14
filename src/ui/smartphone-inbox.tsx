/** Smartphone-App: Inbox — Nachrichten aus dem echten Ereignisarchiv. */
import type { GameView } from '../store/types';

export function SmartphoneInbox({ view, onBack, onClose }: { view: GameView; onBack: () => void; onClose: () => void }) {
  const messages = view.inbox;
  return (
    <div className="smartphone smartphone-app">
      <div className="smartphone-header">
        <button type="button" className="btn back" onClick={onBack}>← Zurück</button>
        <h3>Nachrichten</h3>
        <button type="button" className="btn close" onClick={onClose}>Schließen</button>
      </div>
      <p className="hint">
        Jede Nachricht ist ein Ereignis aus dem Archiv. Es gibt keinen zweiten Posteingang.
      </p>
      <div className="smartphone-list">
        {messages.length === 0 && <p className="hint">Noch nichts passiert. Der Abend ist jung.</p>}
        {messages.map((message) => (
          <div key={message.id} className="smartphone-message">
            <div className="smartphone-message-head">
              <span className="message-source">{message.source}</span>
              <span className="message-from">{message.from}</span>
              <span className="message-day">Tag {message.day}</span>
            </div>
            <strong>{message.subject}</strong>
            <p>{message.body}</p>
          </div>
        ))}
      </div>
      <div className="smartphone-footer"><button type="button" className="btn secondary" onClick={onClose}>Schließen</button></div>
    </div>
  );
}
