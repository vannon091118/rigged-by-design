/** Browser actions: click, press_key, inspect, annotate.
 *
 * All actions target gamePage explicitly, never the currently active
 * browser tab. Dashboard clicks are never interpreted as gameplay actions.
 */

import type { Page } from 'playwright-core';
import { CdpManager } from './cdp.js';

export class ActionController {
  private cdp: CdpManager;

  constructor(cdp: CdpManager) {
    this.cdp = cdp;
  }

  private get page(): Page {
    return this.cdp.getGamePage();
  }

  async click(x: number, y: number): Promise<{ clicked: true; x: number; y: number }> {
    await this.page.mouse.click(x, y);
    return { clicked: true, x, y };
  }

  async pressKey(key: string): Promise<{ keyPressed: string }> {
    await this.page.keyboard.press(key);
    return { keyPressed: key };
  }

  async inspect(x: number, y: number): Promise<unknown> {
    const viewport = this.page.viewportSize();
    if (viewport && (x < 0 || y < 0 || x > viewport.width || y > viewport.height)) {
      return {
        error: `Koordinaten außerhalb des Viewports (${viewport.width}x${viewport.height}): x=${x}, y=${y}`,
        viewport,
      };
    }

    return this.page.evaluate(({ px, py }) => {
      try {
        const el = document.elementFromPoint(px, py);
        if (!el) {
          return {
            tag: null,
            text: null,
            id: null,
            className: null,
            boundingBox: null,
          };
        }
        const rect = el.getBoundingClientRect();
        return {
          tag: el.tagName,
          text: String((el as HTMLElement).innerText ?? '').slice(0, 200),
          id: el.id || null,
          className: el.className || null,
          boundingBox: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          },
        };
      } catch (e) {
        return { error: String(e) };
      }
    }, { px: x, py: y });
  }

  async annotate(
    x: number,
    y: number,
    width: number,
    height: number,
    label?: string
  ): Promise<{ annotated: true; x: number; y: number; width: number; height: number; label: string | undefined; description: string; screenshotBase64: string }> {
    const screenshot = await this.page.screenshot({ fullPage: true, type: 'png' });
    const desc = label
      ? `Markierung: ${label} bei (${x}, ${y}) ${width}x${height}`
      : `Markierung bei (${x}, ${y}) ${width}x${height}`;
    return {
      annotated: true,
      x,
      y,
      width,
      height,
      label,
      description: desc,
      screenshotBase64: screenshot.toString('base64'),
    };
  }

  async preview(fullPage: boolean = true): Promise<{ screenshotBase64: string }> {
    const screenshot = await this.page.screenshot({ fullPage, type: 'png' });
    return { screenshotBase64: screenshot.toString('base64') };
  }
}
