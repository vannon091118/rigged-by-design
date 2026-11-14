/** Wohnung, Stadt und erster Auftrag: klare Schritte, keine zweite Spielzustandsmaschine. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';

interface Props {
  readonly view: GameView;
  readonly onOpen: (popup: Popup) => void;
}

/**
 * Der Raum-Schritt nennt den nächsten echten Handgriff: Kiste aufnehmen, Gerät
 * aufstellen, erst dann ist der Auftrag zu haben (#534/S1-06). Der Zustand kommt
 * aus der Sicht, nicht aus einem zweiten Tutorial-Flag.
 */
function CasinoStep({ view }: { readonly view: GameView }) {
  if (view.furniture.some((item) => item.gameId)) {
    return (
      <>
        <p>Der Automat steht. Der erste Gast kommt, sobald die Kasse offen ist – er findet ein Gerät vor.</p>
        <div className="onboarding-actions">
          <button type="button" className="btn primary" onClick={() => worldStore.scene.finishOnboarding()}>
            AUFTRAG ANNEHMEN
          </button>
        </div>
      </>
    );
  }
  const starter = view.crates.find((crate) => crate.payload.kind === 'FURNITURE' && crate.payload.buildId === 'SLOT');
  if (starter?.carriedBy === 'player') {
    return <p>Du trägst die Kiste. Klick auf eine freie Fläche im Raum, dann steht der Automat.</p>;
  }
  if (starter) {
    return (
      <p>
        Die Starter-Kiste liegt am Eingang. Klick sie an und danach eine freie Fläche: dein Charakter
        trägt sie hin und baut den Automaten auf. Erst dann kommt der erste Gast.
      </p>
    );
  }
  return <p>Im Raum steht noch kein Gerät. Bestell eins im Betrieb – ohne Automaten kommt kein Gast.</p>;
}

export function OnboardingPanel({ view, onOpen }: Props) {
  const step = view.onboarding.step;
  // Nur Wohnung, Stadt und Raum haben ein Panel; Eroeffnung, Abschluss und
  // der fremde Floor keines: dort gibt es nur dessen Menue.
  if (view.scene.kind === 'FOREIGN') return null;
  // Ein alter Schritt darf nicht in der falschen Szene stehen bleiben: nach
  // der Rückkehr aus einem fremden Floor ist die Szene OWN, nicht Stadt.
  if (step === 'APARTMENT' && view.scene.kind !== 'APARTMENT') return null;
  if (step === 'CITY' && view.scene.kind !== 'CITY') return null;
  if (step === 'CASINO' && view.scene.kind !== 'OWN') return null;
  if (step !== 'APARTMENT' && step !== 'CITY' && step !== 'CASINO') return null;
  return (
    <section className="onboarding-panel" aria-label="Erste Schritte">
      <span className="eyebrow">ERSTE SCHRITTE</span>
      {step === 'APARTMENT' ? (
        <>
          <h2>Du bist zu Hause.</h2>
          <p>Deine Wohnung: Bett, Kochnische, Flur. Die Haustür führt auf die Straße.</p>
          <div className="onboarding-actions">
            <button type="button" className="btn primary" onClick={() => worldStore.scene.enterCity()}>
              HAUSTÜR ÖFFNEN
            </button>
          </div>
        </>
      ) : step === 'CITY' ? (
        <>
          <h2>Die Stadt wartet.</h2>
          <p>Dein Casino steht leer. Geh hinein, stell den ersten Automaten auf und öffne die Tür.</p>
          <div className="onboarding-actions">
            <button type="button" className="btn primary" onClick={() => worldStore.scene.enterCasino()}>
              CASINO BETRETEN
            </button>
            <button type="button" className="btn ghost" onClick={() => onOpen({ kind: 'city' })}>
              STADTKARTE
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Der Raum ist dein.</h2>
          <CasinoStep view={view} />
        </>
      )}
    </section>
  );
}

export function ApartmentSceneBar({ view }: Pick<Props, 'view'>) {
  if (view.scene.kind !== 'APARTMENT') return null;
  return (
    <div className="city-scene-bar" role="group" aria-label="Wohnung">
      <strong>WOHNUNG</strong>
      <button type="button" className="btn small" onClick={() => worldStore.scene.enterCity()}>
        HAUSTÜR · AUF DIE STRASSE
      </button>
    </div>
  );
}

export function CitySceneBar({ view, onOpen }: Props) {
  if (view.scene.kind !== 'CITY') return null;
  return (
    <div className="city-scene-bar" role="group" aria-label="Stadt">
      <strong>STADT</strong>
      <button type="button" className="btn small" onClick={() => worldStore.scene.enterCasino()}>CASINO</button>
      <button type="button" className="btn ghost small" onClick={() => worldStore.scene.enterApartment()}>WOHNUNG</button>
      <button type="button" className="btn ghost small" onClick={() => onOpen({ kind: 'foreignMap' })}>FREMDE CASINOS</button>
      <button type="button" className="btn ghost small" onClick={() => onOpen({ kind: 'city' })}>KARTE</button>
    </div>
  );
}
