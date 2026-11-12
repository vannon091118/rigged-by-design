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
    <PopupShell eyebrow="DEIN ALLTAG" title="So funktioniert dein Haus" onClose={onClose} wide>
      <div className="help-grid">
        <section className="help-card">
          <h3>Dein Anfang</h3>
          <p>
            Du erbst ein kleines Haus, 150 VC und einen Gratis-Automaten. Rita und zwei weitere Menschen
            stehen schon vor der Tür. Du entscheidest, was heute Abend läuft: Geräte, Bar, Personal, Preise.
          </p>
          <p>
            Das Haus ist kein Geldautomat. Jeden Abend gehen Löhne, Reparaturen und Getränke ab; was übrig
            bleibt, finanziert den nächsten. Achte auf die Menschen, nicht nur auf die Kasse.
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
            <li><kbd>Klick</kbd> / <kbd>Tipp</kbd> auf freie Fläche: in Casino, Wohnung und Stadt hinlaufen; im fremden Casino nur Menü</li>
            <li><kbd>Klick</kbd> / <kbd>Tipp</kbd> auf Gast, Möbel oder Kiste: Aktionen nur im eigenen Casino; dort läuft die Figur hin</li>
            <li><kbd>E</kbd>: Ziel in Reichweite wählen oder die Hauptaktion ausführen</li>
            <li><kbd>Pfeile</kbd> / <kbd>WASD</kbd>: in Casino, Wohnung und Stadt laufen; im fremden Casino gesperrt</li>
            <li><kbd>Mausrad</kbd>: auf eigenem Floor, in Wohnung und Stadt zoomen; im fremden Casino gesperrt</li>
            <li><kbd>Rechte Maus</kbd> ziehen: auf eigenem Floor, in Wohnung und Stadt schwenken; im fremden Casino gesperrt</li>
            <li><kbd>+</kbd> / <kbd>-</kbd>: zoomen, <kbd>0</kbd>: Übersicht; im fremden Casino gesperrt</li>
            <li><kbd>Enter</kbd>: getragene Kiste im eigenen Casino nutzen</li>
            <li><kbd>Esc</kbd>: Auswahl abbrechen, Fenster schließen</li>
          </ul>
        </section>

        <section className="help-card">
          <h3>Dein erster Abend</h3>
          <ol className="help-steps">
            <li><b>Ankommen</b>: Rita und die anderen sind schon da. Der erste Automat steht gratis; öffne <b>BETRIEB</b> für alles Weitere.</li>
            <li>Weitere Geräte kaufen: Die Ware kommt als Kiste am Eingang an. Kiste anklicken, dann auf eine freie Fläche klicken. Erst dann ist das Gerät spielbar.</li>
            <li>Gäste kommen nach Nachfrage, wechseln an der Kasse und setzen Chips. Dein Hauskonto wächst.</li>
            <li><b>Offene Gewinne</b> im Gäste-Fenster auszahlen – sonst kommt der Gast nicht weiter.</li>
            <li>Mit dem Überschuss Bar, Ersatzteile und Personal finanzieren. Personal arbeitet, während du weg bist.</li>
          </ol>
          <p className="hint">{HELP.tick}</p>
        </section>
      </div>
    </PopupShell>
  );
}
