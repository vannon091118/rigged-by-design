/**
 * @test-target: src/styles/app.css
 * @error-code: ERR-3001
 *
 * CSS-Vertrag fuer schmale Viewports. jsdom hat keine Layout-Engine; deshalb
 * prueft dieser Test die Regeln, die das Layout tragen: geklemmte Pixelwerte
 * statt fester Mittelpunkte, keine Bottom-Sheet-Umleitung der Aktionskarte und
 * keine horizontalen Mindestbreiten in HUD/Dock.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string): string =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

const appCss = read('../../styles/app.css');
const popupCss = read('../../styles/popup.css');

function rule(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  return css.slice(start, close + 1);
}

function mediaBlock(css: string, header: string): string {
  const start = css.indexOf(header);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let index = open; index < css.length; index += 1) {
    if (css[index] === '{') depth += 1;
    if (css[index] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, index + 1);
    }
  }
  return '';
}

describe('Aktionskarte am Viewport', () => {
  const anchored = rule(appCss, '.action-card.is-anchored');

  it('positioniert aus gemessenen Pixelwerten statt aus einem festen Mittelpunkt', () => {
    expect(anchored).toContain('position: fixed');
    expect(anchored).toContain('var(--anchor-left');
    expect(anchored).toContain('var(--anchor-top');
    expect(anchored).toContain('var(--anchor-width');
    expect(anchored).toContain('var(--anchor-max-height');
    expect(anchored).not.toContain('translate(');
  });

  it('wird auf schmalen Geraeten nicht in die Bottom-Sheet-Zone umgeleitet', () => {
    expect(appCss).not.toMatch(/@media \(max-width: 620px\) \{\s*\.action-card\.is-anchored/);
    const mobile = mediaBlock(appCss, '@media (max-width: 620px)');
    expect(mobile).not.toContain('.action-card.is-anchored');
  });
});

describe('Objektpanel am Viewport', () => {
  const anchored = rule(popupCss, '.popup.is-anchored');

  it('nutzt dieselbe geklemmte Oberkante und eine gedeckelte Hoehe', () => {
    expect(anchored).toContain('var(--anchor-left');
    expect(anchored).toContain('var(--anchor-top');
    expect(anchored).toContain('var(--anchor-max-height');
    expect(anchored).not.toContain('translate(');
    expect(anchored).toContain('max-height');
  });
});

describe('HUD und Dock bei 320/360 px', () => {
  const narrow = mediaBlock(appCss, '@media (max-width: 400px)');

  it('hat eine eigene Regel fuer schmale Bildschirme', () => {
    expect(narrow).not.toBe('');
  });

  it('haelt Dock-Tabs als Touch-Ziele und ohne feste Breite', () => {
    expect(narrow).toMatch(/\.dock-tab\s*\{[^}]*min-height:\s*4[4-9]px/);
    expect(narrow).not.toMatch(/\.dock-tab\s*\{[^}]*width:\s*\d{3}px/);
    expect(narrow).toMatch(/\.dock-utility\s*\{[^}]*flex-wrap:\s*wrap/);
  });

  it('laesst die Vitals scrollen und die Werte schrumpfen', () => {
    expect(rule(appCss, '.hud-vitals')).toContain('overflow-x: auto');
    expect(narrow).toMatch(/\.vital\s*\{[^}]*min-width:\s*0/);
  });
});
