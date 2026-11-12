/** Rollenhinweis auf dem Floor: sagt, was der nächste Klick bewirkt. */
import type { Perspective } from './app-model';
import { useWorldStore } from '../store/use-world-store';
import { OpeningGate } from './opening-card';

const COPY: Readonly<Record<Perspective, { readonly label: string; readonly text: string }>> = {
  guest: { label: 'GASTMODUS', text: 'Gerät antippen und direkt spielen. Dein Portemonnaie zählt.' },
  operator: { label: 'BETREIBERMODUS', text: 'Gerät antippen für Zustand, Ursache, Reparatur und Mods.' },
};

const FOREIGN_COPY = {
  label: 'FREMDER FLOOR',
  text: 'Begehbar: Boden antippen oder WASD nutzen. Kamera und Karte bleiben wie zu Hause.',
};

export function FloorRoleBar({ perspective }: { readonly perspective: Perspective }) {
  const destination = useWorldStore().scene.kind === 'FOREIGN' ? 'foreign' : perspective;
  const copy = destination === 'foreign' ? FOREIGN_COPY : COPY[perspective];
  return (
    <>
      <div className={`floor-role-bar ${destination}`} role="note">
        <b>{copy.label}</b>
        <span>{copy.text}</span>
      </div>
      <OpeningGate />
    </>
  );
}
