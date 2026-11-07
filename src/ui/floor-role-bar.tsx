/** Rollenhinweis auf dem Floor: sagt, was der nächste Klick bewirkt. */
import type { Perspective } from './app-model';
import { OpeningGate } from './opening-card';

const COPY: Readonly<Record<Perspective, { readonly label: string; readonly text: string }>> = {
  guest: { label: 'GASTMODUS', text: 'Gerät antippen und direkt spielen. Dein Portemonnaie zählt.' },
  operator: { label: 'BETREIBERMODUS', text: 'Gerät antippen für Zustand, Ursache, Reparatur und Mods.' },
};

export function FloorRoleBar({ perspective }: { readonly perspective: Perspective }) {
  const copy = COPY[perspective];
  return (
    <>
      <div className={`floor-role-bar ${perspective}`} role="note">
        <b>{copy.label}</b>
        <span>{copy.text}</span>
      </div>
      <OpeningGate />
    </>
  );
}
