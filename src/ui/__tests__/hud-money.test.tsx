/**
 * @test-target: src/ui/hud-money.tsx
 * @error-code: ERR-3001
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { HudMoney } from '../hud-money';

const goal = { label: 'BARKAUF', percent: 40, text: 'Ziel' };

describe('HudMoney', () => {
  it('trennt Kasse und Offen in eigene Elemente, damit die Zeile sauber umbricht', () => {
    const html = renderToStaticMarkup(
      <HudMoney guest={false} amount="150.00 VC" desk="12.00 VC" pending="3.00 VC" pact="kein Pakt" goal={goal} />,
    );
    expect(html).toContain('Kasse 12.00 VC</span><span class="hud-money-sep"');
    expect(html).toContain('Offen 3.00 VC');
    expect(html).toContain('hud-goal-row');
  });

  it('stuft lange Betraege herunter, statt sie abzuschneiden', () => {
    const mid = renderToStaticMarkup(
      <HudMoney guest={false} amount="1.234.567,89 VC" desk="0.00 VC" pending="0.00 VC" pact="kein Pakt" goal={goal} />,
    );
    expect(mid).toContain('class="long"');
    const long = renderToStaticMarkup(
      <HudMoney guest={false} amount="12.345.678.901,23 VC" desk="0.00 VC" pending="0.00 VC" pact="kein Pakt" goal={goal} />,
    );
    expect(long).toContain('class="xlong"');
  });

  it('zeigt im Gastblick Portemonnaie und Pakt statt Kasse', () => {
    const html = renderToStaticMarkup(
      <HudMoney guest amount="5.00 VC" desk="0.00 VC" pending="0.00 VC" pact="Pakt 20" goal={goal} />,
    );
    expect(html).toContain('PORTEMONNAIE');
    expect(html).toContain('Pakt 20');
    expect(html).not.toContain('hud-goal-row');
  });
});
