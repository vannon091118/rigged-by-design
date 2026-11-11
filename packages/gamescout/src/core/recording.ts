/** Recording and replay of browser action sequences.
 *
 * Records clicks and key presses with timestamps. Replay verifies
 * pre-conditions (viewport, URL), captures mid-action checkpoints,
 * and compares pre/post state with pixel-diff.
 */

import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import type { Page } from 'playwright-core';
import type { Checkpoint, RecordedAction, ReplayResult } from './types.js';
import { CdpManager } from './cdp.js';

export class RecordingController {
  private cdp: CdpManager;
  private actions: RecordedAction[] = [];
  private recording = false;
  private checkpoints: Map<string, Checkpoint> = new Map();

  constructor(cdp: CdpManager) {
    this.cdp = cdp;
  }

  private get page(): Page {
    return this.cdp.getGamePage();
  }

  startRecording(): void {
    this.recording = true;
    this.actions = [];
  }

  stopRecording(): RecordedAction[] {
    const recorded = [...this.actions];
    this.recording = false;
    this.actions = [];
    return recorded;
  }

  isRecording(): boolean {
    return this.recording;
  }

  record(action: RecordedAction): void {
    if (!this.recording) return;
    this.actions.push(action);
  }

  async replay(actions?: RecordedAction[]): Promise<ReplayResult> {
    const seq = actions ?? this.actions;
    if (!seq || seq.length === 0) {
      return {
        replayed: 0,
        total: 0,
        inconclusive: false,
        preConditions: { viewport: null, url: '', title: '' },
        postConditions: { viewport: null, url: '', title: '' },
        viewportMatch: false,
        urlMatch: false,
        pixelDiff: { count: 0, percent: 0 },
        preCheckpointId: null,
        replayCheckpointIds: [],
      };
    }

    const page = this.page;
    const preViewport = page.viewportSize();
    const preUrl = page.url();
    const preTitle = await page.title();

    // Pre-checkpoint
    const preScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
    const preCheckpointId = this.createCheckpointId('replay-pre');
    const preCheckpoint: Checkpoint = {
      id: preCheckpointId,
      name: `replay-pre-${preCheckpointId}`,
      timestamp: new Date().toISOString(),
      url: preUrl,
      title: preTitle,
      screenshotBase64: preScreenshot.toString('base64'),
      observation: null,
    };
    this.checkpoints.set(preCheckpointId, preCheckpoint);

    let inconclusive = false;
    let count = 0;
    const replayCheckpointIds: string[] = [];

    for (const action of seq) {
      try {
        if (action.type === 'click' && action.data && typeof action.data.x === 'number' && typeof action.data.y === 'number') {
          await page.mouse.click(action.data.x, action.data.y);
          count++;
        } else if (action.type === 'press_key' && action.data && typeof action.data.key === 'string') {
          await page.keyboard.press(action.data.key);
          count++;
        } else {
          inconclusive = true;
          continue;
        }

        // Wait for simulation tick
        await new Promise((r) => setTimeout(r, 300));

        // Mid-action checkpoint
        const midScreenshot = await page.screenshot({ fullPage: true, type: 'png' });
        const midId = this.createCheckpointId(`replay-step-${count}`);
        this.checkpoints.set(midId, {
          id: midId,
          name: `replay-step-${count}-${midId}`,
          timestamp: new Date().toISOString(),
          url: page.url(),
          title: await page.title(),
          screenshotBase64: midScreenshot.toString('base64'),
          observation: null,
        });
        replayCheckpointIds.push(midId);
      } catch {
        inconclusive = true;
        continue;
      }
    }

    // Post-conditions
    const postViewport = page.viewportSize();
    const postUrl = page.url();
    const postTitle = await page.title();
    const postScreenshot = await page.screenshot({ fullPage: true, type: 'png' });

    const viewportMatch =
      preViewport && postViewport
        ? preViewport.width === postViewport.width && preViewport.height === postViewport.height
        : false;
    const urlMatch = preUrl === postUrl;

    if (!viewportMatch || !urlMatch) {
      inconclusive = true;
    }

    // Pixel diff pre vs post
    const imgPre = PNG.sync.read((Buffer.from(preScreenshot, 'base64') as any));
    const imgPost = PNG.sync.read((Buffer.from(postScreenshot, 'base64') as any));
    const w = Math.max(imgPre.width, imgPost.width);
    const h = Math.max(imgPre.height, imgPost.height);
    const diffImg = new PNG({ width: w, height: h });
    const diffCount = pixelmatch(imgPre.data, imgPost.data, diffImg.data, w, h, { threshold: 0.1 });
    const totalPixels = w * h;
    const diffPercent = totalPixels > 0 ? (diffCount / totalPixels) * 100 : 0;

    if (diffCount > 0 && diffPercent > 5) {
      inconclusive = true;
    }

    return {
      replayed: count,
      total: seq.length,
      inconclusive,
      preConditions: { viewport: preViewport, url: preUrl, title: preTitle },
      postConditions: { viewport: postViewport, url: postUrl, title: postTitle },
      viewportMatch,
      urlMatch,
      pixelDiff: { count: diffCount, percent: Math.round(diffPercent * 100) / 100 },
      preCheckpointId,
      replayCheckpointIds,
    };
  }

  createCheckpoint(
    name: string,
    observation: unknown | null,
    screenshotBase64: string,
    url: string,
    title: string
  ): Checkpoint {
    const id = this.createCheckpointId(name);
    const checkpoint: Checkpoint = {
      id,
      name: name || `checkpoint-${id}`,
      timestamp: new Date().toISOString(),
      url,
      title,
      screenshotBase64,
      observation,
    };
    this.checkpoints.set(id, checkpoint);
    return checkpoint;
  }

  getCheckpoint(id: string): Checkpoint | undefined {
    return this.checkpoints.get(id);
  }

  getAllCheckpoints(): Checkpoint[] {
    return Array.from(this.checkpoints.values()).reverse();
  }

  private createCheckpointId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
