/** Wohnung, Stadt und erster Auftrag: klare Schritte, keine zweite Spielzustandsmaschine. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';

interface Props {
  readonly view: GameView;
  readonly onOpen: (popup: Popup) => void;
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
          <p>Die Starter-Kiste liegt am Eingang. Stell den Automaten auf, dann kann der erste Gast kommen.</p>
          <div className="onboarding-actions">
            <button type="button" className="btn primary" onClick={() => worldStore.scene.finishOnboarding()}>
              AUFTRAG ANNEHMEN
            </button>
          </div>
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
