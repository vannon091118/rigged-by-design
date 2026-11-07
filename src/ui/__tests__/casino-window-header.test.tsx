/**
 * @test-target: src/ui/casino-window-header.tsx
 * @error-code: ERR-3001
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { fromVC } from '../../core/economy/vacoin';
import { HAUSKONTO, PORTEMONNAIE } from '../../core/sim/money';
import { CasinoWindowHeader } from '../casino-window-header';
import { ACCOUNT_LABEL } from '../glossary';

const noop = (): void => {};

describe('CasinoWindowHeader', () => {
  it('beschriftet die Geldtoepfe aus der zentralen Konto-Map', () => {
    const html = renderToStaticMarkup(
      <CasinoWindowHeader wallet={fromVC(5)} house={fromVC(10)} mods={[]} pact="kein Pakt" full={false} onToggleFull={noop} />,
    );
    expect(html).toContain(`<span>${ACCOUNT_LABEL[PORTEMONNAIE]}</span>`);
    expect(html).toContain(`<span>${ACCOUNT_LABEL[HAUSKONTO]}</span>`);
  });

  it('laesst das Hauskonto weg, wenn das Fenster es nicht kennt', () => {
    const html = renderToStaticMarkup(
      <CasinoWindowHeader wallet={fromVC(5)} mods={[]} pact="kein Pakt" full={false} onToggleFull={noop} />,
    );
    expect(html).not.toContain(`<span>${ACCOUNT_LABEL[HAUSKONTO]}</span>`);
  });
});
