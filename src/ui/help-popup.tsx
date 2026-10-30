/** Hilfe: Geldfluss, Gäste, Objekte und Steuerung in Klartext, erreichbar über das ? im HUD. */
import { HELP } from './glossary';
import { PopupShell } from './popup-shell';

const MONEY_POTS: readonly { name: string; text: string }[] = [
  { name: 'Hauskonto', text: HELP.hauskonto },
  { name: 'Portemonnaie', text: HELP.portemonnaie },
  { name: 'Wechselkasse', text: HELP.kasse },
  { name: 'Offene Gewinne', text: HELP.offen },
];

const GUEST_STATS: readonly { name: string; text: string }[] = [
  { name: 'Laune', text: HELP.laune },
  { name: 'Geduld', text: HELP.geduld },
  { name: 'Sucht', text: HELP.sucht },
];

export function HelpPopup({ onClose }: { readonly onClose: () => void }) {
  return (
    <PopupShell eyebrow="KURZ ERKLÄRT" title="So funktioniert dein Casino" onClose={onClose} wide>
      <div className="help-grid">
        <section className="help-card">
          <h3>Deine Rolle</h3>
          <p>
            Du bist die Bank. Gäste wechseln Bargeld in Chips, spielen und verlieren im Schnitt.
            Deine Aufgabe: Angebot bauen, Gäste halten, Gewinne auszahlen – und dabei zahlungsfähig bleiben.
            Der Hausvorteil ist dein Einkommen, kein Unfall.
          </p>
        </section>

        <section className="help-card">
          <h3>Die vier Geldtöpfe</h3>
          <dl className="help-list">
            {MONEY_POTS.map((pot) => (
              <div key={pot.name}>
                <dt>{pot.name}</dt>
                <dd>{pot.text}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="help-card">
          <h3>Was Gäste fühlen</h3>
          <dl className="help-list">
            {GUEST_STATS.map((stat) => (
              <div key={stat.name}>
                <dt>{stat.name}</dt>
                <dd>{stat.text}</dd>
              </div>
            ))}
          </dl>
          <p className="hint">
            Ein Klick auf eine Figur zeigt alle drei Werte, ihr Budget und den Grund für ihre letzte Entscheidung.
          </p>
        </section>

        <section className="help-card">
          <h3>Objekte, Mods und Zustand</h3>
          <p>
            Automaten und Tische ziehen je nach Gerät andere Gästetypen an. <b>Mods</b> verstärken das:
            mehr Anziehung, mehr Geduld oder mehr Sucht – gegen Betriebskosten.
            <b> Anziehung</b> ist der Rohwert für Zulauf.
          </p>
          <p>
            Geräte verschleißen. Unter 85 % Zustand lohnt die Reparatur, unter 18 % setzt sich niemand mehr hin.
            Jede Reparatur kostet 1 Ersatzteil und Geld – unabhängig davon, wie kaputt das Gerät ist.
          </p>
          <p>{HELP.nachfrage}</p>
        </section>

        <section className="help-card">
          <h3>Steuerung</h3>
          <ul className="help-controls">
            <li><kbd>Klick</kbd> auf freie Fläche: hinlaufen</li>
            <li><kbd>Klick</kbd> auf Gast oder Objekt: Details öffnen</li>
            <li><kbd>Pfeile</kbd> / <kbd>WASD</kbd>: laufen</li>
            <li><kbd>Mausrad</kbd>: zoomen</li>
            <li><kbd>Enter</kbd>: getragene Kiste nutzen</li>
            <li><kbd>Esc</kbd>: Fenster schließen</li>
          </ul>
        </section>

        <section className="help-card">
          <h3>Der erste Tag</h3>
          <ol className="help-steps">
            <li><b>Bauen</b> öffnen und ein Spiel kaufen. Die Ware kommt als Kiste am Eingang an.</li>
            <li>Kiste <b>abholen</b>, tragen und auf eine freie Fläche klicken. Erst dann ist das Gerät spielbar.</li>
            <li>Gäste kommen nach Nachfrage, wechseln an der Kasse und setzen Chips. Dein Hauskonto wächst.</li>
            <li><b>Offene Gewinne</b> im Gäste-Fenster auszahlen – sonst kommt der Gast nicht weiter.</li>
            <li>Mit dem Gewinn Bar, Ersatzteile und Personal finanzieren. Personal arbeitet, während du weg bist.</li>
          </ol>
          <p className="hint">{HELP.tick}</p>
        </section>
      </div>
    </PopupShell>
  );
}
