/** Stadt und erster Auftrag: zwei klare Schritte, keine zweite Spielzustandsmaschine. */
import type { GameView } from '../store/types';
import { worldStore } from '../store/use-world-store';
import type { Popup } from './app-model';

interface Props {
  readonly view: GameView;
  readonly onOpen: (popup: Popup) => void;
}

export function OnboardingPanel({ view, onOpen }: Props) {
  const step = view.onboarding.step;
  // Nur Stadt und Raum haben ein Panel; Eroeffnung und Abschluss keines.
  if (step !== 'CITY' && step !== 'CASINO') return null;
  return (
    <section className="onboarding-panel" aria-label="Erste Schritte">
      <span className="eyebrow">ERSTE SCHRITTE</span>
      {step === 'CITY' ? (
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

export function CitySceneBar({ view, onOpen }: Props) {
  if (view.scene.kind !== 'CITY') return null;
  return (
    <div className="city-scene-bar" role="group" aria-label="Stadt">
      <strong>STADT</strong>
      <button type="button" className="btn small" onClick={() => worldStore.scene.enterCasino()}>CASINO</button>
      <button type="button" className="btn ghost small" onClick={() => onOpen({ kind: 'foreignMap' })}>FREMDE CASINOS</button>
      <button type="button" className="btn ghost small" onClick={() => onOpen({ kind: 'city' })}>KARTE</button>
    </div>
  );
}
